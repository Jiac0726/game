'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FlyingChessGame}=require('../src/game-app');
const {createRoom,view}=require('../cloudfunctions/flyingRoom/service');
const {createHandler}=require('../cloudfunctions/flyingRoom/index');

function setup(count=3){
 const labels=[],shares=[];
 const ctx=new Proxy({fillText:(...args)=>labels.push(args)},{
  get:(obj,key)=>key in obj?obj[key]:(()=>{}),
  set:(obj,key,v)=>(obj[key]=v,true)
 });
 const wx={
  createImage:()=>null,
  shareAppMessage:args=>shares.push(args),
  setStorageSync(){},removeStorageSync(){},getStorageSync(){return null;}
 };
 const app=new FlyingChessGame(wx);
 Object.assign(app,{
  canvas:{width:375,height:812},ctx,scene:'room',
  scale:1,pixelRatio:1,dx:0,dy:0,
  botCount:count
 });
 const state=createRoom('a'.repeat(32),'host','房主',Date.now(),null,
  {count,difficulty:'normal'});
 app.room=view(state,'host');app.roomId=state.id;
 return {app,labels,shares};
}
test('waiting room title renders below WeChat capsule and has tappable back',()=>{
 const {app,labels}=setup();
 app.render();
 const title=labels.find(x=>x[0]==='好友联机 · 等待开局');
 assert.ok(title);
 assert.ok(title[2]>=100,'title must clear WeChat top system controls');
 assert.ok(app.buttons.some(x=>x.y===31&&x.x===16),'back remains usable');
});
test('host with 3 bots is told to reduce AI before inviting other players',async()=>{
 const {app,labels,shares}=setup(3);
 app.render();
 const invite=app.buttons.find(x=>x.y===677);
 assert.ok(invite);
 assert.ok(labels.some(x=>String(x[0]).includes('座位已满')));
 await invite.action();
 assert.equal(shares.length,0);
 assert.match(app.message,/减少 AI/);
});
test('host with spare seats can invite and unknown mutation can be retried',async()=>{
 const {app,shares}=setup(0);
 app.render();
 const invite=app.buttons.find(x=>x.y===677);
 assert.ok(invite);
 await invite.action();
 assert.equal(shares.length,1);
 assert.equal(shares[0].query,'roomId='+'a'.repeat(32));
 let retried=0;
 app.pending={action:'ready',requestId:'abc12345'};
 app.sendPending=()=>{retried++;};
 app.render();
 app.buttons.find(x=>x.y===677).action();
 assert.equal(retried,1);
});
test('database read failure reports read stage without returning raw SDK error',async()=>{
 const logs=[];
 const db={
  collection:()=>({doc:()=>({get:async()=>{throw Object.assign(
   Error('sample secret connection path'),{code:'SDK_DB_DENIED'});}})}),
  runTransaction:()=>{}
 };
 const handler=createHandler({
  getUID:()=> 'host',
  getDB:()=>db,
  logger:{error:(...args)=>logs.push(args)}
 });
 const res=await handler({action:'get',roomId:'a'.repeat(32)});
 assert.equal(res.ok,false);
 assert.equal(res.code,'DATABASE');
 assert.match(res.message,/读取失败/);
 assert.ok(!res.message.includes('sample secret'));
 assert.equal(logs[0][1].stage,'get');
 assert.equal(logs[0][1].code,'SDK_DB_DENIED');
});
