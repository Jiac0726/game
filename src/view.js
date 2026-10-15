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
 label(c,'你小子给我飞起来 · v1.0 休闲飞行棋',187,785,12,soft,'center');
 if(app.message){
  box(c,21,733,333,37,'#ffefdd',null,9);
  // Canvas text has no native wrapping; draw two centered clipped lines.
  c.save();
  c.beginPath();c.rect(27,735,321,32);c.clip();
  const chars=String(app.message);
  label(c,chars.slice(0,24),187,744,11,'#9f5145','center');
  if(chars.length>24)label(c,chars.slice(24,51),187,759,11,'#9f5145','center');
  c.restore();
 }
}
function home(app){
 heading(app,'你小子给我飞起来','手绘飞行棋 · 单机与好友联机');
 const c=app.ctx,p=app.profile||{stars:0,played:0,wins:0};
 label(c,'幸运星 '+p.stars+'  ·  已完成 '+p.played+' 局  ·  胜利 '+p.wins+' 局',187,126,13,soft,'center');
 box(c,25,145,325,308,'#f1eaca');
 const img=app.asset('FG-BOARD-001');
 if(img){
  const h=260,w=h*img.width/img.height;
  c.drawImage(img,187-w/2,162,w,h);
 }else{
  ['Y','B','R','G'].forEach((color,i)=>{
   const x=81+(i%2)*131,y=183+Math.floor(i/2)*118;
   box(c,x,y,77,78,C[color]);label(c,'✈',x+38,y+39,37,'#fff','center','bold');
  });
 }
 button(app,34,469,307,50,'创建联机房间',()=>app.setup(true),'#f6d978');
 button(app,34,529,307,50,'一个人挑战 3 台 AI',()=>app.setup(false),'#a8d9bd');
 button(app,34,589,147,45,'加入好友房间',()=>app.keyboard('room'),'#d9e8f2');
 button(app,194,589,147,45,'修改昵称',()=>app.keyboard('name'),'#fde5d5');
 button(app,34,646,147,46,'我的战绩',()=>app.openProfile(),'#e9dfef');
 button(app,194,646,147,46,'幸运星商店',()=>app.openShop(),'#f6e4b6');
 label(c,'我的昵称：'+app.nickname,187,711,14,soft,'center');
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
 // WeChat's fixed system capsule occupies the top-right corner. Keep the
 // back button above the title and reserve the first 90px for system UI.
 button(app,16,31,68,42,'返回',()=>app.exitRoom(),'#f8d6cb');
 label(c,'好友联机 · 等待开局',187,108,23,ink,'center','bold');
 label(c,'好友分享邀请 · 房间最多四个座位',187,143,13,soft,'center');
 box(c,24,161,327,65,panel);
 label(c,'房间码：'+r.id.slice(0,16),187,183,14,ink,'center');
 label(c,'尾号：'+r.id.slice(16),187,207,13,soft,'center');
 r.seats.forEach((s,i)=>{
  const col=['R','Y','B','G'][i],x=27+(i%2)*164,y=239+Math.floor(i/2)*103;
  box(c,x,y,156,93,s?'#fffef6':'#ebeae3',C[col]);
  label(c,N[col],x+12,y+21,16,C[col],'left','bold');
  label(c,(s&&s.name||'等待好友').slice(0,10),x+11,y+49,15,ink);
  label(c,s?(s.bot?'电脑 · 已准备':s.ready?'已准备':'未准备'):'空座位',x+11,y+73,12,soft);
 });
 if(r.isHost){
  button(app,27,451,155,43,'AI 数量 '+app.botCount,()=>{app.botCount=(app.botCount+1)%4;},'#d8e9d8',app.busy);
  button(app,193,451,155,43,'难度 '+({easy:'简单',normal:'普通',hard:'困难'}[app.difficulty]),()=>{
   const v=['easy','normal','hard'];app.difficulty=v[(v.indexOf(app.difficulty)+1)%3];
  },'#d8e9d8',app.busy);
  button(app,27,504,321,44,'保存 AI 设置',()=>app.command('setBots',{count:app.botCount,difficulty:app.difficulty}),panel,app.busy);
 }
 const own=r.seats[r.seat],canBegin=r.seats.every(s=>s&&(s.ready||s.bot));
 button(app,27,559,321,49,own&&own.ready?'取消准备':'我准备好了',()=>app.command('ready'),'#a7dfbc',app.busy);
 if(r.isHost)button(app,27,618,321,48,'四人到齐，开始游戏',()=>app.command('start'),'#f6d675',app.busy||!canBegin);
 const hasVacancy=r.seats.includes(null);
 button(app,27,677,321,42,hasVacancy?'邀请好友进入':'座位已满 · 先减少 AI',
  ()=>hasVacancy?app.share():app.say('将 AI 数量调到 0 并保存后，可以邀请三位好友'),
  '#dbeaf6',app.busy);
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
function back(app){button(app,16,34,75,41,'返回',()=>{app.scene='home';app.say('');},'#f7ddcc');}
function profileScreen(app){
 const c=app.ctx,p=app.profile;
 heading(app,'我的战绩','本机记录 · 不参与排行榜');
 back(app);
 box(c,23,141,329,194,panel);
 label(c,'已完成对局',43,178,15,soft);label(c,p.played,329,178,25,ink,'right','bold');
 label(c,'胜利场次',43,225,15,soft);label(c,p.wins,329,225,25,ink,'right','bold');
 label(c,'单机 / 联机',43,272,15,soft);label(c,p.local+' / '+p.online,329,272,20,ink,'right','bold');
 label(c,'总胜率',43,319,15,soft);
 label(c,p.played?Math.round(p.wins/p.played*100)+'%':'暂无',329,319,20,ink,'right','bold');
 box(c,23,361,329,141,'#fff0d6');
 label(c,'★ 幸运星：'+p.stars,43,408,23,ink,'left','bold');
 label(c,'参与完整对局 +10 星，获胜额外 +20 星',43,451,13,soft);
 label(c,'仅用于更换本机纸张主题，不支持充值提现',43,477,11,soft);
 button(app,27,538,321,54,'前往幸运星商店',()=>app.openShop(),'#f5d675');
 button(app,27,608,321,54,'玩法规则与新手说明',()=>app.openGuide(),'#cbe7dc');
 label(c,'清除微信本地数据或更换设备后，记录可能丢失',187,703,12,soft,'center');
}
function shopScreen(app){
 const c=app.ctx,p=app.profile;
 const {THEMES}=require('./player-profile');
 heading(app,'幸运星商店','免费对局获取 · 无内购与提现');
 back(app);
 box(c,24,132,327,63,'#fff0d6');
 label(c,'★ 当前幸运星 '+p.stars,187,164,22,ink,'center','bold');
 THEMES.forEach((item,i)=>{
  const y=216+i*116,owned=p.owned.includes(item.id),active=p.theme===item.id;
  box(c,25,y,327,101,panel);
  box(c,40,y+18,60,60,item.paper,soft,10);
  label(c,item.label,112,y+35,17,ink,'left','bold');
  label(c,item.cost===0?'初始主题':owned?'已拥有':'兑换需要 '+item.cost+' 星',112,y+70,12,soft);
  button(app,240,y+29,95,43,active?'使用中':owned?'使用':'兑换',
   ()=>app.buyTheme(item.id),active?'#e4e9e4':'#f5d675',active);
 });
 label(c,'主题仅更换纸张背景；余额只保存在当前设备',187,718,12,soft,'center');
}
function guideScreen(app){
 const c=app.ctx;
 heading(app,'玩法规则','起飞、跳跃、飞越、撞机与胜负');
 back(app);
 const lines=[
  ['01 选择模式','单机挑战 3 名电脑，或创建四座位好友房间'],
  ['02 回合掷骰','轮流投骰并点击可移动的棋子'],
  ['03 起飞条件','默认掷出 6 点；也可设置 5/6 点或偶数起飞'],
  ['04 六点连投','投出 6 点可额外行动，第三次按房规处理'],
  ['05 跳跃与飞行','符合条件的同色格跳 4 格，专属航线飞越'],
  ['06 碰撞与终点','撞到对手使其回机场；超过终点可反弹'],
  ['07 游戏获胜','最先将己方 4 枚飞机全部送达终点获胜'],
  ['08 联机说明','玩家准备后房主开局，掉线可通过房间码返回']
 ];
 lines.forEach(([head,detail],i)=>{
  const y=136+i*69;
  box(c,23,y,329,61,i%2===0?'#fffdf5':'#f3f1e8',null,9);
  label(c,head,37,y+17,15,ink,'left','bold');
  label(c,detail,37,y+43,12,soft);
 });
 button(app,26,700,323,43,'返回首页',()=>{app.scene='home';app.say('');},'#cbe7dc');
}
function draw(app){
 const c=app.ctx;
 if(!c)return;
 const dpr=app.pixelRatio||1;
 c.setTransform(dpr,0,0,dpr,0,0);
 const selectedTheme=require('./player-profile').theme(app.profile||{theme:'classic'});
 c.fillStyle=selectedTheme.paper;c.fillRect(0,0,app.canvas.width/dpr,app.canvas.height/dpr);
 c.setTransform(dpr*app.scale,0,0,dpr*app.scale,dpr*app.dx,dpr*app.dy);
 c.fillStyle=selectedTheme.paper;c.fillRect(0,0,375,812);
 app.buttons=[];app.tokenTargets=[];
 if(app.scene==='home')home(app);
 else if(app.scene==='profile')profileScreen(app);
 else if(app.scene==='shop')shopScreen(app);
 else if(app.scene==='guide')guideScreen(app);
 else if(app.scene==='setup')setup(app);
 else if(app.scene==='room'&&app.room&&app.room.status==='waiting')waiting(app);
 else if(app.scene==='local'||app.scene==='room'&&app.room&&app.room.game)playing(app);
 else{heading(app,'正在连接好友房间','请稍后重试');button(app,27,585,321,50,'返回',()=>app.scene='home');}
 footer(app);
}
module.exports={draw};
