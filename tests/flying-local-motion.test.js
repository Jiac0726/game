'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {install}=require('../src/flying-ui');
const {Flying}=require('../src/flying-model');
class FakeApp {
 update(){}
 pause(){}
 render(){}
 go(screen){this.screen=screen;}
 cancel(){}
}
install(FakeApp);
function make(){
 const app=new FakeApp();
 app.flyingCount=2;app.flyingBotCount=1;app.flyingBotDifficulty='normal';
 app.assetFiles={};app.platform={};app.newFlying();
 return app;
}
test('same-screen AI uses animation frames rather than instantly displaying final state',()=>{
 const app=make();
 app.flying.turn=1;app.flying.phase='choose';app.flying.die=2;
 app.flying.pieces[1]=[10,57,57,57];
 app.flyingBotDelay=0;
 app.update(.1);
 assert.equal(app.flying.pieces[1][0],32);
 assert.ok(app.flyingMotionQueue.length>8);
 assert.equal(app.flyingMotionFrame,null);
 app.update(.001);
 assert.ok(app.flyingMotionFrame);
 assert.notEqual(app.flyingMotionFrame.pieces[1][0],32);
 const visited=[];
 for(let i=0;i<80 && (app.flyingMotionFrame||app.flyingMotionQueue.length);i++){
  if(app.flyingMotionFrame)visited.push(app.flyingMotionFrame.pieces[1][0]);
  app.update(.12);
 }
 assert.ok(visited.includes(11));assert.ok(visited.includes(12));assert.ok(visited.includes(16));
 assert.equal(app.flyingMotionFrame,null);
 assert.equal(app.flyingMotionQueue.length,0);
 assert.equal(app.flying.pieces[1][0],32);
 assert.equal(app.flying.turn,0);
});
test('pause freezes robot movement animation; resume continues without reroll',()=>{
 const app=make();app.flying.turn=1;app.flying.phase='choose';app.flying.die=2;
 app.flying.pieces[1]=[10,57,57,57];
 app.flyingBotDelay=0;app.update(.1);app.update(.001);
 const frame=app.flyingMotionFrame,die=app.flying.die;
 app.paused=true;app.update(.8);
 assert.equal(app.flyingMotionFrame,frame);assert.equal(app.flying.die,die);
 app.paused=false;app.update(.2);
 assert.notEqual(app.flyingMotionFrame,frame);
});
test('human controls remain unavailable while the bot movement is replaying',()=>{
 const app=make();
 app.flying.turn=1;app.flying.phase='choose';app.flying.die=2;
 app.flying.pieces[1]=[10,57,57,57];
 app.flyingBotDelay=0;app.update(.1);app.update(.001);
 app.buttons=[];
 app.rect=()=>{};app.text=()=>{};app.circle=()=>{};
 app.flyingArt=()=>false;app.drawFlyingDie=()=>{};
 app.button=function(label){this.buttons.push(label);};
 app.ctx={beginPath(){},arc(){},stroke(){}};
 app.flyingBoard();
 assert.equal(app.buttons.some(label=>label.startsWith('飞机 ')||label==='掷骰子'),false);
});
