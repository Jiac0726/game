'use strict';
const PATHS=require('./flying-paths');
const art=require('./flying-art-layout');
const {Flying}=require('./flying-model');
const C={R:'#ef9488',Y:'#f5d65f',B:'#80c6eb',G:'#95d7af'};
const N={R:'红方',Y:'黄方',B:'蓝方',G:'绿方'};
const ink='#283748',paper='#faf5e9',panel='#fffdf5',soft='#6e7e75';
function box(ctx,x,y,w,h,fill,stroke=ink,r=12){
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
 ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function label(ctx,str,x,y,size=17,color=ink,align='left',weight='normal'){
 ctx.fillStyle=color;ctx.font=weight+' '+size+'px sans-serif';
 ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(str),x,y);
}
function button(app,x,y,w,h,str,action,fill='#badbc5',disabled=false){
 const c=app.ctx;box(c,x,y,w,h,disabled?'#e6e7dd':fill);
 label(c,str,x+w/2,y+h/2,Math.min(17,w/(Math.max(5,String(str).length)*1.15))||16,disabled?'#8d938c':ink,'center','bold');
 if(!disabled&&action)app.buttons.push({x,y,w,h,action});
}
function heading(app,title,sub){
 const c=app.ctx;
 label(c,title,187,62,27,ink,'center','bold');
 if(sub)label(c,sub,187,99,13,soft,'center');
}
function footer(app){
 const c=app.ctx;
 label(c,'手绘飞行棋  ·  6 点连投  ·  欢乐起飞',187,785,12,soft,'center');
 if(app.message){
  box(c,21,738,333,31,'#ffefdd',null,9);
  label(c,app.message.slice(0,38),187,754,11,'#9f5145','center');
 }
}
function home(app){
 heading(app,'好友飞行棋','独立微信小游戏 · 彩铅棋盘');
 const c=app.ctx;
 box(c,25,142,325,335,'#f1eaca');
 const img=app.asset('FG-BOARD-001');
 if(img){
  const h=275,w=h*img.width/img.height;
  c.drawImage(img,187-w/2,167,w,h);
 }else{
  ['Y','B','R','G'].forEach((p,i)=>{box(c,81+(i%2)*131,192+Math.floor(i/2)*125,77,78,C[p]);label(c,'✈',119+(i%2)*131,231+Math.floor(i/2)*125,37,'#fff','center','bold');});
 }
 button(app,34,500,307,57,'创建联机房间',()=>app.setup(true),'#f6d978');
 button(app,34,572,307,57,'一个人挑战 3 台 AI',()=>app.setup(false),'#a8d9bd');
 button(app,34,644,147,53,'加入好友房间',()=>app.keyboard('room'),'#d9e8f2');
 button(app,194,644,147,53,'修改昵称',()=>app.keyboard('name'),'#fde5d5');
 label(c,'我的昵称：'+app.nickname,187,714,14,soft,'center');
}
function optionButton(app,x,y,w,title,value,action){
 label(app.ctx,title,x,y-12,13,soft);
 button(app,x,y,w,39,value,action,'#fff8ed',app.busy);
}
function setup(app){
 heading(app,app.onlineSetup?'创建联机房间':'单机挑战设置','房间规则创建后固定，AI 难度可选');
 button(app,18,40,64,39,'返回',()=>{app.scene='home';},'#f8d7c5');
 const launch=['six','fiveSix','even'],names=['仅6点','5或6点','偶数点'];
 optionButton(app,27,172,320,'起飞条件',names[launch.indexOf(app.rules.launch)]||names[0],()=>{let i=launch.indexOf(app.rules.launch);app.rules.launch=launch[(i+1)%3];});
 optionButton(app,27,251,320,'电脑数量',app.onlineSetup?app.botCount+' 台 AI（其余好友）':'3 台 AI',()=>{
  if(app.onlineSetup)app.botCount=(app.botCount+1)%4;
 });
 const diff=['easy','normal','hard'],diffName=['简单','普通','困难'];
 optionButton(app,27,332,320,'电脑难度',diffName[diff.indexOf(app.difficulty)],()=>{
  app.difficulty=diff[(diff.indexOf(app.difficulty)+1)%3];
 });
 const toggles=[['jump','同色跳跃'],['flight','跨越航线'],['capture','撞机回库'],['bounce','终点反弹']];
 toggles.forEach(([key,text],i)=>{
  const x=27+(i%2)*162,y=425+Math.floor(i/2)*70;
  button(app,x,y,154,49,(app.rules[key]?'☑ ':'☐ ')+text,
   ()=>{app.rules[key]=!app.rules[key];},app.rules[key]?'#c6e9d0':'#eee8df');
 });
 optionButton(app,27,615,320,'连续三次六点规则',
  app.rules.threeSix==='noBonus'?'第三次正常走完':'第三次移动棋子回库',()=>{
   app.rules.threeSix=app.rules.threeSix==='noBonus'?'returnMoved':'noBonus';
  });
 button(app,29,681,317,55,app.onlineSetup?'创建四人房间':'开始挑战',()=>{
  if(app.onlineSetup)app.createRoom();else app.localStart();
 },'#f5d673',app.busy);
}
function waiting(app){
 const r=app.room,c=app.ctx;
 heading(app,'好友联机 · 等待开局','好友分享邀请 · 房间最多四个座位');
 button(app,16,31,68,42,'返回',()=>app.exitRoom(),'#f8d6cb');
 box(c,24,133,327,65,panel);
 label(c,'房间码：'+r.id.slice(0,16),187,158,14,ink,'center');
 label(c,'尾号：'+r.id.slice(16),187,183,13,soft,'center');
 r.seats.forEach((s,i)=>{
  const col=['R','Y','B','G'][i],x=27+(i%2)*164,y=223+Math.floor(i/2)*108;
  box(c,x,y,156,97,s?'#fffef6':'#ebeae3',C[col]);
  label(c,N[col],x+12,y+21,16,C[col],'left','bold');
  label(c,(s&&s.name||'等待好友').slice(0,10),x+11,y+50,15,ink);
  label(c,s?(s.bot?'电脑 · 已准备':s.ready?'已准备':'未准备'):'空座位',x+11,y+77,12,soft);
 });
 if(r.isHost){
  button(app,27,456,155,45,'AI 数量 '+app.botCount,()=>{app.botCount=(app.botCount+1)%4;},'#d8e9d8',app.busy);
  button(app,193,456,155,45,'难度 '+({easy:'简单',normal:'普通',hard:'困难'}[app.difficulty]),()=>{
   const v=['easy','normal','hard'];app.difficulty=v[(v.indexOf(app.difficulty)+1)%3];
  },'#d8e9d8',app.busy);
  button(app,27,512,321,47,'保存 AI 设置',()=>app.command('setBots',{count:app.botCount,difficulty:app.difficulty}),panel,app.busy);
 }
 const own=r.seats[r.seat],canBegin=r.seats.every(s=>s&&(s.ready||s.bot));
 button(app,27,575,321,49,own&&own.ready?'取消准备':'我准备好了',()=>app.command('ready'),'#a7dfbc',app.busy);
 if(r.isHost)button(app,27,632,321,49,'四人到齐，开始游戏',()=>app.command('start'),'#f6d675',app.busy||!canBegin);
 button(app,27,687,321,43,'邀请好友进入',()=>app.share(),'#dbeaf6');
}
function drawBoard(app,game,bx,by,size,canTap){
 const c=app.ctx;
 const img=app.asset('FG-BOARD-001');
 const fit=img?Math.min(size/img.width,size/img.height):1;
 const bounds=img?{x:bx+(size-img.width*fit)/2,y:by+(size-img.height*fit)/2,width:img.width*fit,height:img.height*fit}:null;
 if(img){
  c.drawImage(img,bounds.x,bounds.y,bounds.width,bounds.height);
  game.colors.forEach(color=>{
   const airport=app.asset('FG-AIRPORT-'+color);
   if(airport){const a=art.airportBounds(color,bounds);c.drawImage(airport,a.x,a.y,a.width,a.height);}
  });
 }else{
  box(c,bx,by,size,size,'#f6f5e2');
  const f=size/PATHS.width;
  PATHS.ring.forEach((p,i)=>{box(c,bx+p.x*f-5,by+p.y*f-5,10,10,Object.values(C)[i%4],null,2);});
  for(const color of game.colors){
   PATHS.colors[color].home.forEach(p=>box(c,bx+p.x*f-5,by+p.y*f-5,10,10,C[color],null,2));
  }
 }
 const motion=app.botFrames.length?app.botFrames[app.botFrameIndex]:null;
 const pieces=motion&&motion.pieces?motion.pieces:game.pieces;
 const group={};app.tokenTargets=[];
 pieces.forEach((row,player)=>row.forEach((progress,piece)=>{
  if(progress===57)return;
  const color=game.colors[player],route=PATHS.colors[color];
  const p=motion&&motion.point&&motion.point.player===player&&motion.point.piece===piece?
   motion.point:progress<0?route.airport[piece]:
   progress<52?PATHS.ring[(route.startIndex+progress)%52]:route.home[Math.min(5,progress-52)];
  if(!p)return;
  const v=bounds?art.project(p,bounds):{x:bx+p.x/PATHS.width*size,y:by+p.y/PATHS.height*size};
  const key=Math.round(v.x)+':'+Math.round(v.y);
  (group[key]||(group[key]=[])).push({color,player,piece,x:v.x,y:v.y});
 }));
 const sim=Object.assign(new Flying(4),game);
 const legal=canTap?sim.legal():[];
 Object.values(group).forEach(g=>g.forEach((p,i)=>{
  const x=p.x+(g.length>1?(i%4-1.5)*16:0),y=p.y+(g.length>4?(Math.floor(i/4)-.5)*17:0);
  const sprite=app.asset('FG-TOKEN-'+p.color);
  if(sprite)c.drawImage(sprite,x-18,y-18,36,36);
  else{c.fillStyle=C[p.color];c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.fill();c.strokeStyle=ink;c.stroke();}
  label(c,p.piece+1,x,y+1,12,ink,'center','bold');
  if(p.player===game.turn&&legal.includes(p.piece)){
   c.beginPath();c.strokeStyle=ink;c.lineWidth=2.5;c.arc(x,y,21,0,Math.PI*2);c.stroke();
   app.tokenTargets.push({x,y,piece:p.piece});
  }
 }));
}
function drawDice(app,x,y,side,die){
 const c=app.ctx,frame=Math.max(0,Math.floor((Date.now()-app.rollEnd+480)/80)%16);
 const sprite=app.rollEnd>Date.now()?app.asset('FG-DICE-'+String(frame).padStart(2,'0')):null;
 if(sprite){c.drawImage(sprite,x,y,side,side);return;}
 box(c,x,y,side,side,panel);
 const dots={1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],
  4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]],
  6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]};
 const v=dots[die]||dots[1];
 c.fillStyle=ink;v.forEach(([a,b])=>{c.beginPath();c.arc(x+side*(.25+a*.25),y+side*(.25+b*.25),3.5,0,Math.PI*2);c.fill();});
}
function playing(app){
 const r=app.room,game=app.scene==='local'?app.local:r&&r.game;
 heading(app,app.scene==='local'?'单机 AI 挑战':'四人联机飞行棋',
  app.scene==='local'?'红方由你控制，其余由电脑控制':r&&r.id?'房间：'+r.id.slice(-8):'');
 button(app,16,33,72,39,'返回',()=>app.scene==='local'?app.scene='home':app.exitRoom(),'#f7ddcc');
 if(!game)return;
 const turnColor=game.colors[game.turn];
 const motion=app.botFrames.length?app.botFrames[app.botFrameIndex]:null;
 const info=app.scene==='local'?
  (game.turn===0?'轮到你：红方':N[turnColor]+' AI 正在走棋'):
  (game.turn===r.seat?'轮到你：'+N[turnColor]:'轮到 '+N[turnColor]);
 label(app.ctx,game.phase==='done'?'游戏结束：'+N[game.colors[game.winner]]+'获胜！':
  motion?motion.label:info,187,121,17,ink,'center','bold');
 drawBoard(app,game,15,162,345,app.canMove());
 if(r&&r.status==='playing'){
  const seconds=Math.max(0,Math.ceil((r.deadline-Date.now()-app.offsetTime)/1000));
  label(app.ctx,'剩余 '+seconds+' 秒',187,541,13,soft,'center');
 }
 if(game.phase==='done'){
  if(app.scene==='local')button(app,29,617,317,50,'再玩一局',()=>app.localStart(),'#f6d675');
  else if(r.isHost)button(app,29,617,317,50,'房主发起重赛',()=>app.command('rematch'),'#f6d675',app.busy);
  button(app,29,684,317,44,'返回大厅',()=>app.scene==='local'?app.scene='home':app.exitRoom(),panel);
  return;
 }
 drawDice(app,37,582,53,motion&&motion.die||game.die||r&&r.lastRoll&&r.lastRoll.die||1);
 const myTurn=app.scene==='local'?game.turn===0:game.turn===r.seat;
 const disabled=app.busy||app.botFrames.length>0||app.rollEnd>Date.now();
 if(game.phase==='roll'&&myTurn)button(app,119,584,225,53,'掷骰子',()=>app.roll(),'#f6d675',disabled);
 else if(game.phase==='choose'&&myTurn){
  const legal=app.canMove()?Object.assign(new Flying(4),game).legal():[];
  label(app.ctx,'掷出 '+game.die+' 点 · 点击高亮飞机走棋',119,611,15,ink);
  legal.forEach((n,i)=>button(app,21+(i%4)*89,643,82,48,'飞机'+(n+1),()=>app.move(n),'#a7dfbc',disabled));
 }else{
  label(app.ctx,app.botFrames.length?'动画播放中…':'等待对方行动…',210,612,16,soft,'center');
 }
 if(app.botFrames.length)button(app,215,670,132,46,'跳过动画',()=>{app.botFrames=[];},'#dceaf1');
 if(r&&r.status==='playing'&&Date.now()+app.offsetTime>=r.deadline)
  button(app,22,705,150,43,'跳过超时回合',()=>app.command('timeout'),panel,app.busy);
 if(app.pending)button(app,184,705,165,43,'重试未确认操作',()=>app.sendPending(),panel,app.busy);
}
function draw(app){
 const c=app.ctx;
 if(!c)return;
 const dpr=app.pixelRatio||1;
 c.setTransform(dpr,0,0,dpr,0,0);
 c.fillStyle=paper;c.fillRect(0,0,app.canvas.width/dpr,app.canvas.height/dpr);
 c.setTransform(dpr*app.scale,0,0,dpr*app.scale,dpr*app.dx,dpr*app.dy);
 c.fillStyle=paper;c.fillRect(0,0,375,812);
 app.buttons=[];app.tokenTargets=[];
 if(app.scene==='home')home(app);
 else if(app.scene==='setup')setup(app);
 else if(app.scene==='room'&&app.room&&app.room.status==='waiting')waiting(app);
 else if(app.scene==='local'||app.scene==='room'&&app.room&&app.room.game)playing(app);
 else{heading(app,'正在连接好友房间','请稍后重试');button(app,27,585,321,50,'返回',()=>app.scene='home');}
 footer(app);
}
module.exports={draw};
