'use strict';
const { Flying } = require('./flying-model');
const PATHS = require('./flying-paths');
const artLayout = require('./flying-art-layout');
const COLOR = {Y:'#F8D965',B:'#7CC6E8',R:'#F39C8C',G:'#A8DAB9'};
const NAME = {Y:'黄方',B:'蓝方',R:'红方',G:'绿方'};
function install(App) {
  const p=App.prototype, render=p.render, update=p.update, pause=p.pause;
  p.newFlying=function() {
    this.flying=new Flying(this.flyingCount||4); this.flyingRolling=0; this.flyingExit=false;
    this.assetImages=this.assetImages||{};
    // Preload the whole short animation so the first roll can use actual frames.
    for(let i=0;i<16;i++) {
      const path=this.assetFiles&&this.assetFiles['FG-DICE-'+String(i).padStart(2,'0')];
      if(!path||this.assetImages[path]||!this.platform.createImage)continue;
      const image=this.platform.createImage(),entry={image,state:'loading'};
      this.assetImages[path]=entry;image.onload=()=>{entry.state='ready';};image.onerror=()=>{entry.state='error';};image.src=path;
    }
    this.go('flyingBoard');
  };
  p.rollFlying=function() {
    if(this.flyingRolling || !this.flying || this.flying.phase!=='roll')return;
    this.flying.roll(); this.flyingRolling=1.28;
  };
  p.update=function(dt) {
    update.call(this,dt);
    if(this.screen==='flyingBoard'&&!this.paused&&this.flyingRolling>0)this.flyingRolling=Math.max(0,this.flyingRolling-dt);
  };
  p.pause=function() { if(this.screen==='flyingBoard'){this.paused=true;this.cancel();return;} pause.call(this); };
  p.flyingArt=function(id,x,y,w,h) { return this.drawAsset(id,x,y,w,h).status==='ready'; };
  p.flyingPartyCard=function() {
    this.rect(24,478,327,199,'#FFFCF3');
    this.text('好友飞行棋',42,510,25,'#283748','left',true);
    this.text('2—4 人 · 同机轮流',42,544,13,'#778079');
    this.text('掷骰子，让快乐起飞',42,568,12,'#778079');
    if(!this.flyingArt('FG-BOARD-001',237,496,98,98)) {
      ['Y','B','R','G'].forEach((color,i)=>{this.circle(258+i%2*48,520+Math.floor(i/2)*46,18,COLOR[color]);this.text('✦',258+i%2*48,520+Math.floor(i/2)*46,19,'#283748','center');});
    }
    this.button('一起玩飞行棋',42,612,291,48,()=>this.go('flyingSetup'));
  };
  p.flyingSetup=function() {
    this.backHeader('好友飞行棋','彩铅棋盘 · 把手机放在桌上',()=>{this.mode='派对';this.go('home');});
    this.selectGroup('几个人一起玩？',[2,3,4],this.flyingCount||4,174,n=>this.flyingCount=n);
    if(!this.flyingArt('FG-BOARD-001',82,268,211,211)) { this.rect(82,268,211,211,'#BDDDC5'); this.text('四色飞行棋',187,367,24,'#283748','center',true); }
    this.text('2 / 4 / 6 起飞，掷到 6 再来一次',187,511,14,'#283748','center');
    this.text('绕环线一圈进入终点通道，点数需刚好',187,540,12,'#778079','center');
    this.text('同机轮流 · 基础规则（不含跳格、飞越）',187,569,12,'#778079','center');
    this.button('开始飞行棋',24,620,327,52,()=>this.newFlying());
  };
  p.flyingBoard=function() {
    const g=this.flying;if(!g){this.go('flyingSetup');return;}
    this.button('‹ 返回',15,24,75,44,()=>{this.flyingExit=true;},'#FFFCF3','#283748');
    this.text('好友飞行棋',187,48,24,'#283748','center',true);
    this.button('暂停',285,24,75,44,()=>this.pause(),'#FFFCF3','#283748');
    this.text(g.winner===null?'轮到'+NAME[g.colors[g.turn]]:NAME[g.colors[g.winner]]+'获胜！',187,96,21,'#283748','center',true);
    const bx=9,by=183,size=357,scale=size/PATHS.width;
    const players={Y:[15,120],B:[280,120],R:[15,547],G:[280,547]};
    g.colors.forEach((color,i)=>{const [x,y]=players[color];this.rect(x,y,80,52,i===g.turn?COLOR[color]:'#FFFCF3');this.flyingArt('FG-AVATAR-'+color,x+3,y+3,43,43);this.text(NAME[color],x+61,y+18,12,'#283748','center',true);this.text(g.pieces[i].filter(n=>n===57).length+'/4',x+61,y+37,11,'#283748','center');});
    const boardArt=this.drawAsset('FG-BOARD-001',bx,by,size,size);
    const boardBounds=boardArt.bounds;
    if(boardArt.status!=='ready') {
      this.rect(bx,by,size,size,'#FFFCF3');
      PATHS.ring.forEach((node,i)=>this.rect(bx+node.x*scale-7,by+node.y*scale-7,14,14,Object.values(COLOR)[i%4],2));
      Object.keys(PATHS.colors).forEach(color=>PATHS.colors[color].home.forEach(node=>this.rect(bx+node.x*scale-7,by+node.y*scale-7,14,14,COLOR[color],2)));
    }
    if(boardArt.status==='ready') for(const color of g.colors){const a=artLayout.airportBounds(color,boardBounds);this.flyingArt('FG-AIRPORT-'+color,a.x,a.y,a.width,a.height);}
    const legal=this.flyingRolling?[]:g.legal();
    g.colors.forEach((color,player)=>g.pieces[player].forEach((progress,piece)=>{
      if(progress===57)return;
      const point=g.position(player,piece),target=boardArt.status==='ready'?artLayout.project(point,boardBounds):{x:bx+point.x*scale,y:by+point.y*scale},x=target.x,y=target.y;
      if(!this.flyingArt('FG-TOKEN-'+color,x-9,y-9,18,18)){this.circle(x,y,8,COLOR[color]);this.text(piece+1,x,y,9,'#283748','center',true);}
      if(player===g.turn&&legal.includes(piece)){this.ctx.strokeStyle='#283748';this.ctx.lineWidth=1.5;this.ctx.beginPath();this.ctx.arc(x,y,11,0,Math.PI*2);this.ctx.stroke();}
    }));
    const fx=123,fy=603;
    if(this.flyingRolling>0) {
      const frame=Math.min(15,Math.floor((1.28-this.flyingRolling)/.08));
      this.ctx.save();this.ctx.translate(fx+32,fy+32);this.ctx.rotate(frame*Math.PI/4);
      const ready=this.flyingArt('FG-DICE-'+String(frame).padStart(2,'0'),-32,-32,64,64);this.ctx.restore();
      if(!ready)this.drawFlyingDie(fx,fy,64,1+(frame%6));
      this.text('骰子滚动中…',250,635,14,'#283748','center');
    } else {
      this.drawFlyingDie(fx,fy,64,g.die||1);
      if(g.phase==='roll')this.button('掷骰子',201,611,147,48,()=>this.rollFlying());
      else if(g.phase==='choose')this.text(legal.length?'选择一架飞机':'本轮无法移动',267,635,15,'#283748','center',true);
    }
    if(!this.flyingRolling&&g.phase==='choose') {
      if(!legal.length)this.button('下一回合',24,689,327,48,()=>g.pass());
      else legal.forEach((piece,i)=>this.button('飞机 '+(piece+1),15+i*89,689,79,48,()=>g.move(piece),COLOR[g.colors[g.turn]],'#283748'));
    }
    if(g.phase==='done')this.button('再开一局',24,689,327,48,()=>this.newFlying());
    this.text('2 / 4 / 6 起飞 · 同机轮流 · 6 点连掷',187,774,12,'#778079','center');
    if(this.paused||this.flyingExit){this.buttons=[];this.rect(0,0,375,812,'rgba(25,35,45,.5)',0);this.rect(38,279,299,243,'#FAF5E9');this.text(this.flyingExit?'结束这局飞行棋？':'休息一下',187,324,23,'#283748','center',true);this.button('继续游戏',60,370,255,48,()=>{this.paused=false;this.flyingExit=false;});this.button('返回派对',60,444,255,48,()=>{this.paused=false;this.flyingExit=false;this.flying=null;this.mode='派对';this.go('home');},'#F3A18B','#283748');}
  };
  // Final pips are drawn from game state, never inferred from generated animation.
  p.drawFlyingDie=function(x,y,size,value) {
    this.rect(x,y,size,size,'#FFFCF3',12);
    const dots={1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]],6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]};
    dots[value].forEach(([cx,cy])=>this.circle(x+size*(.26+cx*.24),y+size*(.26+cy*.24),size*.065,'#283748'));
  };
  p.render=function() {
    if(!['flyingSetup','flyingBoard'].includes(this.screen))return render.call(this);
    this.initUI();const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#FAF5E9';c.fillRect(0,0,this.width,this.height);c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);this.buttons=[];
    if(this.screen==='flyingSetup')this.flyingSetup();else this.flyingBoard();this.paper();
  };
}
module.exports={install};
