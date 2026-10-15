'use strict';
// Version 1 profile: device-local, non-transferable, non-purchasable play stars.
// Do not use this balance for cash, awards, competitive ranking or server trust.
const KEY='flyingChessProfileV1';
const THEMES=Object.freeze([
 {id:'classic',label:'经典奶油',cost:0,paper:'#faf5e9',panel:'#fffdf5'},
 {id:'mint',label:'薄荷晴天',cost:25,paper:'#e7f5e9',panel:'#f7fff8'},
 {id:'sky',label:'云朵蓝',cost:45,paper:'#e5f2fa',panel:'#f6fcff'},
 {id:'peach',label:'蜜桃粉',cost:65,paper:'#fff0ec',panel:'#fff9f7'}
]);
function empty(){
 return {version:1,stars:0,played:0,wins:0,local:0,online:0,
  theme:'classic',owned:['classic'],credited:[]};
}
function normalize(raw){
 const p=empty();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return p;
 for(const k of ['stars','played','wins','local','online']){
  const n=raw[k];
  if(Number.isSafeInteger(n)&&n>=0)p[k]=Math.min(1000000000,n);
 }
 const valid=THEMES.map(t=>t.id);
 if(Array.isArray(raw.owned)){
  p.owned=['classic',...raw.owned.filter(x=>valid.includes(x)&&x!=='classic')].filter((x,i,a)=>a.indexOf(x)===i);
 }
 if(p.owned.includes(raw.theme))p.theme=raw.theme;
 if(Array.isArray(raw.credited))
  p.credited=raw.credited.filter(x=>typeof x==='string'&&x.length<=100).slice(-100);
 p.wins=Math.min(p.wins,p.played);
 return p;
}
function load(wx){
 try{return normalize(wx.getStorageSync(KEY));}catch(_){return empty();}
}
function persist(wx,p){
 // Do not update the in-memory state if persistence throws.
 if(!wx||typeof wx.setStorageSync!=='function')throw new Error('本机存储暂不可用');
 wx.setStorageSync(KEY,p);
 return p;
}
function reward(wx,profile,matchId,won,online){
 const p=normalize(profile);
 if(typeof matchId!=='string'||!matchId||matchId.length>100)throw new Error('对局标识无效');
 if(p.credited.includes(matchId))return {profile:p,earned:0,duplicate:true};
 const earned=10+(won?20:0);
 p.played++;if(won)p.wins++;
 if(online)p.online++;else p.local++;
 p.stars+=earned;p.credited.push(matchId);p.credited=p.credited.slice(-100);
 persist(wx,p);
 return {profile:p,earned,duplicate:false};
}
function buyOrEquip(wx,profile,themeId){
 const p=normalize(profile),item=THEMES.find(t=>t.id===themeId);
 if(!item)return {profile:p,message:'主题不存在',ok:false};
 if(!p.owned.includes(item.id)){
  if(p.stars<item.cost)return {profile:p,message:'幸运星不足，完成对局即可获得',ok:false};
  p.stars-=item.cost;p.owned.push(item.id);
 }
 p.theme=item.id;persist(wx,p);
 return {profile:p,message:'已启用「'+item.label+'」',ok:true};
}
function theme(profile){return THEMES.find(t=>t.id===profile.theme)||THEMES[0];}
module.exports={KEY,THEMES,empty,normalize,load,reward,buyOrEquip,theme};
