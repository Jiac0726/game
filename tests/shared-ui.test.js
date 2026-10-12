'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {App}=require('../src/app'),{PAGES}=require('../src/interface');
function app(width=375,height=812){const ctx=new Proxy({measureText:s=>({width:String(s).length*7})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});return new App({getContext:()=>ctx},{windowWidth:width,windowHeight:height},{getStorageSync:()=>null,setStorageSync:()=>{}});}
test('all legacy gallery pages and flying scenes render with the shared runtime',()=>{for(const [id]of PAGES){const a=app();a.previewPage(id);assert.ok(a.buttons.length,id);}for(const id of ['flyingSetup','flyingLocalSetup','flyingBoard']){const a=app();if(id==='flyingBoard')a.newFlying();else a.go(id);a.render();assert.ok(a.buttons.length,id);}});
test('back controls have identical painted and hit bounds across settings, games and flying',()=>{for(const id of ['settings','records','levels','blocks','fruit','line','brick','reaction','gomoku','flyingSetup','flyingLocalSetup','flyingBoard']){const a=app();if(id==='flyingBoard')a.newFlying();else if(id.startsWith('flying'))a.go(id);else a.previewPage(id);a.render();const b=a.buttons.find(b=>b.label==='‹ 返回');assert.ok(b,id);assert.deepEqual(b.bounds,{x:274,y:27,width:77,height:44},id);}});
test('shared navigation uses correct coordinates after uniform scaling and letterboxing',()=>{for(const [w,h]of [[320,690],[375,812],[430,932],[812,375]]){const a=app(w,h);a.previewPage('single');const b=a.buttons.find(b=>b.label==='个人'&&b.y===744);assert.ok(b);a.pointer('down',a.ox+(b.x+b.w/2)*a.scale,a.oy+(b.y+b.h/2)*a.scale,1);assert.equal(a.tab,'个人');a.render();assert.equal(a.screen,'home');}});

test('rolling and settled dice retain the same body bounds for every result',()=>{
 const a=app(),bodies=[];a.rect=(x,y,w,h)=>bodies.push({x,y,w,h});a.circle=()=>{};
 for(const value of [1,2,3,4,5,6])for(const remaining of [1.28,1,.64,.08,0])a.drawFlyingDiceState(value,remaining);
 assert.equal(bodies.length,30);for(const body of bodies)assert.deepEqual(body,{x:41,y:563,w:60,h:60});
 const pips=[];a.circle=(...args)=>pips.push(args);a.drawFlyingDiceState(6,0);assert.equal(pips.length,6);
});
