'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=require('../src/flying-assets'),online=require('../online/miniprogram/lib/flying-assets');
const layout=require('../src/flying-art-layout'),paths=require('../src/flying-paths');
test('both clients resolve all flying assets to the uploaded Canva directory',()=>{
  assert.deepEqual(assets,online);
  for(const file of Object.values(assets.files))assert.ok(file.startsWith('assets/CANVA_SPLIT_20261012/'));
  for(const color of 'YBRG')assert.ok(assets.files['FG-TOKEN-'+color]);
  assert.equal(new Set(Array.from({length:16},(_,i)=>assets.files['FG-DICE-'+String(i).padStart(2,'0')])).size,1);
});
test('render calibration keeps airports in their panels and all routes inside the board',()=>{
  const onlineLayout=require('../online/miniprogram/lib/flying-art-layout');
  for(const point of paths.ring)assert.deepEqual(layout.sourcePoint(point),onlineLayout.sourcePoint(point));
  const bounds={x:10,y:20,width:321,height:357};
  for(const color of Object.keys(paths.colors)){
    const panel=layout.airportBounds(color,bounds);
    for(const point of paths.colors[color].airport){const p=layout.project(point,bounds);assert.ok(p.x>panel.x&&p.x<panel.x+panel.width&&p.y>panel.y&&p.y<panel.y+panel.height);}
    for(const point of [...paths.ring,...paths.colors[color].home]){const p=layout.project(point,bounds);assert.ok(p.x>=bounds.x&&p.x<=bounds.x+bounds.width&&p.y>=bounds.y&&p.y<=bounds.y+bounds.height);}
  }
  assert.deepEqual(layout.sourcePoint(paths.colors.Y.home[5]),{x:426,y:490});
});
test('online canvas hit targets use calibrated image positions, and dice aliases share one image',()=>{
  let page;const filename=path.resolve(__dirname,'../online/miniprogram/pages/room/room.js');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{Page:p=>page=p,require:id=>require(path.resolve(path.dirname(filename),id)),wx:{},setTimeout,clearTimeout});
  const noop=()=>{},ctx=new Proxy({}, {get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  const {Flying}=require('../src/flying-model');const game=new Flying(4);game.phase='choose';game.die=6;
  const instance={...page,data:{room:{game},myTurn:true,legal:[0,1,2,3]},ctx,size:375,images:{},canvas:{createImage:()=>({})}};
  // Preloaded image records use URL paths, preserving one cache entry per resource.
  for(const file of Object.values(assets.files))instance.images[file]={image:{},ready:true};
  instance.draw();assert.equal(instance.hit.length,4);
  const expected=layout.project(game.position(0,0),{x:0,y:0,width:375,height:375});
  assert.equal(instance.hit[0].x,expected.x);assert.equal(instance.hit[0].y,expected.y);
  assert.equal(instance.asset('FG-DICE-00'),instance.asset('FG-DICE-15'));
});
