'use strict';
const crypto=require('crypto');
const {createRoom,apply,view}=require('./service');

// PostgreSQL is the authoritative room store. Never expose its credentials to wx clients.
// Reuse a small pool across warm CloudBase function invocations.
let sharedPool;
function postgresPool(){
 if(sharedPool)return sharedPool;
 const {PGHOST,PGUSER,PGPASSWORD,PGDATABASE,PGPORT,PGSSLMODE}=process.env;
 if(!PGHOST||!PGUSER||!PGPASSWORD||!PGDATABASE){
  const e=new Error('云函数未配置 PostgreSQL 连接信息（PGHOST/PGUSER/PGPASSWORD/PGDATABASE）');
  e.code='CONFIG';throw e;
 }
 const {Pool}=require('pg');
 const mode=PGSSLMODE||'verify-full';
 if(!['disable','require','verify-full'].includes(mode)){
  const e=new Error('PGSSLMODE 仅支持 disable、require 或 verify-full');
  e.code='CONFIG';throw e;
 }
 const ssl=mode==='disable'?false:mode==='require'?{rejectUnauthorized:false}:{rejectUnauthorized:true};
 sharedPool=new Pool({
  host:PGHOST,port:Number(PGPORT||5432),user:PGUSER,password:PGPASSWORD,
  database:PGDATABASE,ssl,max:3,connectionTimeoutMillis:6000,
  idleTimeoutMillis:15000
 });
 sharedPool.on('error',e=>console.error('PostgreSQL idle client error',e.code||'ERROR'));
 return sharedPool;
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
function createHandler(deps={}){
 const getUID=deps.getUID||(()=>failure('AUTH','无法获取微信身份'));
 const pool=deps.getPool||postgresPool;
 const bytes=deps.randomBytes||crypto.randomBytes;
 const clock=deps.now||Date.now;
 const logger=deps.logger||console;
 return async function handle(event={}){
  let client;
  try{
   const uid=getUID();
   if(typeof uid!=='string'||!uid)failure('AUTH','无法获取微信身份');
   const now=clock();
   if(!event||typeof event!=='object'||Array.isArray(event))failure('ACTION','无效操作');
   if(event.action==='create'){
    const id=bytes(16).toString('hex');
    const room=createRoom(id,uid,event.name,now,event.rules,event.bots);
    client=await pool().connect();
    await client.query(
     'INSERT INTO public.flying_rooms (room_id,state,expires_at) VALUES ($1,$2::jsonb,to_timestamp($3/1000.0))',
     [id,JSON.stringify(room),room.expiresAt]);
    return {ok:true,room:view(room,uid),serverNow:now};
   }
   if(!/^[a-f0-9]{32}$/.test(event.roomId||''))failure('ROOM','房间码无效');
   client=await pool().connect();
   await client.query('BEGIN');
   const found=await client.query(
    'SELECT state FROM public.flying_rooms WHERE room_id=$1 FOR UPDATE',
    [event.roomId]);
   if(!found.rows||!found.rows.length)failure('ROOM','房间不存在');
   const original=typeof found.rows[0].state==='string'?
    JSON.parse(found.rows[0].state):found.rows[0].state;
   const next=apply(original,uid,event,now,serverRandom(bytes(512)));
   if(next.revision!==original.revision){
    await client.query(
     'UPDATE public.flying_rooms SET state=$2::jsonb,expires_at=to_timestamp($3/1000.0),updated_at=now() WHERE room_id=$1',
     [event.roomId,JSON.stringify(next),next.expiresAt]);
   }
   await client.query('COMMIT');
   return {ok:true,room:view(next,uid),serverNow:clock()};
  }catch(e){
   if(client){try{await client.query('ROLLBACK');}catch(_){}}
   if(e.code==='CONFIG'||e.code==='AUTH'||e.code==='ROOM'||e.code==='EXPIRED'||
      e.code==='FULL'||e.code==='STARTED'||e.code==='FORBIDDEN'||e.code==='PLAYING'||e.code==='REQUEST'||
      e.code==='STALE'||e.code==='HOST'||e.code==='PHASE'||e.code==='NOT_READY'||
      e.code==='TURN'||e.code==='MOVE'||e.code==='TIMEOUT'||e.code==='TOO_EARLY'||
      e.code==='BOTS'||e.code==='ACTION'||e.code==='BOT_LIMIT'||e.code==='BOT_MOVE'){
    return {ok:false,code:e.code,message:e.message};
   }
   logger.error('flyingRoom pg failure',e.code||'SERVER');
   return {ok:false,code:'SERVER',message:'请求失败，请检查云函数 PostgreSQL 连接与表结构'};
  }finally{
   if(client)client.release();
  }
 };
}
// Lazy-loading the Tencent SDK keeps standalone Node tests independent of a deployment.
let activeHandler;
exports.main=async(event)=>{
 if(!activeHandler){
  const cloud=require('wx-server-sdk');
  cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
  activeHandler=createHandler({getUID:()=>cloud.getWXContext().OPENID});
 }
 return activeHandler(event);
};
exports.createHandler=createHandler;
