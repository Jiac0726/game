'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FlyingChessGame}=require('../src/game-app');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
function setup(){
 const calls=[],draw=[];
 const ctx=new Proxy({drawImage:(...args)=>draw.push(args)},{
  get:(t,k)=>k in t?t[k]:(()=>{}),
  set:(t,k,v)=>(t[k]=v,true)
 });
 const canvas={getContext:()=>ctx,width:375,height:812};
 const wx={
  createCanvas:()=>canvas,
  getWindowInfo:()=>({windowWidth:375,windowHeight:812,pixelRatio:1}),
  createImage:()=>({set src(v){calls.push(v);}}),
  setStorageSync(){},removeStorageSync(){},getStorageSync:()=>null,
  shareAppMessage:data=>calls.push(data)
 };
 const app=new FlyingChessGame(wx);
 Object.assign(app,{canvas,ctx,pixelRatio:1,width:375,height:812,scale:1,dx:0,dy:0});
 return {app,calls,draw};
}
test('standalone Canvas home/setup and local 3-AI route render without WXML',()=>{
 const {app,calls}=setup();
 assert.doesNotThrow(()=>app.render());
 assert.ok(app.buttons.some(x=>x.action));
 app.setup(false);
 assert.doesNotThrow(()=>app.render());
 app.localStart();
 assert.equal(app.scene,'local');
 assert.equal(app.local.colors.length,4);
 assert.equal(app.local.pieces[0].length,4);
 assert.doesNotThrow(()=>app.render());
 assert.ok(calls.some(x=>typeof x==='string'&&x.includes('/assets/FLYING/FG-BOARD-001.png')));
 const turn=app.local.turn;
 app.roll();
 assert.ok(app.local.die>=0&&app.local.die<=6);
 assert.equal(turn,0);
});
test('cloud multiplayer uses same authoritative room service and native game share query',async()=>{
 const {app,calls}=setup();
 let room,sequence=0;
 app.api={
  call:async(action,data)=>{
   const now=Date.now();
   if(action==='create')room=createRoom('a'.repeat(32),'owner',data.name,now,data.rules,data.bots);
   else if(action!=='get'){
    sequence++;
    room=apply(room,'owner',Object.assign({action,revision:data.revision,requestId:data.requestId},data),now,()=>.999);
   }
   return {ok:true,room:view(room,'owner'),serverNow:now};
  }
 };
 try{
  app.botCount=3; // The host explicitly chooses AI for this 1v3 test.
  await app.createRoom();
  assert.equal(app.message,'','successful room creation must clear loading text');
  assert.equal(app.busy,false,'successful room creation must unlock UI');
  assert.equal(app.room.status,'waiting');
  assert.equal(app.room.seats.filter(Boolean).length,4);
  assert.equal(app.room.seats[0].ready,false);
  await app.command('ready');
  assert.equal(app.room.seats[0].ready,true);
  await app.command('start');
  assert.equal(app.room.status,'playing');
  assert.equal(app.room.game.turn,0);
  assert.doesNotThrow(()=>app.render());
  await app.share();
  const shared=calls.find(x=>x&&typeof x==='object'&&x.query);
  assert.equal(shared.query,'roomId='+app.roomId);
  await app.command('roll');
  assert.ok(app.room.lastRoll&&app.room.lastRoll.die>=1);
 }finally{
  clearTimeout(app.timer);
  app.hidden=true;
 }
});
test('mini-game controller opens rooms directly from shared launch query',()=>{
 const {app}=setup();
 let id='';
 app.joinRoom=value=>{id=value;};
 const roomId='b'.repeat(32);
 app.openShare({roomId});
 assert.equal(id,roomId);
 app.openShare({roomId:'../../invalid'});
 assert.equal(id,roomId);
});

test('new multiplayer lobby defaults to three open human invitation seats',()=>{
 const {app}=setup();
 assert.equal(app.botCount,0);
 const room=createRoom('f'.repeat(32),'host','房主',Date.now(),app.rules,
  {count:app.botCount,difficulty:app.difficulty});
 assert.equal(room.seats.filter(Boolean).length,1);
 assert.equal(room.seats.filter(s=>s===null).length,3);
});

test('CloudDB failure opens detailed copyable dialog without polling popups',()=>{
 const {app}=setup();
 let shown,clipboard;
 app.wx.showModal=opts=>{shown=opts;};
 app.wx.setClipboardData=opts=>{clipboard=opts.data;};
 const e=Object.assign(new Error('云数据库事务操作失败（-502001）'),{
  code:'DATABASE',stage:'transaction',action:'ready',
  dbCode:'-502001',detail:"Cannot create field 'colors' in element {game: null}"
 });
 app.reportCloudError(e,'ready');
 assert.equal(app.message,e.message);
 assert.equal(shown.title,'云数据库错误详情');
 assert.match(shown.content,/ready/);
 assert.match(shown.content,/transaction/);
 assert.match(shown.content,/-502001/);
 assert.match(shown.content,/Cannot create field/);
 shown.success({confirm:true});
 assert.match(clipboard,/Cannot create field/);
});
test('CloudDB production error dialog suggests turning on temporary diagnostics',()=>{
 const {app}=setup();
 let dialog;
 app.wx.showModal=opts=>{dialog=opts;};
 app.reportCloudError(Object.assign(new Error('云数据库读取失败'),{
  code:'DATABASE',stage:'get',action:'get',dbCode:'SERVER'
 }),'get');
 assert.match(dialog.content,/FLYING_ROOM_DEBUG=1/);
 assert.ok(!dialog.content.includes('undefined'));
});
