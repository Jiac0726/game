'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {FlyingChessGame}=require('../src/game-app');
const cfg=require('../project.config.json');
test('standalone independent mini-game project, no nested app.wxss or WXML',()=>{
 assert.equal(cfg.compileType,'game');
 assert.equal(cfg.miniprogramRoot,undefined);
 assert.equal(typeof FlyingChessGame,'function');
 assert.ok(fs.existsSync('game.js'));
 assert.ok(!fs.existsSync('miniprogram'));
 assert.ok(!fs.existsSync('app.wxss'));
});
test('cloud functions not bundled and remote assets preserved',()=>{
 assert.ok(cfg.packOptions.ignore.some(x=>x.value==='cloudfunctions'));
 const src=require('../src/config');
 const imgs=require('../src/flying-assets').files;
 assert.equal(src.assetBaseUrl,'https://www.gskj.cloud/game-assets/v1');
 assert.match(imgs['FG-BOARD-001'],/^assets\/FLYING/);
 assert.ok(imgs['FG-TOKEN-R']);
});
