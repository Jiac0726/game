'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Flying}=require('../miniprogram/lib/flying-model');
const {chooseMove,normalizeDifficulty,threatProbability}=require('../cloudfunctions/flyingRoom/lib/flying-ai');
const paths=require('../miniprogram/lib/flying-paths');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
const ID='e'.repeat(32);
let seq=0;
function request(room,action,extra={}){
 return {action,revision:room.revision,requestId:'bot_req_'+(++seq),...extra};
}
function die(number){return (number-.5)/6;}
test('AI modes random, prioritize captures, and evaluate opponent counter-captures',()=>{
 const g=new Flying(2);g.turn=0;g.phase='choose';g.die=2;
 g.pieces[0]=[1,7,-1,-1];
 g.pieces[1][0]=(g.ringIndex(0,3)-paths.colors.B.startIndex+52)%52;
 assert.equal(chooseMove(g,'easy',()=>.7),1);
 assert.equal(chooseMove(g,'normal',()=>0),0);
 assert.equal(normalizeDifficulty('invalid'),'normal');
 const safe=new Flying(2);safe.turn=0;safe.phase='choose';safe.die=1;
 safe.pieces[0]=[10,20,-1,-1];safe.pieces[1][0]=36;
 assert.equal(chooseMove(safe,'normal',()=>0),0);
 assert.ok(threatProbability(safe,safe.plan(0))>0);
 assert.equal(threatProbability(safe,safe.plan(1)),0);
 assert.equal(chooseMove(safe,'hard',()=>0),1);
});
test('AI only selects legal moves and never changes dice or state during analysis',()=>{
 const g=new Flying(4,()=>0);g.phase='choose';g.die=1;
 g.pieces[0]=[56,55,57,-1];
 const snapshot=JSON.stringify(g.pieces),dieValue=g.die;
 for(const level of ['easy','normal','hard']){
  const candidate=chooseMove(g,level,()=>.75);
  assert.ok(g.legal().includes(candidate));
 }
 assert.equal(JSON.stringify(g.pieces),snapshot);
 assert.equal(g.die,dieValue);
 const stuck=new Flying(2);stuck.phase='choose';stuck.die=1;
 assert.equal(chooseMove(stuck,'hard',()=>.5),null);
});
test('one human can create room with three AI and start an immediate full game',()=>{
 let room=createRoom(ID,'host','人类',100,{launch:'even'}, {count:3,difficulty:'hard'});
 assert.equal(room.seats.filter(s=>s&&s.bot).length,3);
 assert.equal(view(room,'host').seats.filter(s=>s&&s.bot).length,3);
 assert.ok(view(room,'host').seats.every(s=>s));
 assert.ok(view(room,'host').seats.every(s=>!('uid' in s)));
 room=apply(room,'host',request(room,'ready'),110);
 room=apply(room,'host',request(room,'start'),120);
 assert.equal(room.status,'playing');assert.equal(room.game.turn,0);
 room=apply(room,'host',request(room,'roll'),121,()=>die(1));
 assert.equal(room.game.turn,0);
 assert.equal(room.game.phase,'roll');
 assert.ok(room.lastRoll.bot);
 assert.equal(room.seats[3].difficulty,'hard');
 assert.equal(room.game.colors.length,4);
});
test('bot moves are server-side, preserve turn order, have no human UID and retry idempotently',()=>{
 let room=createRoom(ID,'host','人类',0,{launch:'even'}, {count:3,difficulty:'normal'});
 room=apply(room,'host',request(room,'ready'),1);
 room=apply(room,'host',request(room,'start'),2);
 const roll=request(room,'roll');
 room=apply(room,'host',roll,3,()=>die(4));
 assert.equal(room.game.die,4);assert.equal(room.game.turn,0);
 const move=request(room,'move',{piece:0});
 room=apply(room,'host',move,4,()=>die(4));
 assert.equal(room.game.turn,0);assert.equal(room.game.phase,'roll');
 assert.ok(room.lastRoll.bot);
 assert.equal(room.lastMove.bot,true);
 const before=JSON.stringify(room);
 assert.equal(JSON.stringify(apply(room,'host',move,5,()=>die(1))),before);
 assert.throws(()=>apply(room,'_flying_ai_3',{action:'get'},6),x=>x.code==='FORBIDDEN');
});
test('host can replace AI with friends and reject unauthorized or too many bots',()=>{
 let room=createRoom(ID,'a','房主',0,{}, {count:3,difficulty:'easy'});
 assert.throws(()=>apply(room,'b',request(room,'setBots',{count:0,difficulty:'normal'}),1),x=>x.code==='FORBIDDEN');
 room=apply(room,'a',request(room,'setBots',{count:1,difficulty:'hard'}),1);
 assert.equal(room.seats.filter(p=>p&&p.bot).length,1);
 room=apply(room,'b',{action:'join',name:'玩家2'},2);
 room=apply(room,'c',{action:'join',name:'玩家3'},2);
 assert.equal(room.seats.filter(p=>p&&!p.bot).length,3);
 assert.throws(()=>apply(room,'b',request(room,'setBots',{count:1,difficulty:'easy'}),3),x=>x.code==='HOST');
 assert.throws(()=>apply(room,'a',request(room,'setBots',{count:2,difficulty:'easy'}),3),x=>x.code==='FULL');
 room=apply(room,'a',request(room,'setBots',{count:1,difficulty:'normal'}),4);
 assert.equal(room.seats.filter(p=>p&&p.bot).length,1);
 assert.equal(room.seats.find(p=>p&&p.bot).difficulty,'normal');
 assert.equal(room.seats.filter(p=>p&&!p.bot).length,3);
});
test('bot roster cannot change after start, rematch retains original computer seats',()=>{
 let room=createRoom(ID,'a','host',0,{}, {count:3,difficulty:'easy'});
 room=apply(room,'a',request(room,'ready'),1);
 room=apply(room,'a',request(room,'start'),2);
 assert.throws(()=>apply(room,'a',request(room,'setBots',{count:0,difficulty:'normal'}),3),x=>x.code==='STARTED');
 room.status='done';room.game.phase='done';room.game.winner=0;
 room=apply(room,'a',request(room,'rematch'),4);
 assert.equal(room.game.winner,null);
 assert.equal(room.status,'playing');
 assert.equal(room.seats.filter(p=>p&&p.bot).length,3);
 assert.equal(room.seats.filter(p=>p&&p.bot).every(p=>p.difficulty==='easy'),true);
});
test('invalid robot configurations do not silently change room state',()=>{
 assert.throws(()=>createRoom(ID,'a','',0,{}, {count:4,difficulty:'easy'}),x=>x.code==='BOTS');
 assert.throws(()=>createRoom(ID,'a','',0,{}, {count:2,difficulty:'cheat'}),x=>x.code==='BOTS');
 let room=createRoom(ID,'a','',0);
 const original=JSON.stringify(room);
 assert.throws(()=>apply(room,'a',request(room,'setBots',{count:-1,difficulty:'easy'}),1),x=>x.code==='BOTS');
 assert.equal(JSON.stringify(room),original);
});
