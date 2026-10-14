'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Flying}=require('../src/flying-model'),paths=require('../src/flying-paths');
test('52 ring nodes, split corners, home and airport routes stay within board',()=>{
  assert.equal(paths.ring.length,52);assert.equal(new Set(paths.ring.map(p=>p.id)).size,52);
  for(const color of Object.values(paths.colors)){
    assert.equal(color.pathIds.length,58);assert.equal(color.home.length,6);assert.equal(color.airport.length,4);
    assert.equal(color.pathIds[51],paths.ring[color.gateIndex].id);
    for(const p of [...paths.ring,...color.home,...color.airport])assert.ok(p.x>=0&&p.x<=1254&&p.y>=0&&p.y<=1254);
  }
});
test('launch, move choice, pass and extra turn honor dice state',()=>{
  const g=new Flying(4,()=>0);assert.equal(g.roll(),1);assert.deepEqual(g.legal(),[]);assert.equal(g.roll(),false);g.pass();assert.equal(g.turn,1);
  g.random=()=>.99;assert.equal(g.roll(),6);assert.deepEqual(g.legal(),[0,1,2,3]);g.move(0);assert.equal(g.turn,1);assert.equal(g.pieces[1][0],0);assert.equal(g.move(1),false);
  g.random=()=>.3;g.roll();g.move(0);assert.equal(g.pieces[1][0],2);assert.equal(g.turn,2);
});
test('finish by exact roll, winning four planes and outer ring capture',()=>{
  const g=new Flying(2,()=>0);g.pieces[0]=[57,57,57,56];g.roll();assert.deepEqual(g.legal(),[3]);g.move(3);assert.equal(g.winner,0);assert.equal(g.phase,'done');assert.equal(g.roll(),false);
  const h=new Flying(2,()=>0);h.pieces[0][0]=2;
  const target=h.ringIndex(0,3);h.pieces[1][0]=(target-paths.colors.B.startIndex+52)%52;
  h.roll();h.move(0);assert.equal(h.pieces[1][0],-1);
});
test('party entry opens setup and board; rolling blocks moves; pause freezes animation',()=>{
  const {App}=require('../src/app');const ctx=new Proxy({measureText:s=>({width:s.length*9})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  for(const [w,h] of [[320,568],[375,812],[430,932]]){
    const a=new App({getContext:()=>ctx},{windowWidth:w,windowHeight:h},{getStorageSync:()=>null,setStorageSync:()=>{}});
    a.render();a.mode='派对';a.render();a.buttons.find(b=>b.label==='一起玩飞行棋').fn();assert.equal(a.screen,'flyingSetup');a.render();a.buttons.find(b=>b.label==='开始飞行棋').fn();a.render();assert.equal(a.screen,'flyingBoard');
    a.flying.random=()=>.99;a.rollFlying();a.render();assert.ok(!a.buttons.some(b=>b.label.startsWith('飞机 ')));a.pause();a.update(.5);assert.equal(a.flyingRolling,1.28);a.paused=false;a.update(1.28);a.render();assert.equal(a.buttons.filter(b=>b.label.startsWith('飞机 ')).length,4);
    for(const b of a.buttons)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=375&&b.y+b.h<=812);
  }
});
