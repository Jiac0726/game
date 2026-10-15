'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
const ID='a'.repeat(32);let sequence=0;
function req(room,action,extra={}){return Object.assign({action,revision:room.revision,requestId:'request_'+(++sequence)},extra);}
function full(){let r=createRoom(ID,'a','房主',0);for(const uid of ['b','c','d'])r=apply(r,uid,{action:'join'},1);for(const uid of ['a','b','c','d'])r=apply(r,uid,req(r,'ready'),2);return r;}
function started(){const r=full();return apply(r,'a',req(r,'start'),3);}
function rejects(r,uid,e,code,now=10){assert.throws(()=>apply(r,uid,e,now,()=>0),x=>x.code===code);}
test('four seats, same member reconnects, fifth member blocked and private identities hidden',()=>{
 const r=full();rejects(r,'e',{action:'join'},'FULL');assert.deepEqual(apply(r,'b',{action:'join'},10),r);
 const v=view(r,'b');assert.equal(v.seat,1);assert.equal(v.isHost,false);assert.equal(v.seats.some(p=>'uid' in p),false);assert.equal('seen' in v,false);
});
test('host requires exactly four ready members; waiting-room host transfers on exit',()=>{
 let r=createRoom(ID,'a','',0);rejects(r,'a',req(r,'start'),'NOT_READY');r=apply(r,'b',{action:'join'},1);rejects(r,'b',req(r,'start'),'HOST');
 r=apply(r,'a',req(r,'leave'),2);assert.equal(r.host,'b');assert.equal(r.seats[0],null);
});
test('server turn, revision and action validation; client die and identity ignored',()=>{
 let r=started();rejects(r,'b',req(r,'roll',{uid:'a',die:6}),'TURN');rejects(r,'e',{action:'get'},'FORBIDDEN');
 rejects(r,'a',{action:'roll',revision:r.revision-1,requestId:'stale_123'},'STALE');
 rejects(r,'a',req(r,'move',{piece:0}),'MOVE');
 r=apply(r,'a',req(r,'roll',{die:6}),10,()=>0);
 assert.equal(r.lastRoll.die,1,'server rolls 1 and ignores the client-supplied die');
 assert.equal(r.game.die,0,'automatic pass resets the pending die');
 assert.equal(r.game.turn,1,'no available move advances to the next player');
 assert.equal(r.game.phase,'roll');
});
test('retry is idempotent after version advanced, and invalid moves do not mutate',()=>{
 let r=started(),e=req(r,'roll');r=apply(r,'a',e,10,()=>.999);assert.equal(r.game.die,6);
 const again=apply(r,'a',e,12,()=>0);assert.deepEqual(again,r);
 rejects(r,'a',req(r,'move',{piece:99}),'MOVE');assert.deepEqual(r.game.pieces[0],[-1,-1,-1,-1]);
 r=apply(r,'a',req(r,'move',{piece:0}),13);assert.equal(r.game.pieces[0][0],0);assert.equal(r.game.turn,0);
});
test('server timeout, expiry and in-game seat reservation',()=>{
 let r=started();rejects(r,'b',req(r,'timeout'),'TOO_EARLY');rejects(r,'a',req(r,'leave'),'PLAYING');rejects(r,'a',req(r,'roll'),'TIMEOUT',r.deadline);
 r=apply(r,'b',req(r,'timeout'),r.deadline);assert.equal(r.game.turn,1);assert.equal(r.game.phase,'roll');
 rejects(r,'a',{action:'get'},'EXPIRED',r.expiresAt);assert.deepEqual(apply(r,'a',{action:'join'},100),r);
});
test('win and host rematch reset authoritative game state',()=>{
 let r=started();r.game.pieces[0]=[57,57,57,56];r.game.phase='choose';r.game.die=1;
 r=apply(r,'a',req(r,'move',{piece:3}),10);assert.equal(r.status,'done');assert.equal(r.game.winner,0);
 rejects(r,'b',req(r,'rematch'),'HOST');r=apply(r,'a',req(r,'rematch'),11);assert.equal(r.status,'playing');assert.deepEqual(r.game.pieces[0],[-1,-1,-1,-1]);
});
test('deployed handler serializes concurrent joins and rolls with transactional adapter',async()=>{
 const docs=new Map();let chain=Promise.resolve();
 const collection=()=>({doc:id=>({get:async()=>({data:docs.get(id)}),set:async({data})=>{docs.set(id,JSON.parse(JSON.stringify(data)));}})});
 const db={collection,runTransaction:fn=>{const p=chain.then(async()=>({result:await fn({collection})}));chain=p.catch(()=>{});return p;}};
 const sdk={init(){},DYNAMIC_CURRENT_ENV:'test',database:()=>db,getWXContext:()=>({OPENID:identity})};let identity='a';
 const folder=path.resolve('online/cloudfunctions/flyingRoom'),exports={};
 vm.runInNewContext(fs.readFileSync(folder+'/index.js','utf8'),{exports,require:n=>n==='wx-server-sdk'?sdk:n==='./service'?require(folder+'/service'):require(n),console});
 const handler=exports.main,make=await handler({action:'create'}),id=make.room.id;
 const joinPromises=[];for(const uid of ['b','c','d','e']){identity=uid;joinPromises.push(handler({action:'join',roomId:id}));}
 const joined=await Promise.all(joinPromises);assert.equal(joined.filter(r=>r.ok).length,3);assert.equal(joined[3].code,'FULL');
 let room=docs.get(id);for(const uid of ['a','b','c','d']){identity=uid;const response=await handler(Object.assign({roomId:id},req(room,'ready')));assert.equal(response.ok,true);room=docs.get(id);}
 identity='a';await handler(Object.assign({roomId:id},req(room,'start')));room=docs.get(id);
 const one=Object.assign({roomId:id},req(room,'roll')),two=Object.assign({roomId:id},req(room,'roll'));
 const results=await Promise.all([handler(one),handler(two)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).code,'STALE');
 const retry=await handler(one);assert.equal(retry.ok,true);assert.equal(retry.room.game.die,results[0].room.game.die);
});
test('client/server share same rules and paths; native invitation targets join page',()=>{
 for(const f of ['flying-model.js','flying-paths.js'])assert.equal(fs.readFileSync('online/miniprogram/lib/'+f,'utf8'),fs.readFileSync('online/cloudfunctions/flyingRoom/lib/'+f,'utf8'));
 assert.match(fs.readFileSync('online/miniprogram/pages/room/room.wxml','utf8'),/open-type="share"/);
 assert.match(fs.readFileSync('online/miniprogram/pages/room/room.js','utf8'),/\/pages\/room\/room\?roomId=/);
});
test('four mini-program clients join shared room, prepare, roll, move and recover an uncertain request',async()=>{
 let room=createRoom(ID,'a','房主',Date.now());const clients=[];let failed=false;
 for(const uid of ['a','b','c','d']){
  let definition;const storage={};
  const wx={getStorageSync:key=>storage[key],setStorageSync:(key,value)=>{storage[key]=value;},removeStorageSync:key=>{delete storage[key];}};
  const api={call:async(action,e={})=>{
   room=apply(room,uid,Object.assign({},e,{action}),Date.now(),()=>.999);
   if(uid==='a'&&action==='roll'&&!failed){failed=true;throw new Error('network response lost');}
   return {ok:true,room:view(room,uid),serverNow:Date.now()};
  }};
  const dir=path.resolve('online/miniprogram/pages/room');
  vm.runInNewContext(fs.readFileSync(dir+'/room.js','utf8'),{Page:p=>{definition=p;},require:n=>n==='../../lib/api'?api:require(path.resolve(dir,n)),wx,console,setTimeout:()=>1,clearTimeout(){},Date,Math});
  const client=Object.assign({},definition,{data:JSON.parse(JSON.stringify(definition.data)),setData(values){Object.assign(this.data,values);}});
  client.roomId=ID;client.images={};client.offset=0;client.hidden=false;
  await client.join();clients.push(client);
 }
 const sync=()=>clients.forEach((c,i)=>c.accept({room:view(room,['a','b','c','d'][i]),serverNow:Date.now()}));sync();
 for(const c of clients){await c.command('ready');sync();}
 assert.equal(clients[0].data.allReady,true);assert.match(clients[2].onShareAppMessage().path,new RegExp(ID));
 await clients[0].command('start');sync();assert.equal(clients[0].data.myTurn,true);assert.equal(clients[1].data.myTurn,false);
 await clients[0].command('roll');assert.equal(room.game.die,6);assert.equal(clients[0].data.pending,true);const revision=room.revision;
 await clients[0].sendPending();sync();assert.equal(room.revision,revision);assert.equal(clients[0].data.pending,false);
 await clients[0].command('move',{piece:0});sync();assert.equal(room.game.pieces[0][0],0);
 assert.equal(JSON.stringify(clients[3].data.room.game),JSON.stringify(clients[0].data.room.game));
 clients[0].onHide();assert.equal(clients[0].hidden,true);clients[0].onShow();assert.equal(clients[0].hidden,false);
});
