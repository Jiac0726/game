'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHandler}=require('../cloudfunctions/flyingRoom/index');

function memoryPG(){
 const data=new Map(),commands=[];
 let owner=Promise.resolve();
 let active=0,peak=0,released=0;
 const pool={
  async connect(){
   let unlock=null;
   return {
    async query(sql,params=[]){
     commands.push({sql:sql.split(' ')[0],paramsCount:params.length});
     if(sql==='BEGIN'){
      let granted;
      const acquired=new Promise(resolve=>{granted=resolve;});
      const prev=owner;owner=owner.then(()=>acquired);
      await prev;
      active++;peak=Math.max(active,peak);unlock=granted;
      return {};
     }
     if(sql==='COMMIT'||sql==='ROLLBACK'){
      if(unlock){unlock();unlock=null;active--;}
      return {};
     }
     if(sql.startsWith('INSERT INTO')){
      if(data.has(params[0]))throw Error('duplicate room id');
      data.set(params[0],JSON.parse(params[1]));
      return {rowCount:1};
     }
     if(sql.startsWith('SELECT state')){
      return {rows:data.has(params[0])?[{state:structuredClone(data.get(params[0]))}]:[]};
     }
     if(sql.startsWith('UPDATE public')){
      data.set(params[0],JSON.parse(params[1]));return {rowCount:1};
     }
     throw Error('unexpected SQL: '+sql);
    },
    release(){
     if(unlock){unlock();unlock=null;active--;}
     released++;
    }
   };
  }
 };
 return {pool,data,commands,get peak(){return peak;},get released(){return released;}};
}
function make(handlerOpts={}){
 const database=memoryPG(),clock=()=>10000;
 const rand=size=>Buffer.alloc(size,255);
 const fn=uid=>createHandler({
  getUID:()=>uid,getPool:()=>database.pool,randomBytes:rand,now:clock,
  logger:{error:()=>{}},...handlerOpts
 });
 return {database,fn};
}
function request(room,action,tail='00000000',extra={}){
 return {action,roomId:room.id,revision:room.revision,requestId:'req_'+tail,...extra};
}
test('PG creates one JSONB room with 3 AI, then saves room ready/start/roll/move',async()=>{
 const {database,fn}=make(),run=fn('host');
 let result=await run({action:'create',name:'玩家',bots:{count:3,difficulty:'normal'}});
 assert.equal(result.ok,true);
 assert.equal(result.room.seats.filter(Boolean).length,4);
 assert.equal(database.data.size,1);
 let room=result.room;
 result=await run(request(room,'ready','ready0001'));
 assert.equal(result.ok,true);room=result.room;
 result=await run(request(room,'start','start0001'));
 assert.equal(result.ok,true);room=result.room;
 assert.equal(room.status,'playing');
 result=await run(request(room,'roll','roll0001',{die:1}));
 assert.equal(result.ok,true);room=result.room;
 assert.equal(room.lastRoll.die,6,'server dice ignores spoofed client value');
 assert.equal(room.game.phase,'choose');
 result=await run(request(room,'move','move0001',{piece:0}));
 assert.equal(result.ok,true);
 assert.ok(result.room.revision>room.revision);
 assert.ok(result.room.motion);
 assert.equal(database.data.get(room.id).revision,result.room.revision);
 const stale=await run(request(room,'move','bad00001',{piece:0}));
 assert.equal(stale.ok,false);
 assert.equal(stale.code,'STALE');
 assert.equal(database.data.get(room.id).revision,result.room.revision);
 assert.ok(database.released>=6,'every checked-out SQL connection is released');
});

test('PG SELECT FOR UPDATE serializes simultaneous join requests, no overbooking',async()=>{
 const {database,fn}=make();
 const created=await fn('a')({action:'create',name:'房主'});
 assert.equal(created.ok,true);
 const id=created.room.id;
 const attempts=await Promise.all(['b','c','d','e'].map(uid=>
  fn(uid)({action:'join',roomId:id,name:uid})));
 assert.equal(attempts.filter(x=>x.ok).length,3);
 assert.equal(attempts.filter(x=>x.code==='FULL').length,1);
 const room=(await fn('a')({action:'get',roomId:id})).room;
 assert.equal(room.seats.filter(Boolean).length,4);
 assert.equal(new Set(room.seats.filter(Boolean).map(s=>s.name)).size,4);
 assert.equal(database.peak,1,'transactions should never process room writes in parallel');
 assert.equal(database.data.get(id).revision,3);
});

test('PG rejects concurrent stale revision after row lock and never overwrites the winner',async()=>{
 const {database,fn}=make(),who=fn('a');
 let r=(await who({action:'create',bots:{count:3,difficulty:'normal'}})).room;
 const original=r.revision;
 const attempts=await Promise.all([
  who(request(r,'ready','ready0003')),
  who(request(r,'ready','ready0004'))
 ]);
 assert.equal(attempts.filter(x=>x.ok).length,1);
 assert.equal(attempts.filter(x=>x.code==='STALE').length,1);
 assert.equal(database.data.get(r.id).revision,original+1);
 assert.equal(database.peak,1);
});

test('PG invalid room request rolls back, missing config is not silently treated as NoSQL',async()=>{
 const {database,fn}=make(),h=fn('owner');
 const result=await h({action:'create'});
 const invalid=await h({action:'move',roomId:result.room.id,revision:result.room.revision,
  requestId:'wrong1234',piece:0});
 assert.equal(invalid.ok,false);
 assert.equal(invalid.code,'PHASE');
 assert.equal(database.data.get(result.room.id).revision,0);
 assert.ok(database.commands.some(c=>c.sql==='ROLLBACK'));
 const query=await h({action:'get',roomId:'0'.repeat(32)});
 assert.equal(query.ok,false);
 assert.equal(query.code,'ROOM');
 const file=fs.readFileSync(path.join(__dirname,'../cloudfunctions/flyingRoom/index.js'),'utf8');
 assert.ok(!file.includes('cloud.database()'));
 assert.ok(file.includes('PGHOST')&&file.includes('FOR UPDATE'));
});

test('migration creates indexed JSONB room state with RLS enabled',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../sql/001_flying_rooms_postgres.sql'),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.flying_rooms/);
 assert.match(sql,/state JSONB NOT NULL/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE/);
});
