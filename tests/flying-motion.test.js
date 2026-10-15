'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRoom,apply,view}=require('../cloudfunctions/flyingRoom/service');
const {buildFrames,position}=require('../miniprogram/lib/flying-motion');
const {Flying}=require('../miniprogram/lib/flying-model');
const ID='b'.repeat(32);
const die=n=>(n-0.5)/6;
let sequence=0;
const req=(r,action,extra={})=>({action,revision:r.revision,requestId:'motion_req_'+(++sequence),...extra});
test('each automatic bot roll and move is saved chronologically for all clients',()=>{
 let room=createRoom(ID,'host','真人',0,{launch:'even'},{count:3,difficulty:'normal'});
 room=apply(room,'host',req(room,'ready'),1);
 room=apply(room,'host',req(room,'start'),2);
 room=apply(room,'host',req(room,'roll'),3,()=>die(4));
 room=apply(room,'host',req(room,'move',{piece:0}),4,()=>die(4));
 assert.equal(room.status,'playing');
 assert.equal(room.game.turn,0);
 assert.equal(room.motion.events.filter(e=>e.kind==='roll').length,3);
 assert.equal(room.motion.events.filter(e=>e.kind==='move').length,3);
 assert.deepEqual(room.motion.events.map(e=>e.kind),['roll','move','roll','move','roll','move']);
 const frames=buildFrames(view(room,'host').motion,room.game.colors);
 assert.ok(frames.some(f=>f.kind==='roll'));
 assert.ok(frames.some(f=>f.kind==='step'));
 assert.ok(frames.some(f=>f.kind==='settle'));
 assert.deepEqual(frames.at(-1).pieces,room.game.pieces);
 const older=view(room,'host');
 assert.deepEqual(apply(room,'host',{action:'get'},5),room);
 assert.deepEqual(view(room,'host').motion,older.motion);
});
test('moving four regular cells produces four ordered steps, captures apply after arrival',()=>{
 const before=[[10,-1,-1,-1],[4,-1,-1,-1]],after=[[14,-1,-1,-1],[-1,-1,-1,-1]];
 const motion={events:[{kind:'roll',player:0,die:4},{kind:'move',player:0,piece:0,die:4,from:10,to:14,before,after,segments:[{type:'move',to:14}],captures:[{player:1,piece:0}]}]};
 const frames=buildFrames(motion,['R','B']);
 assert.deepEqual(frames.filter(f=>f.kind==='step').map(f=>f.pieces[0][0]),[11,12,13,14]);
 assert.equal(frames.find(f=>f.kind==='step').pieces[1][0],4);
 assert.deepEqual(frames.at(-1).pieces,after);
});
test('jump is four board cells and flight animates straight across dotted shortcut',()=>{
 const before=[[10,-1,-1,-1],[-1,-1,-1,-1]],after=[[32,-1,-1,-1],[-1,-1,-1,-1]];
 const motion={events:[{kind:'move',player:0,piece:0,die:2,from:10,to:32,before,after,segments:[
  {type:'move',to:12},{type:'jump',to:16},{type:'flight',to:28},{type:'jump',to:32}
 ]}]};
 const frames=buildFrames(motion,['R','B']);
 assert.deepEqual(frames.filter(f=>f.kind==='step').map(f=>f.pieces[0][0]),[11,12,13,14,15,16,29,30,31,32]);
 const flight=frames.filter(f=>f.kind==='flight');
 assert.equal(flight.length,9);
 const a=position(['R','B'],0,0,16),b=position(['R','B'],0,0,28);
 assert.equal(flight.at(-1).point.x,b.x);
 assert.equal(flight.at(-1).point.y,b.y);
 assert.ok(Math.abs(flight[0].point.x-(a.x+(b.x-a.x)/9))<.001);
 assert.deepEqual(frames.at(-1).pieces,after);
});
test('terminal corridor bounce plays forward to center then backwards by remainder',()=>{
 const before=[[55,-1,-1,-1],[-1,-1,-1,-1]],after=[[54,-1,-1,-1],[-1,-1,-1,-1]];
 const frames=buildFrames({events:[{kind:'move',player:0,piece:0,die:5,from:55,to:54,before,after,segments:[{type:'move',to:54}]}]},['R','B']);
 assert.deepEqual(frames.filter(f=>f.kind==='step').map(f=>f.pieces[0][0]),[56,57,56,55,54]);
});
test('missing or malformed history safely produces no playback',()=>{
 assert.deepEqual(buildFrames(null,['R','B']),[]);
 assert.deepEqual(buildFrames({events:null},['R','B']),[]);
 assert.deepEqual(buildFrames({events:[{kind:'move',before:null}]},['R','B']),[]);
});
