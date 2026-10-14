const {call}=require('../../lib/api');
const {Flying}=require('../../lib/flying-model');
const paths=require('../../lib/flying-paths');
const assets=require('../../lib/flying-assets').files;
const config=require('../../config');
const HEX={R:'#ed9887',Y:'#f0d16c',B:'#7ebfdc',G:'#94cda7'};
const NAME={R:'红方',Y:'黄方',B:'蓝方',G:'绿方'};
Page({
 data:{room:{status:'loading'},seats:[],busy:false,connected:false,error:'',legal:[],seconds:60,pending:false,rolling:false,
  botCountIndex:0,botDifficultyIndex:1,botCountLabels:['0台','1台','2台','3台'],botDifficultyLabels:['简单','普通','困难']},
 onLoad(options){
  this.roomId=options.roomId;this.images={};this.offset=0;
  const pending=wx.getStorageSync('flyingPending');
  if(pending&&pending.roomId===this.roomId){this.pending=pending;this.setData({pending:true});}
  this.join();
 },
 onReady(){wx.createSelectorQuery().in(this).select('#board').fields({node:true,size:true}).exec(res=>{
  if(!res[0])return;this.canvas=res[0].node;this.size=res[0].width;
  const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
  this.canvas.width=this.size*info.pixelRatio;this.canvas.height=this.size*info.pixelRatio;
  this.ctx=this.canvas.getContext('2d');this.ctx.scale(info.pixelRatio,info.pixelRatio);for(let i=0;i<16;i++)this.asset('FG-DICE-'+String(i).padStart(2,'0'));this.draw();
 });},
 onShow(){this.hidden=false;if(this.roomId&&this.data.room.id)this.poll();},
 onHide(){this.hidden=true;clearTimeout(this.timer);clearTimeout(this.animation);this.setData({rolling:false});},
 onUnload(){this.destroyed=true;clearTimeout(this.timer);clearTimeout(this.animation);},
 async join(){try{const r=await call('join',{roomId:this.roomId});if(this.destroyed)return;wx.setStorageSync('flyingRoomId',this.roomId);this.accept(r);this.poll();}catch(e){this.setData({error:e.message,connected:false});}},
 accept(result){
  if(this.destroyed)return;const room=result.room;
  if(this.data.room.id&&room.revision<this.data.room.revision)return;
  this.offset=result.serverNow-Date.now();
  const oldRoll=this.data.room.lastRoll;
  const animate=room.lastRoll&&this.data.room.id&&(!oldRoll||room.lastRoll.id!==oldRoll.id);
  const seats=room.seats.map((p,i)=>p?{index:i,name:p.name,colorHex:HEX[p.color],
   label:p.bot?('AI · '+({easy:'简单',normal:'普通',hard:'困难'}[p.difficulty]||'普通')):
    room.status==='waiting'?(p.ready?'已准备':'尚未准备'):(room.game&&room.game.turn===i?'当前回合':'已入座')}
   :{index:i,name:'等待好友',colorHex:'#c8c5b9',label:'空座位'});
  const myTurn=room.game&&room.game.turn===room.seat&&room.status==='playing';
  const g=room.game&&Object.assign(new Flying(4),room.game);
  const rule=room.rules||(room.game&&room.game.rules)||{};
  const launch={six:'6点',fiveSix:'5或6点',even:'偶数点'}[rule.launch]||'6点';
  const rulesSummary=launch+'起飞 · '+(rule.jump===false?'无跳子':'同色跳4格')+' · '+(rule.flight===false?'无飞越':'虚线飞12格')+' · '+(rule.bounce===false?'必须精准到达':'超点反弹');
  const config=room.botConfig||{count:0,difficulty:'normal'};
  const botSettings=(!this.data.room.id||this.data.room.revision!==room.revision)?
   {botCountIndex:config.count,botDifficultyIndex:Math.max(0,['easy','normal','hard'].indexOf(config.difficulty))}:{};
  this.setData({...botSettings,room,seats,myTurn,rulesSummary,legal:myTurn?g.legal():[],count:room.seats.filter(Boolean).length,allReady:room.seats.every(p=>p&&p.ready),myReady:!!(room.seats[room.seat]&&room.seats[room.seat].ready),connected:true,statusText:room.status==='closed'?'房间已关闭':room.status==='done'?NAME[room.game.colors[room.game.winner]]+'获胜！':room.game?'轮到'+room.seats[room.game.turn].name:'等待好友'});
  this.clock();this.draw();if(animate&&!this.hidden)this.animateDie();
 },
 clock(){this.setData({seconds:Math.max(0,Math.ceil((this.data.room.deadline-Date.now()-this.offset)/1000))});},
 async poll(){
  clearTimeout(this.timer);if(this.hidden||this.destroyed)return;
  if(!this.data.busy){try{this.accept(await call('get',{roomId:this.roomId}));}catch(e){if(!this.destroyed)this.setData({connected:false,error:e.message});}}
  if(!this.hidden&&!this.destroyed)this.timer=setTimeout(()=>this.poll(),1500);
 },
 async command(action,extra={}){
  if(this.data.busy)return;
  if(this.pending){this.setData({error:'请先重试并确认上一次操作'});return;}
  this.pending=Object.assign({roomId:this.roomId,action,revision:this.data.room.revision,requestId:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14)},extra);
  wx.setStorageSync('flyingPending',this.pending);this.setData({pending:true});await this.sendPending();
 },
 async sendPending(){
  if(!this.pending||this.data.busy)return;this.setData({busy:true,error:''});
  try{const request=this.pending;const r=await call(request.action,request);this.pending=null;wx.removeStorageSync('flyingPending');this.setData({pending:false});this.accept(r);if(request.action==='roll'&&!this.hidden)this.animateDie();}
  catch(e){
   if(e.code&&e.code!=='SERVER'){this.pending=null;wx.removeStorageSync('flyingPending');this.setData({pending:false});}
   if(!this.destroyed)this.setData({error:e.message});
   try{this.accept(await call('get',{roomId:this.roomId}));}catch(_){}
  }finally{if(!this.destroyed)this.setData({busy:false});}
 },
 botCountChange(e){this.setData({botCountIndex:Number(e.detail.value)});},
 botDifficultyChange(e){this.setData({botDifficultyIndex:Number(e.detail.value)});},
 saveBots(){this.command('setBots',{count:this.data.botCountIndex,difficulty:['easy','normal','hard'][this.data.botDifficultyIndex]});},
 reconnect(){if(this.data.room.id)this.poll();else this.join();},retry(){this.sendPending();},ready(){this.command('ready');},start(){this.command('start');},roll(){this.command('roll');},move(e){this.command('move',{piece:Number(e.currentTarget.dataset.piece)});},timeout(){this.command('timeout');},rematch(){this.command('rematch');},
 onShareAppMessage(){return {title:'来玩手绘飞行棋！四人房间还差你',path:'/pages/room/room?roomId='+this.roomId};},
 copyRoom(){wx.setClipboardData({data:this.roomId});},
 async leave(){
  if(this.data.room.status==='playing'){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/index/index'})});return;}
  await this.command('leave');if(!this.data.error){wx.removeStorageSync('flyingRoomId');wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/index/index'})});}
 },
 asset(id){
  if(!config.assetBaseUrl||!this.canvas||!assets[id])return null;
  if(this.images[id])return this.images[id].ready?this.images[id].image:null;
  const image=this.canvas.createImage(),entry={image,ready:false};this.images[id]=entry;
  image.onload=()=>{entry.ready=true;this.draw();};image.onerror=()=>{};
  image.src=config.assetBaseUrl.replace(/\/$/,'')+'/'+assets[id];return null;
 },
 draw(){
  if(!this.ctx)return;const c=this.ctx,s=this.size,k=s/paths.width;
  c.clearRect(0,0,s,s);c.fillStyle='#fffdf5';c.fillRect(0,0,s,s);
  const board=this.asset('FG-BOARD-001');
  if(board)c.drawImage(board,0,0,s,s);
  else {
   paths.ring.forEach((p,i)=>{c.fillStyle=Object.values(HEX)[i%4];c.fillRect(p.x*k-6,p.y*k-6,12,12);c.strokeStyle='#465446';c.strokeRect(p.x*k-6,p.y*k-6,12,12);});
   Object.keys(paths.colors).forEach(color=>{c.fillStyle=HEX[color];paths.colors[color].home.forEach(p=>c.fillRect(p.x*k-6,p.y*k-6,12,12));paths.colors[color].airport.forEach(p=>{c.beginPath();c.arc(p.x*k,p.y*k,10,0,Math.PI*2);c.stroke();});});
  }
  const g=this.data.room.game&&Object.assign(new Flying(4),this.data.room.game);this.hit=[];
  if(!g)return;
  const groups={};
  g.colors.forEach((color,player)=>g.pieces[player].forEach((progress,piece)=>{if(progress===57)return;const p=g.position(player,piece),key=p.x+','+p.y;(groups[key]||(groups[key]=[])).push({color,player,piece,p});}));
  Object.values(groups).forEach(group=>group.forEach((t,index)=>{
   const dx=group.length>1?(index%4-1.5)*10:0,dy=group.length>4?Math.floor(index/4)*10-5:0;
   const x=t.p.x*k+dx,y=t.p.y*k+dy,image=this.asset('FG-TOKEN-'+t.color);
   if(image)c.drawImage(image,x-9,y-9,18,18);else{c.fillStyle=HEX[t.color];c.strokeStyle='#283748';c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fill();c.stroke();}
   c.fillStyle='#283748';c.font='10px sans-serif';c.textAlign='center';c.fillText(String(t.piece+1),x,y+3);
   if(this.data.myTurn&&this.data.legal.includes(t.piece)&&t.player===g.turn){c.lineWidth=2;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.stroke();this.hit.push({x,y,piece:t.piece});}
  }));
  if(this.data.rolling){const image=this.asset('FG-DICE-'+String(this.diceFrame||0).padStart(2,'0'));if(image)c.drawImage(image,s/2-20,s/2-20,40,40);}
 },
 boardTap(e){if(this.data.busy||this.data.rolling||!this.hit)return;const t=e.changedTouches[0];const sorted=this.hit.map(p=>Object.assign({},p,{d:Math.hypot(t.x-p.x,t.y-p.y)})).sort((a,b)=>a.d-b.d);if(sorted[0]&&sorted[0].d<20)this.command('move',{piece:sorted[0].piece});},
 animateDie(){clearTimeout(this.animation);this.setData({rolling:true});this.diceFrame=0;const frame=()=>{if(this.hidden||this.destroyed)return;this.draw();this.diceFrame++;if(this.diceFrame<16)this.animation=setTimeout(frame,80);else{this.setData({rolling:false});this.draw();}};frame();}
});
