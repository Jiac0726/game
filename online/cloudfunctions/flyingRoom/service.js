const {Flying}=require('./lib/flying-model');
const COLORS=['R','Y','B','G'];
const TTL=24*60*60*1000, TURN_MS=60000;
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function cleanName(name){return typeof name==='string'?name.trim().slice(0,12):'';}
function member(uid,name,seat){return {uid,name:cleanName(name)||('玩家'+(seat+1)),ready:false,color:COLORS[seat]};}
function createRoom(id,uid,name,now){return {id,host:uid,seats:[member(uid,name,0),null,null,null],status:'waiting',game:null,revision:0,expiresAt:now+TTL,deadline:0,seen:[],lastRoll:null};}
function hydrate(state,random){return Object.assign(new Flying(4,random),state);}
function state(g){return {colors:g.colors,pieces:g.pieces,turn:g.turn,phase:g.phase,die:g.die,winner:g.winner};}
function apply(original,uid,e,now,random){
 const room=JSON.parse(JSON.stringify(original));
 if(now>=room.expiresAt)fail('EXPIRED','房间已过期，请重新建房');
 let seat=room.seats.findIndex(p=>p&&p.uid===uid);
 if(e.action==='join'){
  if(seat>=0)return room;
  if(room.status!=='waiting')fail('STARTED','游戏已经开始');
  seat=room.seats.indexOf(null);if(seat<0)fail('FULL','房间已满，共四个座位');
  room.seats[seat]=member(uid,e.name,seat);
 }else{
  if(seat<0)fail('FORBIDDEN','你不在这个房间');
  if(e.action==='get')return room;
  if(typeof e.requestId!=='string'||! /^[a-zA-Z0-9_-]{8,80}$/.test(e.requestId))fail('REQUEST','缺少操作编号');
  if(room.seen.some(x=>x.uid===uid&&x.id===e.requestId))return room;
  if(e.revision!==room.revision)fail('STALE','状态已更新，请同步后重试');
  if(e.action==='ready'){
   if(room.status!=='waiting')fail('STARTED','游戏已经开始');
   room.seats[seat].ready=!room.seats[seat].ready;
  }else if(e.action==='leave'){
   if(room.status==='playing')fail('PLAYING','对局中可暂时离开，座位保留供重连');
   room.seats[seat]=null;
   if(room.host===uid){const next=room.seats.find(Boolean);room.host=next?next.uid:'';}
   if(!room.host)room.status='closed';
  }else if(e.action==='start'||e.action==='rematch'){
   if(room.host!==uid)fail('HOST','只有房主可以开始');
   if(e.action==='start'&&room.status!=='waiting'||e.action==='rematch'&&room.status!=='done')fail('PHASE','当前不能开局');
   if(!room.seats.every(p=>p&&(e.action==='rematch'||p.ready)))fail('NOT_READY','需要四人到齐并准备');
   room.game=state(new Flying(4));room.status='playing';room.deadline=now+TURN_MS;room.lastRoll=null;
  }else{
   if(room.status!=='playing')fail('PHASE','对局尚未开始或已经结束');
   const g=hydrate(room.game,random);
   if(e.action==='timeout'){
    if(now<room.deadline)fail('TOO_EARLY','当前回合尚未超时');
    g.turn=(g.turn+1)%4;g.phase='roll';g.die=0;
   }else{
    if(seat!==g.turn)fail('TURN','还没轮到你');
    if(now>=room.deadline)fail('TIMEOUT','回合已超时，请跳过超时回合');
    if(e.action==='roll'){
     if(!g.roll())fail('PHASE','请先选择飞机');
     room.lastRoll={id:e.requestId,die:g.die,player:seat};
     if(!g.legal().length)g.pass();
    }else if(e.action==='move'){
     if(!Number.isInteger(e.piece)||!g.move(e.piece))fail('MOVE','这架飞机当前不能移动');
    }else fail('ACTION','未知操作');
   }
   room.game=state(g);room.status=g.phase==='done'?'done':'playing';room.deadline=now+TURN_MS;
  }
  room.seen.push({uid,id:e.requestId});room.seen=room.seen.slice(-64);
 }
 room.revision++;return room;
}
function view(room,uid){const seat=room.seats.findIndex(p=>p&&p.uid===uid);return {id:room.id,seats:room.seats.map(p=>p?{name:p.name,ready:p.ready,color:p.color}:null),seat,isHost:room.host===uid,status:room.status,game:room.game,revision:room.revision,deadline:room.deadline,expiresAt:room.expiresAt,lastRoll:room.lastRoll};}
module.exports={createRoom,apply,view};
