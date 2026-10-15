'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../src/api');

test('mini-game cloud calls pin the actual environment and return a room result',async()=>{
 const requests=[],initialized=[];
 const client=createClient({cloud:{
  init:opts=>initialized.push(opts),
  callFunction:async opts=>{
   requests.push(opts);
   return {result:{ok:true,room:{id:'a'.repeat(32)}}};
  }
 }},{timeoutMs:50});
 const created=await client.call('create',{name:'test'});
 assert.equal(created.room.id,'a'.repeat(32));
 assert.equal(initialized.length,1);
 assert.equal(initialized[0].env,'cloudbase-d1gj6cm1ncb1f981a');
 assert.equal(requests[0].config.env,'cloudbase-d1gj6cm1ncb1f981a');
 assert.equal(requests[0].data.action,'create');
});

test('mini-game cloud client times out instead of leaving loading state forever',async()=>{
 const client=createClient({cloud:{
  init(){},
  callFunction:()=>new Promise(()=>{})
 }},{timeoutMs:20});
 await assert.rejects(()=>client.call('create'),e=>
  e.code==='CLOUD_TIMEOUT'&&/避免重复创建/.test(e.message));
});

test('mini-game CloudBase FunctionName not found receives actionable code',async()=>{
 const client=createClient({cloud:{
  init(){},
  callFunction:async()=>{throw Error('FunctionName parameter could not be found');}
 }},{timeoutMs:50});
 await assert.rejects(()=>client.call('create'),e=>e.code==='FUNCTION_NOT_FOUND');
});

test('mini-game retains structured CloudDB diagnostics for user-visible reporting',async()=>{
 const client=createClient({cloud:{
  init(){},
  callFunction:async()=>({result:{
   ok:false,code:'DATABASE',message:'云数据库事务操作失败（-502001）',
   action:'ready',stage:'transaction',dbCode:'-502001',
   detail:"Cannot create field 'colors' in element {game: null}"
  }})
 }},{timeoutMs:50});
 await assert.rejects(()=>client.call('ready'),e=>
  e.code==='DATABASE'&&e.action==='ready'&&e.stage==='transaction'&&
  e.dbCode==='-502001'&&e.detail.includes('Cannot create field'));
});
