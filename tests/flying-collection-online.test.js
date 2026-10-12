'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FlyingOnlineClient}=require('../src/flying-online-client');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
const {App}=require('../src/app');
const id='a'.repeat(32),timer={setTimeout:()=>1,clearTimeout:()=>{}};
function server(){let room;return {platform(uid){const storage={};return {getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),removeStorageSync:k=>delete storage[k],cloud:{callFunction:async({data})=>{try{if(data.action==='create')room=createRoom(id,uid,'',Date.now(),data.settings);else room=apply(room,uid,data,Date.now(),()=>.99);return {result:{ok:true,room:view(room,uid),serverNow:Date.now()}};}catch(e){return {result:{ok:false,code:e.code,message:e.message}};}}}};},room:()=>room};}
test('four collection clients prepare and play; uncertain commands retain their request ID',async()=>{
 const s=server(),clients=['a','b','c','d'].map(uid=>new FlyingOnlineClient(s.platform(uid),{envId:'test',functionName:'flyingRoom'},()=>{},timer));
 assert.equal(await clients[0].enter('create'),true);for(const c of clients.slice(1))assert.equal(await c.enter('join',id),true);
 for(const c of clients){await c.sync();assert.equal(await c.command('ready'),true);}
 await clients[0].sync();assert.equal(await clients[0].command('start'),true);
 assert.deepEqual(s.room().game.colors,s.room().seats.map(p=>p.color));
 const outsider=new FlyingOnlineClient(s.platform('fifth'),{envId:'test'},()=>{},timer);assert.equal(await outsider.enter('join',id),false);
 await clients[1].sync();assert.equal(await clients[1].command('roll'),false);
 const c=clients[0],real=c.platform.cloud.callFunction;let first=true;
 c.platform.cloud.callFunction=async(args)=>{const res=await real(args);if(first&&args.data.action==='roll'){first=false;throw new Error('network disconnected');}return res;};
 assert.equal(await c.command('roll'),false);const requestId=c.pending.requestId;const revision=s.room().revision;
 assert.equal(await c.retry(),true);assert.equal(c.pending,null);assert.equal(s.room().revision,revision);assert.ok(s.room().seen.some(x=>x.id===requestId));
 assert.equal(await c.command('move',{piece:0}),true);assert.equal(s.room().game.pieces[0][0],0);
 for(const client of clients)client.stop();
});
function app(platform){const ctx=new Proxy({measureText:s=>({width:String(s).length*8})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});return new App({getContext:()=>ctx},{windowWidth:375,windowHeight:812},platform);}
test('collection party entry offers online room and invitation uses MiniGame query',async()=>{
 const s=server(),platform=s.platform('a'),shares=[];platform.shareAppMessage=payload=>shares.push(payload);
 const a=app(platform);a.render();a.mode='派对';a.render();a.buttons.find(b=>b.label==='一起玩飞行棋').fn();a.render();
 assert.ok(a.buttons.find(b=>b.label==='创建四人联机房间'));
 a.onlineClient().timers=timer;await a.openOnlineFlying('create');a.render();assert.equal(a.screen,'flyingRoom');
 a.inviteOnlineFlying();assert.equal(shares.length,1);assert.equal(shares[0].query,'from=share&game=flying&roomId='+id);assert.equal(shares[0].path,undefined);
 const b=app(s.platform('b'));b.onlineClient().timers=timer;assert.equal(b.handleShareEntry({game:'flying',roomId:id}),true);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(b.screen,'flyingRoom');assert.equal(b.onlineFlying.room.id,id);
 a.pause();assert.equal(a.onlineFlying.hidden,true);a.resumeOnline();assert.equal(a.onlineFlying.hidden,false);
 a.go('home');assert.equal(a.onlineFlying.active,false);b.go('home');
});
test('closing the room screen ignores late network responses',async()=>{
 let finish;const platform={cloud:{callFunction:()=>new Promise(resolve=>finish=resolve)},setStorageSync:()=>{}};
 const c=new FlyingOnlineClient(platform,{envId:'test'},()=>{},timer);const pending=c.enter('create');c.stop();
 finish({result:{ok:true,room:view(createRoom(id,'a','',Date.now()),'a'),serverNow:Date.now()}});await pending;assert.equal(c.room,null);assert.equal(c.active,false);
});
test('root deploy project is a MiniGame and contains the authoritative cloud function',()=>{
 const config=require('../project.config.json');assert.equal(config.compileType,'game');assert.equal(config.cloudfunctionRoot,'cloudfunctions/');
 assert.ok(require('../cloudbaserc.json').functions.some(f=>f.name==='flyingRoom'));
});

test('selected room rules are transmitted, enforced by server and retained for rematches',async()=>{
 const settings={launch:'6',turnSeconds:30,extraTurn:false},s=server();
 const clients=['a','b','c','d'].map(uid=>new FlyingOnlineClient(s.platform(uid),{envId:'test',functionName:'flyingRoom'},()=>{},timer));
 await clients[0].enter('create',undefined,settings);assert.deepEqual(clients[0].room.settings,settings);
 for(const c of clients.slice(1))await c.enter('join',id);
 for(const c of clients){await c.sync();await c.command('ready');assert.deepEqual(c.room.settings,settings);}
 await clients[0].sync();await clients[0].command('start');assert.deepEqual(s.room().game.rules,settings);
 const now=Date.now();assert.ok(s.room().deadline>=now+29000&&s.room().deadline<=now+31000);
 let room=s.room();room=apply(room,'a',{action:'roll',revision:room.revision,requestId:'roll_two_1'},now,()=>.2);
 assert.equal(room.game.die,2);assert.equal(room.game.turn,1); // No takeoff at two.
 room=apply(room,'b',{action:'roll',revision:room.revision,requestId:'roll_six_2'},now,()=>.99);
 room=apply(room,'b',{action:'move',piece:0,revision:room.revision,requestId:'move_six_3'},now,()=>.99);
 assert.equal(room.game.pieces[1][0],0);assert.equal(room.game.turn,2); // Six does not grant another roll.
 room.status='done';room=apply(room,'a',{action:'rematch',revision:room.revision,requestId:'rematch_4'},now,()=>.99);assert.deepEqual(room.game.rules,settings);
 for(const c of clients)c.stop();
});
test('invalid settings are rejected and existing rooms keep original defaults',()=>{
 for(const settings of [{launch:'1'},{turnSeconds:0},{turnSeconds:'60'},{extraTurn:'yes'},null])assert.throws(()=>createRoom(id,'a','',0,settings),e=>e.code==='SETTINGS');
 const room=createRoom(id,'a','',0);delete room.settings;assert.deepEqual(view(room,'a').settings,{launch:'246',turnSeconds:60,extraTurn:true});
 for(const seconds of [30,60,90])assert.equal(createRoom(id,'a','',0,{turnSeconds:seconds}).settings.turnSeconds,seconds);
});
