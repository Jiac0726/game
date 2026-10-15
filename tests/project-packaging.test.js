'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));

test('mini-game package excludes nested miniprogram WXSS/WXML sources',()=>{
 const project=json('project.config.json');
 assert.equal(project.compileType,'game');
 const ignored=project.packOptions&&project.packOptions.ignore||[];
 assert.ok(ignored.some(item=>item.type==='folder'&&item.value==='online'),
  'WeChat mini-game must not bundle nested online/miniprogram app.wxss');
 assert.ok(fs.existsSync(path.join(root,'online','miniprogram','app.wxss')),
  'source stays in repository while excluded from mini-game package');
 const online=json('online/project.config.json');
 assert.equal(online.compileType,'miniprogram');
 assert.equal(online.miniprogramRoot,'miniprogram/');
});

test('online miniprogram app.wxss uses actual line breaks, not escaped source text',()=>{
 const css=fs.readFileSync(path.join(root,'online','miniprogram','app.wxss'),'utf8');
 assert.ok(!css.includes('\\n'),'literal escaped newlines are invalid CSS');
 assert.ok(css.includes('.rule-row'));
});
