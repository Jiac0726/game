'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const profile=require('../src/player-profile');
const {FlyingChessGame}=require('../src/game-app');
function device(){
 const values=new Map();
 return {getStorageSync:k=>values.get(k),setStorageSync:(k,v)=>values.set(k,structuredClone(v)),
  removeStorageSync:k=>values.delete(k)};
}
function appOnDevice(wx){
 const ctx=new Proxy({},{get:(target,key)=>key in target?target[key]:(()=>{}),
  set:(target,key,value)=>(target[key]=value,true)});
 return Object.assign(new FlyingChessGame(wx),{
  canvas:{width:375,height:812},ctx,pixelRatio:1,scale:1,dx:0,dy:0,
  asset:()=>null,buttons:[],tokenTargets:[]
 });
}
test('completed offline and online matches award free stars exactly once, persisted on device',()=>{
 const wx=device();
 let p=profile.load(wx);
 assert.equal(p.stars,0);
 const first=profile.reward(wx,p,'local:match-1',true,false);
 assert.equal(first.earned,30);
 assert.equal(first.profile.played,1);
 assert.equal(first.profile.wins,1);
 assert.equal(first.profile.local,1);
 const duplicate=profile.reward(wx,first.profile,'local:match-1',true,false);
 assert.equal(duplicate.duplicate,true);
 assert.equal(duplicate.profile.stars,30);
 const online=profile.reward(wx,duplicate.profile,'online:room:1',false,true);
 assert.equal(online.profile.stars,40);
 assert.equal(online.profile.online,1);
 assert.equal(profile.load(wx).stars,40);
});
test('themes cost earned-only stars; insufficient balance cannot grant items',()=>{
 const wx=device(),p=profile.load(wx);
 const failed=profile.buyOrEquip(wx,p,'mint');
 assert.equal(failed.ok,false);
 assert.deepEqual(failed.profile.owned,['classic']);
 const earned=profile.reward(wx,p,'local:win',true,false);
 const purchase=profile.buyOrEquip(wx,earned.profile,'mint');
 assert.equal(purchase.ok,true);
 assert.equal(purchase.profile.stars,5);
 assert.equal(purchase.profile.theme,'mint');
 assert.equal(profile.theme(purchase.profile).paper,'#e7f5e9');
 const again=profile.buyOrEquip(wx,purchase.profile,'mint');
 assert.equal(again.profile.stars,5,'equipping an owned theme never charges again');
 assert.equal(profile.load(wx).theme,'mint');
});
test('malformed local storage is sanitized and missing storage safely starts fresh',()=>{
 const wx=device();
 wx.setStorageSync(profile.KEY,{stars:-50,played:1,wins:9,theme:'premium',
  owned:['not-known','mint','mint'],credited:[13,'ok']});
 const p=profile.load(wx);
 assert.equal(p.stars,0);
 assert.equal(p.wins,1);
 assert.equal(p.theme,'classic');
 assert.deepEqual(p.owned,['classic','mint']);
 assert.deepEqual(p.credited,['ok']);
 assert.deepEqual(profile.load({getStorageSync(){throw Error('disabled');}}),profile.empty());
});
test('Canvas has navigable v1 progress, shop and guide screens',()=>{
 const wx={...device()},app=appOnDevice(wx);
 assert.doesNotThrow(()=>app.render());
 assert.ok(app.buttons.length>=6);
 app.openProfile();
 assert.doesNotThrow(()=>app.render());
 assert.ok(app.buttons.length>=3);
 app.openShop();
 assert.doesNotThrow(()=>app.render());
 assert.ok(app.buttons.length>=4, 'owned active theme has no click handler');
 app.openGuide();
 assert.doesNotThrow(()=>app.render());
 assert.ok(app.buttons.length>=2);
});
test('client records multiplayer victory only once per room round, rematches can earn again',()=>{
 const wx=device(),app=appOnDevice(wx);
 const id='b'.repeat(32);
 const base={id,seat:0,seats:[{name:'玩家'}],round:1,status:'done',revision:20,game:{winner:0}};
 app.accept({room:base,serverNow:Date.now()});
 assert.equal(app.profile.stars,30);
 app.accept({room:{...base,revision:21},serverNow:Date.now()});
 assert.equal(app.profile.stars,30);
 app.accept({room:{...base,round:2,revision:30},serverNow:Date.now()});
 assert.equal(app.profile.stars,60);
});
