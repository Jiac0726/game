const cloud=require('wx-server-sdk');
const crypto=require('crypto');
const {createRoom,apply,view}=require('./service');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});const db=cloud.database();
exports.main=async(event={})=>{
 try{
  const uid=cloud.getWXContext().OPENID;if(!uid)return {ok:false,code:'AUTH',message:'无法获取微信身份'};
  const now=Date.now();
  if(event.action==='create'){
   const id=crypto.randomBytes(16).toString('hex'),room=createRoom(id,uid,event.name,now,event.settings);
   await db.collection('flying_rooms').doc(id).set({data:room});return {ok:true,room:view(room,uid),serverNow:now};
  }
  if(!/^[a-f0-9]{32}$/.test(event.roomId||''))return {ok:false,code:'ROOM',message:'房间码无效'};
  // Generate once per request; automatic transaction retries must not change the die.
  const die=crypto.randomInt(1,7),random=()=>(die-1)/6;
  const transact=await db.runTransaction(async tx=>{
   const doc=tx.collection('flying_rooms').doc(event.roomId);
   const fetched=await doc.get();const original=Array.isArray(fetched.data)?fetched.data[0]:fetched.data;
   if(!original) {const e=new Error('房间不存在');e.code='ROOM';throw e;}
   const room=apply(original,uid,event,now,random);
   if(room.revision!==original.revision){const {_id,...data}=room;await doc.set({data});}
   return view(room,uid);
  });
  return {ok:true,room:transact.result||transact,serverNow:Date.now()};
 }catch(e){console.error('flyingRoom',e.code||e.errCode||'ERROR');return {ok:false,code:e.code||'SERVER',message:e.code?e.message:'请求失败，请稍后重试（检查云函数与数据库部署）'};}
};
