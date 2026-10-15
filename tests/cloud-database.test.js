'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHandler,COLLECTION}=require('../cloudfunctions/flyingRoom/index');

function memoryCloudDB(){
 const docs=new Map(),ops=[];
 let gate=Promise.resolve(),active=0,peak=0;
 const db={
  collection(name){
   assert.equal(name,COLLECTION);
   return {
    async add({data}){
     ops.push('add');
     if(docs.has(data._id))throw Error('duplicate _id');
     docs.set(data._id,structuredClone(data));return {_id:data._id};
    },
    doc(id){return {
     async get(){
      ops.push('get');
      return {data:docs.has(id)?structuredClone(docs.get(id)):null};
     }
    };}
   };
  },
  async runTransaction(callback){
   let release;
   const prior=gate;
   gate=new Promise(done=>{release=done;});
   await prior;
   active++;peak=Math.max(peak,active);
   const changes=new Map();
   try{
    const transaction={
     collection(name){
      assert.equal(name,COLLECTION);
      return {doc(id){
       return {
        async get(){
         ops.push('tx.get');
         return {data:changes.has(id)?structuredClone(changes.get(id)):
          docs.has(id)?structuredClone(docs.get(id)):null};
        },
        async update(){
         // Simulate the real CloudDB failure when nested state.game is null:
         // update() flattens nested paths (state.game.colors) and fails -502001.
         throw Object.assign(Error(
          "Cannot create field 'colors' in element {game: null}"),{code:'-502001'});
        },
        async set(options){
         // Reproduce actual wx-server-sdk validation observed in production.
         // Passing {state:...} without {data:{state:...}} rejects with code -1.
         ops.push('tx.set');
         if(!options||!options.data||typeof options.data!=='object'||
            Array.isArray(options.data)){
          const err=new Error('parameter.data should be object instead of undefined');
          err.code=-1;
          throw err;
         }
         const data=options.data;
         assert.ok(!Object.hasOwn(data,'_id'),'doc(id).set leaves _id immutable');
         assert.ok(!Object.hasOwn(data,'data'),'replacement document must not nest data');
         assert.ok(Object.hasOwn(data,'state'),'transaction set requires state');
         assert.ok(docs.has(id),'transactions must never invent a room');
         changes.set(id,{_id:id,...structuredClone(data)});
         return {stats:{updated:1,created:0}};
        }
       };
      }};
     }
    };
    const ret=await callback(transaction);
    for(const [id,data] of changes)docs.set(id,data);
    return ret;
   }finally{
    active--;release();
   }
  }
 };
 return {db,docs,ops,get peak(){return peak;}};
}
function make(){
 const memory=memoryCloudDB();
 let current=10000;
 const uid=u=>createHandler({
  getUID:()=>u,
  getDB:()=>memory.db,
  randomBytes:size=>Buffer.alloc(size,255),
  now:()=>current,
  logger:{error:()=>{}}
 });
 return {memory,uid,tick(ms){current+=ms;}};
}
function request(room,action,label,extra={}){
 return {action,roomId:room.id,revision:room.revision,
  requestId:'request_'+label,...extra};
}
test('Cloud DB: create room persists by _id, membership and no PGPASSWORD',async()=>{
 const {memory,uid}=make();
 const host=uid('host');
 const created=await host({action:'create',name:'房主',bots:{count:3,difficulty:'normal'}});
 assert.equal(created.ok,true);
 assert.equal(created.room.seats.filter(Boolean).length,4);
 assert.equal(memory.docs.size,1);
 assert.equal(memory.docs.get(created.room.id)._id,created.room.id);
 assert.equal(memory.docs.get(created.room.id).state.host,'host');
 const get=await host({action:'get',roomId:created.room.id});
 assert.equal(get.ok,true);
 assert.equal(get.room.id,created.room.id);
 assert.equal('host' in get.room,false);
 assert.equal((await uid('stranger')({action:'get',roomId:created.room.id})).code,'FORBIDDEN');
 assert.equal((await host({action:'get',roomId:'1'.repeat(32)})).code,'ROOM');
 const src=fs.readFileSync(path.join(__dirname,'../cloudfunctions/flyingRoom/index.js'),'utf8');
 assert.ok(src.includes("cloud.database({throwOnNotFound:false})"));
 assert.ok(!src.includes("require('pg')"));
 assert.ok(!src.includes("process.env.PGHOST"));
 assert.ok(!src.includes("require('pg')"));
});

test('Cloud DB: ready/start/roll/move, server dice and duplicate request id',async()=>{
 const {memory,uid}=make();
 const run=uid('host');
 let room=(await run({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 let result=await run(request(room,'ready','ready001'));
 assert.equal(result.ok,true);
 room=result.room;
 result=await run(request(room,'start','start001'));
 assert.equal(result.ok,true);
 room=result.room;
 assert.equal(room.status,'playing');
 assert.equal(room.round,1);
 result=await run(request(room,'roll','roll0001',{die:1}));
 assert.equal(result.ok,true);
 assert.equal(result.room.lastRoll.die,6);
 const afterRoll=result.room;
 const again=await run(request(room,'roll','roll0001',{die:1}));
 assert.equal(again.ok,true);
 assert.equal(again.room.revision,afterRoll.revision);
 assert.equal(memory.docs.get(room.id).state.revision,afterRoll.revision);
 assert.ok(memory.ops.includes('tx.get'));
 assert.ok(memory.ops.includes('tx.set'));
 room=afterRoll;
 result=await run(request(room,'move','move0001',{piece:0}));
 assert.equal(result.ok,true);
 assert.ok(result.room.revision>room.revision);
 const stale=await run(request(room,'move','different',{piece:0}));
 assert.equal(stale.code,'STALE');
});


test('Cloud DB: SDK rejects transaction set without data envelope (-1)',async()=>{
 const {memory,uid}=make(),host=uid('host');
 const room=(await host({action:'create'})).room;
 const result=await host(request(room,'ready','ready001'));
 assert.equal(result.ok,true,'ready must pass required set({data}) shape');
 const stored=memory.docs.get(room.id);
 assert.equal(stored.state.seats[0].ready,true);
 assert.equal(stored.state.revision,1);
 assert.equal(Object.hasOwn(stored,'data'),false,'no accidental data nesting');
 assert.ok(memory.ops.includes('tx.set'));
});

test('Cloud DB regression -502001: first start replaces null game atomically',async()=>{
 const {memory,uid}=make(),host=uid('host');
 let room=(await host({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 assert.equal(memory.docs.get(room.id).state.game,null);
 room=(await host(request(room,'ready','ready0001'))).room;
 assert.equal(room.game,null);
 const started=await host(request(room,'start','start0001'));
 assert.equal(started.ok,true);
 assert.equal(started.room.status,'playing');
 assert.equal(started.room.round,1);
 assert.ok(Array.isArray(started.room.game.colors));
 assert.equal(started.room.game.colors.length,4);
 assert.equal(memory.docs.get(room.id)._id,room.id);
 assert.equal(memory.docs.get(room.id).state.game.colors[0],'R');
 assert.equal(memory.docs.get(room.id).state.revision,2);
 assert.equal(memory.ops.filter(x=>x==='tx.set').length,2);
});

test('Cloud DB: authenticated read-only deployment health reports the backend version',async()=>{
 const {memory,uid}=make();
 const result=await uid('host')({action:'health'});
 assert.equal(result.ok,true);
 assert.equal(result.version,'wxdb-tx-set-data-20261015-4');
 assert.equal(result.debugEnabled,false);
 assert.equal(result.store,'wechat-cloud-database');
 assert.equal(memory.docs.size,0);
 assert.equal(memory.ops.length,0);
});

test('Cloud DB: bad previous set wrapping recovers existing room on mutation',async()=>{
 const {memory,uid}=make(),host=uid('host');
 let room=(await host({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 const old=memory.docs.get(room.id);
 memory.docs.set(room.id,{_id:room.id,data:{
  state:old.state,expiresAt:old.expiresAt,updatedAt:old.updatedAt
 }});
 const read=await host({action:'get',roomId:room.id});
 assert.equal(read.ok,true);
 assert.equal(read.room.status,'waiting');
 room=(await host(request(room,'ready','ready0001'))).room;
 const doc=memory.docs.get(room.id);
 assert.ok(doc.state);
 assert.equal(doc.state.seats[0].ready,true);
 assert.equal(Object.hasOwn(doc,'data'),false);
 assert.equal(doc._id,room.id);
});

test('Cloud DB: safe diagnostics include action, stage and code without secret detail',async()=>{
 const logs=[];
 const db={
  collection:()=>({doc:()=>({get:async()=>{throw Object.assign(
   Error('password=unsafe-secret Cannot create field colors'),{code:'-502001'});}})}),
  runTransaction:()=>{}
 };
 const handle=createHandler({
  getUID:()=> 'host',getDB:()=>db,debugEnabled:false,
  logger:{error:(...args)=>logs.push(args)}
 });
 const r=await handle({action:'get',roomId:'a'.repeat(32)});
 assert.equal(r.ok,false);
 assert.equal(r.code,'DATABASE');
 assert.equal(r.action,'get');
 assert.equal(r.stage,'get');
 assert.equal(r.dbCode,'-502001');
 assert.equal(r.detail,undefined);
 assert.ok(!JSON.stringify(r).includes('unsafe-secret'));
 assert.ok(logs.length);
});

test('Cloud DB: opt-in diagnostics redact password fields and expose SDK cause',async()=>{
 const db={
  collection:()=>({doc:()=>({get:async()=>{throw Object.assign(
   Error("password=unsafe-secret Cannot create field 'colors' in element {game: null}"),{code:'-502001'});}})}),
  runTransaction:()=>{}
 };
 const handle=createHandler({
  getUID:()=> 'host',getDB:()=>db,debugEnabled:true,
  logger:{error:()=>{}}
 });
 const health=await handle({action:'health'});
 assert.equal(health.debugEnabled,true);
 const r=await handle({action:'get',roomId:'a'.repeat(32)});
 assert.equal(r.dbCode,'-502001');
 assert.match(r.detail,/Cannot create field/);
 assert.ok(!r.detail.includes('unsafe-secret'));
 assert.match(r.detail,/\[REDACTED\]/);
});

test('Cloud DB: simultaneous joins with only 3 seats, no overbooking',async()=>{
 const {memory,uid}=make();
 const id=(await uid('a')({action:'create',name:'房主'})).room.id;
 const attempts=await Promise.all(['b','c','d','e'].map(name=>
  uid(name)({action:'join',roomId:id,name})));
 assert.equal(attempts.filter(r=>r.ok).length,3);
 assert.equal(attempts.filter(r=>r.code==='FULL').length,1);
 const room=(await uid('a')({action:'get',roomId:id})).room;
 assert.equal(room.seats.filter(Boolean).length,4);
 assert.equal(new Set(room.seats.filter(Boolean).map(s=>s.name)).size,4);
 assert.equal(memory.peak,1);
 assert.equal(memory.docs.get(id).state.revision,3);
});

test('Cloud DB: simultaneous ready commands reject stale revision, no overwrites',async()=>{
 const {memory,uid}=make();
 const host=uid('host');
 const r=(await host({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 const both=await Promise.all([
  host(request(r,'ready','ready0001')),
  host(request(r,'ready','ready0002'))
 ]);
 assert.equal(both.filter(x=>x.ok).length,1);
 assert.equal(both.filter(x=>x.code==='STALE').length,1);
 assert.equal(memory.docs.get(r.id).state.revision,1);
 assert.equal(memory.peak,1);
});

test('Cloud DB: invalid operations have no write and timeout respects server time',async()=>{
 const {memory,uid,tick}=make(),host=uid('host');
 let room=(await host({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 const before=memory.ops.filter(x=>x==='tx.set').length;
 assert.equal((await host(request(room,'move','bad00001',{piece:0}))).code,'PHASE');
 assert.equal(memory.ops.filter(x=>x==='tx.set').length,before);
 room=(await host(request(room,'ready','ready0001'))).room;
 room=(await host(request(room,'start','start0001'))).room;
 assert.equal((await host(request(room,'timeout','timeout0'))).code,'TOO_EARLY');
 tick(61000);
 assert.equal((await host(request(room,'timeout','timeout1'))).ok,true);
});

test('Cloud DB: zero dependency on PostgreSQL or schema migrations',()=>{
 const pkg=require('../cloudfunctions/flyingRoom/package.json');
 assert.equal(pkg.dependencies.pg,undefined);
 assert.ok(pkg.dependencies['wx-server-sdk']);
 assert.equal(COLLECTION,'flying_rooms');
});
