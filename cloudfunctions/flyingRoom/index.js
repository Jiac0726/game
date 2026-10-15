'use strict';
const crypto=require('crypto');
const {createRoom,apply,view}=require('./service');

// WeChat-native Cloud Database (NOT PostgreSQL).
// A complete room is one document, id == document _id. All mutations use
// server-side runTransaction so concurrent requests never silently overwrite a turn.
const COLLECTION='flying_rooms';
const VERSION='wxdb-debug-20261015-3';
function redactDebugMessage(value){
 // Diagnostic details are opt-in and may still contain service topology.
 // Redact common credential formats before sending any SDK string to a client.
 return String(value||'')
  .replace(/((?:PGPASSWORD|password|passwd|secret|token|authorization|api[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,}]+)/gi,'$1[REDACTED]')
  .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi,'$1[REDACTED]@')
  .slice(0,850);
}
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
 // One previous deployment accidentally used transaction.doc.set({data:{...}}),
 // which may have wrapped room state under a literal "data" property.
 // Read both layouts and rewrite them into the canonical layout on next mutation.
 const room=doc&&(doc.state||doc.data&&doc.data.state);
 if(!room||typeof room!=='object')failure('ROOM','房间不存在');
 return room;
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
 const debugEnabled=deps.debugEnabled===undefined?process.env.FLYING_ROOM_DEBUG==='1':deps.debugEnabled===true;
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
   // Read-only, authenticated deployment probe. It never alters room data.
   if(event.action==='health')
    return {ok:true,version:VERSION,store:'wechat-cloud-database',debugEnabled,serverNow:clock()};
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
     // SDK Document.update flattens nested objects into dotted paths.
     // Before the first start, state.game is null; trying to write
     // state.game.colors then raises -502001 (Cannot create field in null).
     // Replace the complete document INSIDE the existing transaction instead.
     // The transaction still protects concurrent room revisions and request IDs.
     // IMPORTANT: transaction.doc.set takes the replacement object DIRECTLY.
     // Unlike ordinary collection.add({data}), wrapping it in {data:{...}}
     // creates a literal "data" field and corrupts subsequent reads.
     await doc.set({
      state:next,expiresAt:next.expiresAt,updatedAt:clock()
     });
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
   const action=typeof event.action==='string'?event.action.slice(0,30):'unknown';
   const dbCode=String(e.code||e.errCode||e.errno||'SERVER').slice(0,70);
   const raw=String(e.message||e.errMsg||e);
   logger.error('flyingRoom cloud database failure',{
    stage,action,code:dbCode,message:raw.slice(0,1000)
   });
   // Always return safe structured metadata; only expose SDK details if the
   // operator explicitly enables temporary diagnostics in CloudBase.
   const result={
    ok:false,code:'DATABASE',stage,action,dbCode,
    message:'云数据库'+({get:'读取',transaction:'事务操作',create:'建房写入'}[stage]||'访问')+
     '失败（'+dbCode+'）'
   };
   if(debugEnabled)result.detail=redactDebugMessage(raw);
   return result;
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
exports.VERSION=VERSION;
