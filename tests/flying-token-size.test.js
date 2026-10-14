'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {install}=require('../src/flying-ui');
const {Flying}=require('../src/flying-model');
const artLayout=require('../src/flying-art-layout');

test('same-screen flying sprites are 36px and centered over the calibrated board',()=>{
 class StubApp {
  go(screen){this.screen=screen;}
  render(){} update(){} pause(){} cancel(){}
 }
 install(StubApp);
 const app=new StubApp(),draws=[];
 app.flyingCount=2;app.flyingBotCount=0;app.assetFiles={};app.platform={};
 app.newFlying();
 app.rect=()=>{};app.text=()=>{};app.circle=()=>{};app.button=()=>{};
 app.drawFlyingDie=()=>{};
 app.ctx={beginPath(){},arc(){},stroke(){}};
 const bounds={x:27,y:183,width:321,height:357};
 app.drawAsset=()=>({status:'ready',bounds});
 app.flyingArt=(id,x,y,width,height)=>{
  if(id.startsWith('FG-TOKEN-'))draws.push({id,x,y,width,height});
  return true;
 };
 app.flyingBoard();
 assert.equal(draws.length,8);
 assert.ok(draws.every(v=>v.width===36&&v.height===36),'all token images should be 2x their former size');
 const expected=artLayout.project(app.flying.position(0,0),bounds);
 assert.ok(Math.abs(draws[0].x+18-expected.x)<1e-6);
 assert.ok(Math.abs(draws[0].y+18-expected.y)<1e-6);
});

test('multiplayer board draws 36px tokens and accepts a tap near the enlarged edge',()=>{
 let page;
 const roomDir=path.resolve(__dirname,'../online/miniprogram/pages/room');
 vm.runInNewContext(fs.readFileSync(path.join(roomDir,'room.js'),'utf8'),{
  Page:p=>{page=p;},
  require:request=>request==='../../lib/api'?{call:async()=>({})}:require(path.resolve(roomDir,request)),
  wx:{},console,Date,Math,setTimeout,clearTimeout
 });
 const drawn=[],commands=[];
 const ctx={
  drawImage(...args){drawn.push(args);},
  clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},stroke(){},fillText(){},strokeRect(){}
 };
 const g=new Flying(4);g.phase='choose';g.die=6;
 const board={width:851,height:946};
 const client=Object.assign({},page,{
  ctx,size:345,hidden:false,
  data:{room:{game:g},legal:[0],myTurn:true,rolling:false,busy:false},
  asset(id){if(id==='FG-BOARD-001')return board;if(id.startsWith('FG-TOKEN-'))return{id};return null;},
  command(action,payload){commands.push({action,payload});}
 });
 client.draw();
 const pieces=drawn.filter(a=>a.length===5&&a[0].id&&a[0].id.startsWith('FG-TOKEN-'));
 assert.equal(pieces.length,16);
 assert.ok(pieces.every(a=>a[3]===36&&a[4]===36),'multiplayer sprite sizes');
 assert.ok(client.hit.length>=1);
 const hit=client.hit[0];
 client.boardTap({changedTouches:[{x:hit.x+20,y:hit.y}]});
 assert.equal(commands[0].action,'move');
 assert.equal(commands[0].payload.piece,hit.piece);
});
