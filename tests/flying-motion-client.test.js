'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRoom,apply,view}=require('../online/cloudfunctions/flyingRoom/service');
const ROOT=path.resolve(__dirname,'../online/miniprogram/pages/room');
const ID='c'.repeat(32);
let serial=0;
const req=(room,action,extra={})=>({action,requestId:'motion_ui_'+(++serial),revision:room.revision,...extra});
function makeClient(){
 let options,clock=0;
 const jobs=new Map();
 const setTimeoutFake=fn=>{const id=++clock;jobs.set(id,fn);return id;};
 const clearTimeoutFake=id=>jobs.delete(id);
 const wx={getStorageSync(){return null;},setStorageSync(){},removeStorageSync(){}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'room.js'),'utf8'),{
  Page:definition=>{options=definition;},
  require:p=>p==='../../lib/api'?{call:async()=>({})}:require(path.resolve(ROOT,p)),
  wx,console,setTimeout:setTimeoutFake,clearTimeout:clearTimeoutFake,Date,Math
 });
 const client=Object.assign({},options,{
  data:JSON.parse(JSON.stringify(options.data)),hidden:false,images:{},offset:0,roomId:ID,
  setData(values){Object.assign(this.data,values);}
 });
 function tick(){
  const [id,fn]=jobs.entries().next().value||[];
  if(!fn)return false;
  jobs.delete(id);fn();return true;
 }
 return {client,tick,jobs};
}
function robotRoom(){
 let room=createRoom(ID,'host','真人',100,{launch:'even'},{count:3,difficulty:'normal'});
 room=apply(room,'host',req(room,'ready'),101);
 room=apply(room,'host',req(room,'start'),102);
 const initial=view(room,'host');
 room=apply(room,'host',req(room,'roll'),103,()=>.59);
 room=apply(room,'host',req(room,'move',{piece:0}),104,()=>.59);
 return {initial,final:view(room,'host')};
}
test('connected clients play each bot frame in order, never replay same revision',()=>{
 const {client,tick,jobs}=makeClient(),{initial,final}=robotRoom();
 client.accept({room:initial,serverNow:Date.now()});
 client.accept({room:final,serverNow:Date.now()});
 assert.equal(client.botAnimating,true);
 assert.equal(client.data.botAnimating,true);
 assert.ok(client.motionQueue.length>3);
 assert.equal(client.data.myTurn,true);
 const firstRemaining=client.motionQueue.length;
 client.accept({room:final,serverNow:Date.now()});
 assert.equal(client.motionQueue.length,firstRemaining);
 let count=0,hadIntermediate=false;
 while(jobs.size && count++<350){
  if(client.animationBoard&&JSON.stringify(client.animationBoard)!==JSON.stringify(final.game.pieces))hadIntermediate=true;
  tick();
 }
 assert.ok(count>10);assert.ok(hadIntermediate);
 assert.equal(client.botAnimating,false);
 assert.equal(client.data.botAnimating,false);
 assert.equal(client.animationBoard,null);
 assert.equal(client.motionQueue.length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(client.data.room.game.pieces)),JSON.parse(JSON.stringify(final.game.pieces)));
});
test('skip and background hide cancel all pending bot animation timers',()=>{
 const {client,jobs}=makeClient(),{initial,final}=robotRoom();
 client.accept({room:initial,serverNow:Date.now()});
 client.accept({room:final,serverNow:Date.now()});
 assert.ok(jobs.size>0);
 client.skipBotMotion();
 assert.equal(client.botAnimating,false);assert.equal(client.animationBoard,null);
 assert.equal(jobs.size,0);
 client.hidden=false;
 const changed={...final,revision:final.revision+1,motion:{id:'new_motion_id',events:final.motion.events}};
 client.accept({room:changed,serverNow:Date.now()});
 assert.equal(client.botAnimating,true);
 client.onHide();
 assert.equal(client.botAnimating,false);
 assert.equal(jobs.size,0);
});
