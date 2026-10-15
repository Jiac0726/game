'use strict';
const crypto=require('crypto');
const {createRoom,apply,view}=require('./service');

// WeChat-native Cloud Database (NOT PostgreSQL).
// A complete room is one document, id == document _id. All mutations use
// server-side runTransaction so concurrent requests never silently overwrite a turn.
const COLLECTION='flying_rooms';
function failure(code,message){const err=new Error(message);err.code=code;throw err;}
function serverRandom(bytes){
 let cursor=0;
 return ()=>{
  if(cursor+4>bytes.length)failure('RANDOM','本次回合随机数用尽');
  const n=bytes.readUInt32BE(cursor);cursor+=4;
  return n/4294967296;
 };
}
function readRoom(snapshot){
 const doc=snapshot&&snapshot.data;
 if(!doc||!doc.state||typeof doc.state!=='object')failure('ROOM','房间不存在');
 return doc.state;
}
const CLIENT_ERRORS=new Set([
 'AUTH','ROOM','EXPIRED','FULL','STARTED','FORBIDDEN','PLAYING','REQUEST',
 'STALE','HOST','PHASE','NOT_READY','TURN','MOVE','TIMEOUT','TOO_EARLY',
 'BOTS','ACTION','BOT_LIMIT','BOT_MOVE'
]);
function createHandler(deps={}){
 const getUID=deps.getUID||(()=>failure('AUTH','无法获取微信身份'));
 const getDB=deps.getDB||(()=>failure('CONFIG','云函数未初始化微信云数据库'));
 const bytes=deps.randomBytes||crypto.randomBytes;
 const clock=deps.now||Date.now;
 const logger=deps.logger||console;
 return async function handle(event={}){
  let stage='init';
  try{
   const uid=getUID();
   if(typeof uid!=='string'||!uid)failure('AUTH','无法获取微信身份');
   if(!event||typeof event!=='object'||Array.isArray(event))failure('ACTION','无效操作');
   const now=clock();
   const db=getDB();
   if(!db||typeof db.collection!=='function'||typeof db.runTransaction!=='function')
    failure('CONFIG','微信云数据库未就绪，请确认启用云开发数据库');
   if(event.action==='create'){
    stage='create';
    const id=bytes(16).toString('hex');
    const room=createRoom(id,uid,event.name,now,event.rules,event.bots);
    // add with explicit _id refuses a duplicate instead of replacing another room.
    await db.collection(COLLECTION).add({
     data:{_id:id,state:room,expiresAt:room.expiresAt,updatedAt:now}
    });
    return {ok:true,room:view(room,uid),serverNow:clock()};
   }
   if(typeof event.roomId!=='string'||!/^[a-f0-9]{32}$/.test(event.roomId))
    failure('ROOM','房间码无效');
   const ref=db.collection(COLLECTION).doc(event.roomId);
   if(event.action==='get'){
    stage='get';
    // No mutation: skip transaction while still enforcing membership/expiry in apply.
    const original=readRoom(await ref.get());
    const current=apply(original,uid,event,now);
    return {ok:true,room:view(current,uid),serverNow:clock()};
   }
   // Only doc(_id) can be accessed inside a CloudBase server-side transaction.
   // runTransaction retries conflicting writes; service.apply then revalidates
   // the client's room revision and unique request ID against the new state.
   let latest;
   stage='transaction';
   await db.runTransaction(async tx=>{
    const doc=tx.collection(COLLECTION).doc(event.roomId);
    const original=readRoom(await doc.get());
    const next=apply(original,uid,event,now,serverRandom(bytes(512)));
    if(next.revision!==original.revision){
     await doc.update({data:{
      state:next,expiresAt:next.expiresAt,updatedAt:clock()
     }});
    }
    latest=next;
   });
   return {ok:true,room:view(latest,uid),serverNow:clock()};
  }catch(e){
   if(CLIENT_ERRORS.has(e.code)||e.code==='CONFIG')
    return {ok:false,code:e.code,message:e.message};
   // Do not return raw database diagnostics or secrets to the mini-game.
   // Log server-side diagnostics WITHOUT echoing SDK/database details to clients.
   // In particular, create success + subsequent get failure requires a different
   // investigation than a failure on a transactional command.
   logger.error('flyingRoom cloud database failure',{
    stage,
    action:typeof event.action==='string'?event.action.slice(0,30):'unknown',
    code:String(e.code||e.errCode||'SERVER').slice(0,80),
    message:String(e.message||e.errMsg||e).slice(0,500)
   });
   return {ok:false,code:'DATABASE',
    message:'云数据库'+({get:'读取',transaction:'事务操作',create:'建房写入'}[stage]||'访问')+
      '失败，请查看 flyingRoom 云函数日志'};
  }
 };
}
// Kept lazy so tests can inject an in-memory cloud database.
let activeHandler;
exports.main=async event=>{
 if(!activeHandler){
  const cloud=require('wx-server-sdk');
  cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
  const db=cloud.database({throwOnNotFound:false});
  activeHandler=createHandler({
   getUID:()=>cloud.getWXContext().OPENID,
   getDB:()=>db
  });
 }
 return activeHandler(event);
};
exports.createHandler=createHandler;
exports.COLLECTION=COLLECTION;
