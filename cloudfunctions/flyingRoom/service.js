'use strict';
const {Flying,normalizeRules}=require('./lib/flying-model');
const {chooseMove,LEVELS}=require('./lib/flying-ai');
const COLORS=['R','Y','B','G'];
const LABELS={easy:'简单',normal:'普通',hard:'困难'};
const TTL=24*60*60*1000, TURN_MS=60000;
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function cleanName(name){return typeof name==='string'?name.trim().slice(0,12):'';}
function member(uid,name,seat){return {uid,name:cleanName(name)||('玩家'+(seat+1)),ready:false,color:COLORS[seat],bot:false};}
function botMember(seat,difficulty){
 return {uid:'_flying_ai_'+seat,name:LABELS[difficulty]+'电脑 '+(seat+1),ready:true,color:COLORS[seat],bot:true,difficulty};
}
function configureBots(room,count,difficulty){
 if(!Number.isInteger(count)||count<0||count>3 || !LEVELS.includes(difficulty))
   fail('BOTS','机器人数量须为0至3，难度须为简单、普通或困难');
 const seats=room.seats.map(s=>s&&s.bot?null:s);
 const free=seats.filter(s=>!s).length;
 if(count>free)fail('FULL','机器人数量超过剩余空座位，请先减少真人或机器人数量');
 for(let i=3;i>=0 && count>0;i--)if(!seats[i]){seats[i]=botMember(i,difficulty);count--;}
 room.seats=seats;
 room.botConfig={count:seats.filter(s=>s&&s.bot).length,difficulty};
}
function createRoom(id,uid,name,now,rules,bots){
 const room={
  id,host:uid,seats:[member(uid,name,0),null,null,null],status:'waiting',
  game:null,rules:normalizeRules(rules),botConfig:{count:0,difficulty:'normal'},
  revision:0,expiresAt:now+TTL,deadline:0,seen:[],lastRoll:null,lastMove:null,motion:null
 };
 if(bots!==undefined&&bots!==null)
  configureBots(room,bots.count===undefined?0:bots.count,bots.difficulty||'normal');
 return room;
}
function hydrate(snapshot,random){return Object.assign(new Flying(4,random,snapshot.rules),snapshot);}
function state(g){
 return {colors:g.colors,pieces:g.pieces,turn:g.turn,phase:g.phase,die:g.die,
  winner:g.winner,sixStreak:g.sixStreak,rules:g.rules};
}
// Advance all consecutive AI turns within the same room transaction.
// No unauthenticated action, client dice value or cloud timer may move a bot.
function runBots(room,now,random,timeline=[]){
 if(room.status!=='playing')return;
 const g=hydrate(room.game,random);
 for(let step=0;step<40 && g.phase!=='done';step++){
  const current=room.seats[g.turn];
  if(!current||!current.bot)break;
  if(g.phase==='roll'){
   const die=g.roll();
   room.lastRoll={id:'bot_'+room.revision+'_'+step,die,player:g.turn,bot:true};
   timeline.push({kind:'roll',player:g.turn,die});
   if(!g.legal().length)g.pass();
  }else if(g.phase==='choose'){
   const choice=chooseMove(g,current.difficulty,random);
   if(choice===null){g.pass();continue;}
   const before=g.pieces.map(p=>p.slice()),die=g.die;
   const movement=g.move(choice);
   if(!movement)fail('BOT_MOVE','机器人产生无效走法');
   timeline.push({kind:'move',player:movement.player,piece:movement.piece,
    from:movement.from,to:movement.to,die,segments:movement.events,
    captures:movement.captures,before,after:g.pieces.map(p=>p.slice())});
   room.lastMove={id:'bot_'+room.revision+'_'+step,bot:true,...movement};
  }else break;
 }
 if(g.phase!=='done'&&room.seats[g.turn]&&room.seats[g.turn].bot)
  fail('BOT_LIMIT','机器人连续回合超出限制');
 room.game=state(g);
 room.status=g.phase==='done'?'done':'playing';
 room.deadline=now+TURN_MS;
}
function apply(original,uid,e,now,random=Math.random){
 const room=JSON.parse(JSON.stringify(original));
 if(now>=room.expiresAt)fail('EXPIRED','房间已过期，请重新建房');
 let seat=room.seats.findIndex(p=>p&&!p.bot&&p.uid===uid);
 if(e.action==='join'){
  if(seat>=0)return room;
  if(room.status!=='waiting')fail('STARTED','游戏已经开始');
  seat=room.seats.indexOf(null);
  if(seat<0)fail('FULL','房间已满，请房主先减少机器人数量');
  room.seats[seat]=member(uid,e.name,seat);
 }else{
  if(seat<0)fail('FORBIDDEN','你不在这个房间');
  if(e.action==='get')return room;
  if(typeof e.requestId!=='string'||! /^[a-zA-Z0-9_-]{8,80}$/.test(e.requestId))
   fail('REQUEST','缺少操作编号');
  if(room.seen.some(x=>x.uid===uid&&x.id===e.requestId))return room;
  if(e.revision!==room.revision)fail('STALE','状态已更新，请同步后重试');
  if(e.action==='ready'){
   if(room.status!=='waiting')fail('STARTED','游戏已经开始');
   room.seats[seat].ready=!room.seats[seat].ready;
  }else if(e.action==='setBots'){
   if(room.host!==uid)fail('HOST','只有房主可以调整机器人');
   if(room.status!=='waiting')fail('STARTED','开局后不能更改机器人');
   configureBots(room,e.count,e.difficulty);
  }else if(e.action==='leave'){
   if(room.status==='playing')fail('PLAYING','对局中可暂时离开，座位保留供重连');
   room.seats[seat]=null;
   if(room.host===uid){
    const next=room.seats.find(p=>p&&!p.bot);
    room.host=next?next.uid:'';
   }
   if(!room.host)room.status='closed';
  }else if(e.action==='start'||e.action==='rematch'){
   if(room.host!==uid)fail('HOST','只有房主可以开始');
   if((e.action==='start'&&room.status!=='waiting')||(e.action==='rematch'&&room.status!=='done'))
    fail('PHASE','当前不能开局');
   if(!room.seats.every(p=>p&&(e.action==='rematch'||p.ready)))
    fail('NOT_READY','需要四个座位（真人或电脑）且真人全部准备');
   room.game=state(new Flying(4,Math.random,room.rules));
   room.status='playing';room.deadline=now+TURN_MS;room.lastRoll=null;room.lastMove=null;
   const timeline=[];runBots(room,now,random,timeline);
   if(timeline.length)room.motion={id:e.requestId,events:timeline};
  }else{
   if(room.status!=='playing')fail('PHASE','对局尚未开始或已经结束');
   const g=hydrate(room.game,random);
   if(e.action==='timeout'){
    if(now<room.deadline)fail('TOO_EARLY','当前回合尚未超时');
    g.turn=(g.turn+1)%4;g.phase='roll';g.die=0;g.sixStreak=0;
   }else{
    if(seat!==g.turn)fail('TURN','还没轮到你');
    if(now>=room.deadline)fail('TIMEOUT','回合已超时，请跳过超时回合');
    if(e.action==='roll'){
     if(!g.roll())fail('PHASE','请先选择飞机');
     room.lastRoll={id:e.requestId,die:g.die,player:seat};
     if(!g.legal().length)g.pass();
    }else if(e.action==='move'){
     if(!Number.isInteger(e.piece))fail('MOVE','这架飞机当前不能移动');
     const movement=g.move(e.piece);
     if(!movement)fail('MOVE','这架飞机当前不能移动');
     room.lastMove={id:e.requestId,...movement};
    }else fail('ACTION','未知操作');
   }
   room.game=state(g);room.status=g.phase==='done'?'done':'playing';room.deadline=now+TURN_MS;
   const timeline=[];runBots(room,now,random,timeline);
   if(timeline.length)room.motion={id:e.requestId,events:timeline};
  }
  room.seen.push({uid,id:e.requestId});
  room.seen=room.seen.slice(-64);
 }
 room.revision++;
 return room;
}
function view(room,uid){
 const seat=room.seats.findIndex(p=>p&&!p.bot&&p.uid===uid);
 return {
  id:room.id,seats:room.seats.map(p=>p?{
   name:p.name,ready:p.ready,color:p.color,bot:!!p.bot,difficulty:p.bot?p.difficulty:null
  }:null),seat,isHost:room.host===uid,status:room.status,game:room.game,
  rules:room.rules,botConfig:room.botConfig||{count:0,difficulty:'normal'},
  revision:room.revision,deadline:room.deadline,expiresAt:room.expiresAt,
  lastRoll:room.lastRoll,lastMove:room.lastMove,motion:room.motion||null
 };
}
module.exports={createRoom,apply,view,configureBots,runBots};
