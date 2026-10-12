'use strict';
const {FlyingOnlineClient,ROOM}=require('./flying-online-client');
const {Flying}=require('./flying-model');
const L=require('./ui-layout');
const artLayout=require('./flying-art-layout');
const config=require('./cloud-config');
const COLOR={Y:'#F8D965',B:'#7CC6E8',R:'#F39C8C',G:'#A8DAB9'};
const NAME={Y:'黄方',B:'蓝方',R:'红方',G:'绿方'};
function install(App){
 const p=App.prototype,base={setup:p.flyingSetup,render:p.render,update:p.update,go:p.go,share:p.buildShareContent,entry:p.handleShareEntry,pause:p.pause};
 p.onlineClient=function(){
  if(!this.onlineFlying)this.onlineFlying=new FlyingOnlineClient(this.platform,config,client=>{
   const r=client.room,roll=r&&r.lastRoll;
   if(roll&&this.onlineSnapshotSeen&&this.onlineRollSeen!==roll.id)this.onlineRolling=1.28;
   this.onlineRollSeen=roll?roll.id:null;this.onlineSnapshotSeen=true;
  });return this.onlineFlying;
 };
 p.openOnlineFlying=function(action='join',id){this.onlineRollSeen=null;this.onlineSnapshotSeen=false;this.onlineRolling=0;this.go('flyingRoom');return this.onlineClient().enter(action,id);};
 p.joinFlyingClipboard=function(){
  if(!this.platform.getClipboardData){this.toast('请通过好友的邀请卡片加入');return;}
  this.platform.getClipboardData({success:res=>{const id=String(res.data||'').trim();if(ROOM.test(id))this.openOnlineFlying('join',id);else this.toast('剪贴板中没有完整房间码');},fail:()=>this.toast('未能读取房间码，请通过邀请卡片加入')});
 };
 p.go=function(screen){if(this.screen==='flyingRoom'&&screen!=='flyingRoom'&&this.onlineFlying)this.onlineFlying.stop();return base.go.call(this,screen);};
 p.flyingSetup=function(){
  this.backHeader('好友飞行棋','四人联机 · 直接在合集里玩',()=>{this.mode='派对';this.go('home');});
  this.flyingArt('FG-BOARD-001',94,157,187,207);
  this.text('创建房间，邀请三位好友',187,402,19,'#283748','center',true);
  this.button('创建四人联机房间',24,439,327,50,()=>this.openOnlineFlying('create'));
  this.button('粘贴房间码加入',24,505,327,48,()=>this.joinFlyingClipboard(),'#BDDDC5','#283748');
  const last=this.onlineClient().stored('collectionFlyingRoom');
  if(last)this.button('返回上次房间',24,570,327,48,()=>this.openOnlineFlying('join',last),'#FFFCF3','#283748');
  this.button('同机轮流试玩',24,641,327,48,()=>this.go('flyingLocalSetup'),'#FFFCF3','#283748');
  this.text('联机需四人到齐并准备后开局',187,741,13,'#778079','center');
 };
 p.flyingRoomView=function(){
  const client=this.onlineClient(),r=client.room;
  this.backHeader('好友飞行棋',r?'四人联机 · 同一房间':'正在连接房间…',()=>this.leaveOnlineFlying());
  if(!r){this.text(client.error||'正在连接云端…',187,270,15,'#283748','center');if(!client.busy)this.button('返回飞行棋',24,420,327,48,()=>this.go('flyingSetup'));return;}
  if(r.status==='closed'){this.text('房间已关闭',187,260,22,'#283748','center');this.button('返回派对',24,430,327,48,()=>this.go('flyingSetup'));return;}
  const count=r.seats.filter(Boolean).length;
  if(r.status==='waiting'){
   this.text('好友已到齐 '+count+' / 4',187,147,22,'#283748','center',true);
   r.seats.forEach((seat,i)=>{const x=24+i%2*169,y=188+Math.floor(i/2)*128;this.rect(x,y,158,114,seat?COLOR[seat.color]:'#FFFCF3');if(seat)this.flyingArt('FG-AVATAR-'+seat.color,x+8,y+10,52,52);this.text(seat?seat.name:'等待好友',x+79,y+80,15,'#283748','center');this.text(seat?(seat.ready?'已准备':'尚未准备'):'空座位',x+79,y+101,12,'#283748','center');});
   if(count<4)this.button('邀请好友（'+count+' / 4）',24,470,327,48,()=>this.inviteOnlineFlying());else this.text('四位好友已到齐',187,494,16,'#283748','center');
   const mine=r.seats[r.seat];this.onlineButton(mine&&mine.ready?'取消准备':'我准备好了',24,535,327,48,'ready');
   if(r.isHost){if(count===4&&r.seats.every(s=>s.ready))this.onlineButton('四人准备好了，开始',24,600,327,48,'start');else this.text('等四人全部准备后，由房主开局',187,625,12,'#778079','center');}
   this.button('复制房间码',24,669,158,44,()=>{if(this.platform.setClipboardData)this.platform.setClipboardData({data:r.id});},'#FFFCF3','#283748');
   this.button('刷新房间',193,669,158,44,()=>client.sync(),'#FFFCF3','#283748');
  }else if(r.game){
   const g=Object.assign(new Flying(4),r.game),myTurn=r.status==='playing'&&g.turn===r.seat,legal=myTurn?g.legal():[];
   this.text(r.status==='done'?NAME[g.colors[g.winner]]+'获胜！':'轮到 '+r.seats[g.turn].name,187,157,19,'#283748','center',true);
   const result=this.drawAsset('FG-BOARD-001',L.flying.board.x,L.flying.board.y,L.flying.board.width,L.flying.board.height),b=result.bounds;
   if(result.status!=='ready'){const paths=require('./flying-paths');for(const point of paths.ring){const at=artLayout.project(point,b);this.rect(at.x-6,at.y-6,12,12,'#BDDDC5',2);}}
   if(result.status==='ready')for(const color of g.colors){const a=artLayout.airportBounds(color,b);this.flyingArt('FG-AIRPORT-'+color,a.x,a.y,a.width,a.height);}
   const canMove=myTurn&&!client.busy&&!client.pending&&!this.onlineRolling;
   const grouped={};g.colors.forEach((color,player)=>g.pieces[player].forEach((n,piece)=>{if(n===57)return;const pos=g.position(player,piece),key=pos.x+','+pos.y;(grouped[key]||(grouped[key]=[])).push({color,player,piece,pos});}));
   Object.values(grouped).forEach(group=>group.forEach((t,i)=>{const at=artLayout.project(t.pos,b),x=at.x+(group.length>1?(i%4-1.5)*8:0),y=at.y+(group.length>4?Math.floor(i/4)*8:0);if(!this.flyingArt('FG-TOKEN-'+t.color,x-9,y-9,18,18))this.circle(x,y,8,COLOR[t.color]);this.text(t.piece+1,x,y,9,'#283748','center',true);if(canMove&&t.player===g.turn&&legal.includes(t.piece)){this.ctx.strokeStyle='#283748';this.ctx.lineWidth=2;this.ctx.beginPath();this.ctx.arc(x,y,12,0,Math.PI*2);this.ctx.stroke();this.buttons.push({label:'移动飞机'+(t.piece+1),x:x-18,y:y-18,w:36,h:36,fn:()=>client.command('move',{piece:t.piece})});}}));
   if(this.onlineRolling){const frame=Math.floor((1.28-this.onlineRolling)/.08);this.ctx.save();this.ctx.translate(71,593);this.ctx.rotate(frame*Math.PI/4);this.flyingArt('FG-DICE-00',-30,-30,60,60);this.ctx.restore();}else this.drawFlyingDie(L.flying.dice.x,L.flying.dice.y,L.flying.dice.width,g.die||1);
   this.text(r.status==='playing'?'剩余 '+client.seconds()+' 秒':'对局结束',245,550,13,'#778079','center');
   if(r.status==='done'){if(r.isHost)this.onlineButton('再开一局',L.flying.primary.x,L.flying.primary.y,L.flying.primary.width,L.flying.primary.height,'rematch');}
   else if(myTurn&&g.phase==='roll')this.onlineButton('掷骰子',L.flying.primary.x,L.flying.primary.y,L.flying.primary.width,L.flying.primary.height,'roll');
   else this.text(myTurn?'点击高亮飞机移动':'等待好友操作',245,604,14,'#283748','center');
   if(canMove&&g.phase==='choose')legal.forEach((piece,i)=>this.onlineButton('飞机 '+(piece+1),L.flying.choices[i].x,L.flying.choices[i].y,L.flying.choices[i].width,L.flying.choices[i].height,'move',{piece}));
   if(r.status==='playing'&&client.seconds()===0)this.onlineButton('跳过超时回合',24,684,327,44,'timeout');
  }
  if(client.pending&&!client.busy)this.button('重试待确认操作',24,735,327,44,()=>client.retry(),'#F39C8C','#283748');
  if(client.error){const msg=String(client.error);this.text(msg.slice(0,23),187,793,11,'#A34232','center');}
  if(client.busy)this.text('同步中…',187,795,12,'#778079','center');
 };
 p.onlineButton=function(label,x,y,w,h,action,extra){const c=this.onlineClient();if(c.busy||c.pending||this.onlineRolling){this.rect(x,y,w,h,'#DDD8CA');this.text(label,x+w/2,y+h/2,14,'#778079','center');}else this.button(label,x,y,w,h,()=>c.command(action,extra));};
 p.leaveOnlineFlying=async function(){const c=this.onlineClient(),r=c.room;if(c.busy){this.toast('正在同步，请稍候');return;}if(c.pending){this.toast('请先确认待处理操作');return;}if(r&&r.status==='waiting'){if(!await c.command('leave'))return;try{this.platform.removeStorageSync('collectionFlyingRoom');}catch(_){}}this.mode='派对';this.go('home');};
 p.inviteOnlineFlying=function(){const c=this.onlineClient(),r=c.room;if(!r||r.status!=='waiting'||r.seats.filter(Boolean).length>=4)return;if(!this.platform.shareAppMessage){this.toast('当前环境不支持邀请，请复制房间码');return;}this.platform.shareAppMessage({...this.buildShareContent(),fail:()=>this.toast('未发送邀请，可复制房间码加入')});};
 p.buildShareContent=function(){const r=this.onlineFlying&&this.onlineFlying.room;if(this.screen!=='flyingRoom'||!r)return base.share.call(this);const count=r.seats.filter(Boolean).length;const out={title:r.status==='waiting'&&count<4?'来玩手绘飞行棋，房间还差 '+(4-count)+' 人':'这局四人飞行棋已经到齐',query:'from=share&game=flying&roomId='+r.id};const image=this.assetFiles&&this.assetFiles['FG-BOARD-001'];if(image)out.imageUrl=image;return out;};
 p.handleShareEntry=function(query){if(query&&query.game==='flying'&&ROOM.test(query.roomId||'')){if(this.screen==='flyingRoom'&&this.onlineFlying&&(this.onlineFlying.room&&this.onlineFlying.room.id===query.roomId||this.onlineFlying.busy))return true;this.openOnlineFlying('join',query.roomId);return true;}return base.entry.call(this,query);};
 p.pause=function(){if(this.screen==='flyingRoom'&&this.onlineFlying){this.onlineFlying.hide();this.cancel();return;}return base.pause.call(this);};
 p.resumeOnline=function(){if(this.onlineFlying&&this.screen==='flyingRoom')this.onlineFlying.show();};
 p.update=function(dt){base.update.call(this,dt);if(this.screen==='flyingRoom'&&!(this.onlineFlying&&this.onlineFlying.hidden))this.onlineRolling=Math.max(0,(this.onlineRolling||0)-dt);};
 p.render=function(){if(!['flyingRoom','flyingLocalSetup'].includes(this.screen))return base.render.call(this);this.initUI();const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#FAF5E9';c.fillRect(0,0,this.width,this.height);c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);this.buttons=[];if(this.screen==='flyingRoom')this.flyingRoomView();else base.setup.call(this);this.paper();};
}
module.exports={install};
