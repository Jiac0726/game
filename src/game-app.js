'use strict';
const {Flying,DEFAULT_RULES}=require('./flying-model');
const {chooseMove}=require('./flying-ai');
const {buildFrames}=require('./flying-motion');
const {createClient}=require('./api');
const profileLib=require('./player-profile');
const view=require('./view');
const COLORS={R:'#f39c8c',Y:'#f6d767',B:'#7cc6e8',G:'#99d8ac'};
class FlyingChessGame{
 constructor(wxApi){
  this.wx=wxApi;
  this.api=createClient(wxApi);
  this.scene='home';this.rules=Object.assign({},DEFAULT_RULES);
  this.profile=profileLib.load(wxApi);this.sessionSeq=0;this.localMatchId='';
  this.botCount=3;this.difficulty='normal';this.nickname='玩家';
  this.room=null;this.roomId='';this.local=null;
  this.hidden=false;this.busy=false;this.message='';
  this.cache={};this.buttons=[];this.tokenTargets=[];
  this.rollEnd=0;this.rollFrame=0;this.botFrames=[];this.botFrameIndex=0;this.botFrameUntil=0;this.lastMotionId='';
  this.revision=-1;this.offsetTime=0;this.polling=false;this.timer=null;this.keyboardMode=null;
  this.scale=1;this.dx=0;this.dy=0;this.width=375;this.height=812;
  this.pending=null;
 }
 boot(){
  const wxApi=this.wx;
  this.canvas=wxApi.createCanvas();
  this.ctx=this.canvas.getContext('2d');
  this.resize();
  if(wxApi.onWindowResize)wxApi.onWindowResize(()=>this.resize());
  if(wxApi.onTouchEnd)wxApi.onTouchEnd(e=>this.touch(e));
  if(wxApi.showShareMenu)wxApi.showShareMenu({withShareTicket:false});
  if(wxApi.onShareAppMessage)wxApi.onShareAppMessage(()=>({
   title:'好友飞行棋 · 来我的房间一起玩！',
   query:this.roomId?'roomId='+this.roomId:''
  }));
  if(wxApi.onKeyboardConfirm)wxApi.onKeyboardConfirm(e=>this.keyboardConfirm(e));
  if(wxApi.onShow)wxApi.onShow(opt=>this.show(opt));
  if(wxApi.onHide)wxApi.onHide(()=>this.hide());
  try{
   const v=wxApi.getStorageSync&&wxApi.getStorageSync('flyingNickname');
   if(v)this.nickname=String(v).slice(0,12);
   this.pending=wxApi.getStorageSync&&wxApi.getStorageSync('flyingPending');
  }catch(_){}
  this.hidden=false;
  const launch=wxApi.getLaunchOptionsSync?wxApi.getLaunchOptionsSync():{};
  this.openShare(launch&&launch.query);
  this.startTicker();
  this.render();
 }
 resize(){
  const info=this.wx.getWindowInfo?this.wx.getWindowInfo():
   (this.wx.getSystemInfoSync?this.wx.getSystemInfoSync():{windowWidth:375,windowHeight:812,pixelRatio:1});
  const w=info.windowWidth||375,h=info.windowHeight||812,dpr=info.pixelRatio||1;
  this.canvas.width=Math.ceil(w*dpr);this.canvas.height=Math.ceil(h*dpr);
  this.pixelRatio=dpr;
  this.scale=Math.min(w/375,h/812);
  this.dx=(w-375*this.scale)/2;this.dy=(h-812*this.scale)/2;
  this.render();
 }
 startTicker(){
  if(this.looping)return;this.looping=true;
  let last=Date.now();
  const tick=()=>{
   if(!this.looping)return;
   const now=Date.now(),dt=Math.min(.2,(now-last)/1000);last=now;
   if(!this.hidden){this.update(dt,now);this.render();}
   if(this.canvas&&this.canvas.requestAnimationFrame)this.canvas.requestAnimationFrame(tick);
   else this.loopTimer=setTimeout(tick,45);
  };
  tick();
 }
 stopTicker(){this.looping=false;clearTimeout(this.loopTimer);}
 show(options){
  this.hidden=false;
  if(options&&options.query&&options.query.roomId&&options.query.roomId!==this.roomId)
   this.openShare(options.query);
  if(this.roomId)this.schedulePoll(0);
 }
 hide(){
  this.hidden=true;clearTimeout(this.timer);this.timer=null;this.botFrames=[];
 }
 openShare(query){
  const id=query&&query.roomId;
  if(typeof id==='string'&&/^[a-f0-9]{32}$/.test(id))this.joinRoom(id);
 }
 asset(id){
  const images=require('./flying-assets').files;
  const p=images[id];if(!p||!this.wx.createImage)return null;
  if(this.cache[id])return this.cache[id].state==='ready'?this.cache[id].image:null;
  const i=this.wx.createImage(),entry={image:i,state:'loading'};this.cache[id]=entry;
  i.onload=()=>{entry.state='ready';};
  i.onerror=()=>{entry.state='error';};
  i.src=require('./config').assetBaseUrl.replace(/\/$/,'')+'/'+p.split('/').map(encodeURIComponent).join('/');
  return null;
 }
 render(){if(this.ctx&&this.canvas)view.draw(this);}
 touch(e){
  if(this.hidden||this.busy)return;
  const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
  const x=((t.clientX===undefined?t.pageX:t.clientX)-this.dx)/this.scale;
  const y=((t.clientY===undefined?t.pageY:t.clientY)-this.dy)/this.scale;
  const hit=[...this.buttons].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  if(hit){hit.action();return;}
  const closest=this.tokenTargets.map(p=>Object.assign({distance:Math.hypot(x-p.x,y-p.y)},p))
   .sort((a,b)=>a.distance-b.distance)[0];
  if(closest&&closest.distance<=23)this.move(closest.piece);
 }
 say(message){this.message=String(message||'');this.render();}
 keyboard(kind){
  if(!this.wx.showKeyboard){this.say('请使用邀请链接加入房间');return;}
  this.keyboardMode=kind;
  this.wx.showKeyboard({defaultValue:kind==='name'?this.nickname:'',maxLength:kind==='room'?32:12,multiple:false,confirmType:'done'});
 }
 keyboardConfirm(e){
  const kind=this.keyboardMode;this.keyboardMode=null;
  if(this.wx.hideKeyboard)this.wx.hideKeyboard();
  const value=String(e&&e.value||'').trim();
  if(kind==='name'){this.nickname=value.slice(0,12)||'玩家';this.wx.setStorageSync&&this.wx.setStorageSync('flyingNickname',this.nickname);}
  else if(kind==='room'){
   if(!/^[a-f0-9]{32}$/.test(value))this.say('房间码应为32位字符');
   else this.joinRoom(value);
  }
 }
 setup(online){this.onlineSetup=online;this.scene='setup';this.say('');}
 openProfile(){this.scene='profile';this.say('');}
 openShop(){this.scene='shop';this.say('');}
 openGuide(){this.scene='guide';this.say('');}
 buyTheme(themeId){
  try{
   const result=profileLib.buyOrEquip(this.wx,this.profile,themeId);
   this.profile=result.profile;this.say(result.message);
  }catch(e){this.say('主题保存失败：'+e.message);}
 }
 rewardMatch(id,won,online){
  try{
   const r=profileLib.reward(this.wx,this.profile,id,won,online);
   this.profile=r.profile;
   if(!r.duplicate)this.message='对局完成，获得 '+r.earned+' 颗幸运星';
  }catch(e){this.message='本机战绩保存失败';}
 }
 rewardLocalIfDone(){
  if(this.scene==='local'&&this.local&&this.local.phase==='done'&&this.localMatchId)
   this.rewardMatch(this.localMatchId,this.local.winner===0,false);
 }
 localStart(){
  this.local=new Flying(4,Math.random,this.rules);
  this.localMatchId='local:'+Date.now().toString(36)+':'+(++this.sessionSeq);
  this.scene='local';this.room=null;this.roomId='';
  this.lastMotionId='';this.botFrames=[];this.rollEnd=0;this.localAiAt=0;
  this.say('单机挑战：你是红方');
 }
 async createRoom(){
  if(this.busy)return;this.busy=true;
  this.say('正在创建房间…');
  try{
   const result=await this.api.call('create',{name:this.nickname,rules:this.rules,bots:{count:this.botCount,difficulty:this.difficulty}});
   this.roomId=result.room.id;this.scene='room';this.accept(result);
   this.wx.setStorageSync&&this.wx.setStorageSync('flyingRoomId',this.roomId);
   this.schedulePoll(1500);
  }catch(e){this.say(e.message);}
  finally{this.busy=false;}
 }
 async joinRoom(id){
  if(this.busy)return;
  this.busy=true;this.say('正在加入房间…');
  try{
   const r=await this.api.call('join',{roomId:id,name:this.nickname});
   this.roomId=id;this.scene='room';this.accept(r);
   this.wx.setStorageSync&&this.wx.setStorageSync('flyingRoomId',id);
   this.schedulePoll(1500);
  }catch(e){this.say(e.message);}
  finally{this.busy=false;}
 }
 accept(result){
  if(!result||!result.room)return;
  const next=result.room,prev=this.room;
  if(prev&&next.id===prev.id&&next.revision<prev.revision)return;
  this.offsetTime=(result.serverNow||Date.now())-Date.now();
  const isNewMotion=!!(prev&&prev.id===next.id&&next.revision>prev.revision
   &&next.motion&&next.motion.id!==this.lastMotionId);
  this.room=next;this.revision=next.revision;
  if(next.motion)this.lastMotionId=next.motion.id;
  if(isNewMotion&&next.game&&Array.isArray(next.game.colors)&&next.motion.events&&next.motion.events.length){
   this.botFrames=buildFrames(next.motion,next.game.colors);this.botFrameIndex=0;
   this.botFrameUntil=Date.now()+(this.botFrames[0]&&this.botFrames[0].duration||0);
  }
  if(next.status==='done'){
   this.botFrames=[];
   if(next.game&&Number.isInteger(next.game.winner)&&next.seat>=0)
    this.rewardMatch('online:'+next.id+':'+(next.round||1),next.game.winner===next.seat,true);
  }
  this.render();
 }
 async refresh(){
  if(!this.roomId||this.polling||this.hidden)return;
  this.polling=true;
  try{const r=await this.api.call('get',{roomId:this.roomId});this.accept(r);}
  catch(e){this.say('连接中断：'+e.message);}
  finally{this.polling=false;}
 }
 schedulePoll(delay){
  clearTimeout(this.timer);this.timer=null;
  if(this.hidden||!this.roomId)return;
  this.timer=setTimeout(async()=>{
   await this.refresh();
   if(!this.hidden&&this.roomId)this.schedulePoll(1500);
  },delay);
 }
 async command(action,extra={}){
  if(this.busy||!this.roomId||!this.room)return;
  this.busy=true;
  const obj={action,roomId:this.roomId,revision:this.room.revision,
   requestId:'g'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,11),...extra};
  this.pending=obj;
  if(this.wx.setStorageSync)this.wx.setStorageSync('flyingPending',obj);
  await this.sendPending();
 }
 async sendPending(){
  const request=this.pending;
  if(!request){this.busy=false;return;}
  this.busy=true;
  try{
   const {action,...args}=request;
   const r=await this.api.call(action,args);
   this.pending=null;this.wx.removeStorageSync&&this.wx.removeStorageSync('flyingPending');
   this.accept(r);
   if(action==='roll'){this.rollEnd=Date.now()+480;}
   if(action==='leave'){this.room=null;this.roomId='';this.scene='home';}
   this.say('');
  }catch(e){
   if(e.code&&e.code!=='SERVER'){
    this.pending=null;this.wx.removeStorageSync&&this.wx.removeStorageSync('flyingPending');
   }
   this.say(e.message);
   try{await this.refresh();}catch(_){}
  }finally{this.busy=false;}
 }
 async share(){
  if(!this.roomId)return;
  if(this.wx.shareAppMessage){
   this.wx.shareAppMessage({title:'来玩手绘飞行棋！',query:'roomId='+this.roomId});
  }else{
   this.wx.setClipboardData&&this.wx.setClipboardData({data:this.roomId});
   this.say('已复制房间码，请发送给好友');
  }
 }
 async exitRoom(){
  const room=this.room;
  if(room&&room.status==='waiting'){await this.command('leave');}
  else{this.scene='home';this.room=null;this.roomId='';this.botFrames=[];clearTimeout(this.timer);}
 }
 canMove(){
  if(this.botFrames.length||this.busy||this.rollEnd>Date.now())return false;
  if(this.scene==='local')return this.local&&this.local.turn===0&&this.local.phase==='choose';
  if(this.scene==='room'&&this.room&&this.room.status==='playing'){
   return this.room.game&&this.room.game.turn===this.room.seat&&this.room.game.phase==='choose';
  }
  return false;
 }
 game(){return this.scene==='local'?this.local:this.room&&this.room.game;}
 move(piece){
  if(!this.canMove())return;
  const g=this.game();
  const sim=Object.assign(new Flying(4),g);
  if(!sim.legal().includes(piece))return;
  if(this.scene==='local'){this.local.move(piece);this.rewardLocalIfDone();this.render();}
  else this.command('move',{piece});
 }
 roll(){
  if(this.busy||this.botFrames.length)return;
  if(this.scene==='local'&&this.local&&this.local.turn===0&&this.local.phase==='roll'){
   this.local.roll();if(!this.local.legal().length)this.local.pass();
   this.rollEnd=Date.now()+480;this.render();
  }else if(this.scene==='room'&&this.room&&this.room.status==='playing'&&
   this.room.game&&this.room.game.turn===this.room.seat&&this.room.game.phase==='roll')this.command('roll');
 }
 update(_dt,now){
  if(this.botFrames.length&&now>=this.botFrameUntil){
   this.botFrameIndex++;
   if(this.botFrameIndex>=this.botFrames.length)this.botFrames=[];
   else this.botFrameUntil=now+this.botFrames[this.botFrameIndex].duration;
  }
  if(this.scene==='local'&&this.local&&!this.botFrames.length&&now>=this.rollEnd&&
   this.local.turn!==0&&this.local.phase!=='done'){
   if(!this.localAiAt)this.localAiAt=now+450;
   if(now>=this.localAiAt){
    this.localAiAt=now+650;
    if(this.local.phase==='roll'){
     this.local.roll();if(!this.local.legal().length)this.local.pass();
    }else if(this.local.phase==='choose'){
     const move=chooseMove(this.local,this.difficulty,Math.random);
     if(move===null)this.local.pass();
     else{
      const before=this.local.pieces.map(row=>row.slice()),die=this.local.die;
      const action=this.local.move(move);
      if(action){
       const record={kind:'move',player:action.player,piece:action.piece,
        from:action.from,to:action.to,die,segments:action.events,captures:action.captures,
        before,after:this.local.pieces.map(row=>row.slice())};
       this.botFrames=buildFrames({events:[record]},this.local.colors);
       this.botFrameIndex=0;
       this.botFrameUntil=now+(this.botFrames[0]&&this.botFrames[0].duration||0);
      }
     }
    }
   }
  }else this.localAiAt=0;
  this.rewardLocalIfDone();
 }
}
module.exports={FlyingChessGame,COLORS};
