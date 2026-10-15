'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Flying,normalizeRules}=require('../src/flying-model');
const paths=require('../src/flying-paths');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
const dice=n=>(n-0.5)/6;
const roll=(game,n)=>{game.random=()=>dice(n);assert.equal(game.roll(),n);};
test('default standard launch only on six; room launch presets work',()=>{
 const normal=new Flying(2);roll(normal,5);assert.deepEqual(normal.legal(),[]);
 const happy=new Flying(2,Math.random,{launch:'fiveSix'});roll(happy,5);
 assert.deepEqual(happy.legal(),[0,1,2,3]);assert.equal(happy.move(0).to,0);
 const even=new Flying(2,Math.random,{launch:'even'});roll(even,4);assert.deepEqual(even.legal(),[0,1,2,3]);
 assert.deepEqual(normalizeRules({launch:'bogus',jump:'yes'}),new Flying(2).rules);
});
test('takeoff does not consume the die or automatically trigger a jump',()=>{
 const g=new Flying(2);roll(g,6);assert.equal(g.move(0).to,0);
 assert.equal(g.turn,0);roll(g,4);assert.equal(g.move(0).to,8);
});
test('same color jump can reach flight marker, then fly 12 and jump 4',()=>{
 const g=new Flying(2);g.pieces[0][0]=10;roll(g,2);
 const move=g.move(0);assert.equal(move.to,32);
 assert.deepEqual(move.events.map(e=>e.type),['move','jump','flight','jump']);
 const direct=new Flying(2);direct.pieces[0][0]=11;roll(direct,5);
 assert.equal(direct.move(0).to,32);
 const off=new Flying(2,Math.random,{jump:false,flight:false});off.pieces[0][0]=10;roll(off,2);
 assert.equal(off.move(0).to,12);
});
test('captures happen on normal landing and jump endpoints',()=>{
 const normal=new Flying(2);normal.pieces[0][0]=1;
 const ring=normal.ringIndex(0,3);
 normal.pieces[1][0]=(ring-paths.colors.B.startIndex+52)%52;
 roll(normal,2);assert.equal(normal.move(0).to,3);assert.equal(normal.pieces[1][0],-1);
 const jumped=new Flying(2,Math.random,{flight:false});jumped.pieces[0][0]=10;
 const end=jumped.ringIndex(0,16);
 jumped.pieces[1][0]=(end-paths.colors.B.startIndex+52)%52;
 roll(jumped,2);assert.equal(jumped.move(0).to,16);assert.equal(jumped.pieces[1][0],-1);
});
test('enemy stacks block travel; collision mutual mode destroys both on exact landing',()=>{
 const g=new Flying(2);g.pieces[0][0]=1;const ring=g.ringIndex(0,3);
 g.pieces[1][0]=g.pieces[1][1]=(ring-paths.colors.B.startIndex+52)%52;
 roll(g,2);assert.deepEqual(g.legal(),[]);assert.equal(g.move(0),false);
 const mutual=new Flying(2,Math.random,{stack:'mutual'});mutual.pieces[0][0]=1;
 mutual.pieces[1][0]=mutual.pieces[1][1]=(ring-paths.colors.B.startIndex+52)%52;
 roll(mutual,2);assert.deepEqual(mutual.legal(),[0]);
 const move=mutual.move(0);assert.equal(move.to,-1);
 assert.deepEqual(mutual.pieces[1].slice(0,2),[-1,-1]);
 const through=new Flying(2,Math.random,{stack:'mutual'});through.pieces[0][0]=0;
 through.pieces[1][0]=through.pieces[1][1]=(ring-paths.colors.B.startIndex+52)%52;
 roll(through,4);assert.equal(through.legal().includes(0),false);
});
test('flight crossing hits the designated enemy home-corridor intersection only',()=>{
 const g=new Flying(4);g.pieces[0][0]=11;g.pieces[1][0]=54;
 roll(g,5);g.move(0);assert.equal(g.pieces[1][0],-1);
 const noCapture=new Flying(4,Math.random,{capture:false});noCapture.pieces[0][0]=11;noCapture.pieces[1][0]=54;
 roll(noCapture,5);noCapture.move(0);assert.equal(noCapture.pieces[1][0],54);
});
test('enemy stacks also block an attempted flight in the middle of its path',()=>{
 const g=new Flying(2);g.pieces[0][0]=10;
 const intermediate=g.ringIndex(0,20);
 const enemy=(intermediate-paths.colors.B.startIndex+52)%52;
 g.pieces[1][0]=g.pieces[1][1]=enemy;
 roll(g,2);const move=g.move(0);
 assert.equal(move.to,16);
 assert.deepEqual(move.events.map(e=>e.type),['move','jump']);
 assert.equal(g.pieces[1][0],enemy);
});
test('overshoot reflects in safe corridor, exact central finish wins',()=>{
 const bounce=new Flying(2);bounce.pieces[0][0]=55;roll(bounce,5);assert.equal(bounce.move(0).to,54);
 const exact=new Flying(2);exact.pieces[0]=[57,57,57,56];roll(exact,1);
 assert.equal(exact.move(3).to,57);assert.equal(exact.winner,0);
 const strict=new Flying(2,Math.random,{bounce:false});strict.pieces[0][0]=55;roll(strict,5);assert.deepEqual(strict.legal(),[]);
});
test('six grants extra rolls; third consecutive six never grants a fourth',()=>{
 const g=new Flying(2);for(let i=0;i<3;i++){roll(g,6);g.move(i);if(i<2)assert.equal(g.turn,0);}
 assert.equal(g.turn,1);assert.equal(g.sixStreak,0);
 const penalty=new Flying(2,Math.random,{threeSix:'returnMoved'});
 for(let i=0;i<3;i++){roll(penalty,6);penalty.move(i);}
 assert.equal(penalty.pieces[0][2],-1);
});
test('room rules persist server-side, are shared and locked after creation',()=>{
 const id='f'.repeat(32);
 const r=createRoom(id,'a','房主',0,{launch:'even',jump:false,flight:false,bounce:false});
 assert.equal(view(r,'a').rules.launch,'even');
 let game=r;for(const uid of ['b','c','d'])game=apply(game,uid,{action:'join'},1);
 let n=0;const req=(action,extra={})=>({action,revision:game.revision,requestId:'rule_test_'+(++n),...extra});
 for(const uid of ['a','b','c','d'])game=apply(game,uid,req('ready'),2);
 game=apply(game,'a',req('start',{rules:{launch:'six'}}),3);
 assert.equal(game.game.rules.launch,'even');assert.equal(game.game.rules.bounce,false);
 game=apply(game,'a',req('roll',{die:6}),4,()=>dice(4));
 assert.equal(game.game.die,4);assert.equal(game.game.phase,'choose');
 game=apply(game,'a',req('move',{piece:0}),5);
 assert.equal(game.game.pieces[0][0],0);
 assert.equal(view(game,'c').rules.jump,false);
});
