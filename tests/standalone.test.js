'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
test('standalone WeChat miniprogram has correct root and no bundled mini-game',()=>{
 const p=JSON.parse(read('project.config.json'));
 assert.equal(p.compileType,'miniprogram');
 assert.equal(p.miniprogramRoot,'miniprogram/');
 assert.equal(p.cloudfunctionRoot,'cloudfunctions/');
 assert.ok(!fs.existsSync(path.join(root,'game.js')));
 assert.ok(fs.existsSync(path.join(root,'miniprogram/app.wxss')));
 assert.ok(fs.existsSync(path.join(root,'cloudfunctions/flyingRoom/index.js')));
});
test('wxss contains only valid real linebreaks (no literal escaped newlines)',()=>{
 const css=read('miniprogram/app.wxss');
 assert.ok(!css.includes('\\n'));
 assert.ok(css.includes('.rule-row'));
});
test('shared four-seat gameplay and independent cloud-room rules are importable',()=>{
 const {Flying}=require('../miniprogram/lib/flying-model');
 const {createRoom}=require('../cloudfunctions/flyingRoom/service');
 const room=createRoom('a'.repeat(32),'owner','房主',Date.now(),undefined,{count:3,difficulty:'normal'});
 assert.equal(room.seats.filter(Boolean).length,4);
 assert.equal(new Flying(4).colors.length,4);
});
test('remote handdrawn image paths are independent of the mini-game asset pipeline',()=>{
 const map=require('../miniprogram/lib/flying-assets').files;
 const config=require('../miniprogram/config');
 assert.equal(config.assetBaseUrl,'https://www.gskj.cloud/game-assets/v1');
 for(const id of ['FG-BOARD-001','FG-TOKEN-R','FG-DICE-00','FG-AIRPORT-G']){
  assert.match(map[id],/^assets\/FLYING\//);
 }
});
