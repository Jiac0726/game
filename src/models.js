'use strict';
function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
class Blocks {
  constructor(random) { this.random=random; this.grid=Array.from({length:8},()=>Array(8).fill(0)); this.score=0; this.done=false; this.refill(); }
  refill() { const shapes=[[[0,0]],[[0,0],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[0,2]]]; this.pieces=Array.from({length:3},()=>shapes[Math.floor(this.random()*shapes.length)]); }
  fits(p,x,y) { return p && p.every(([dx,dy])=>x+dx>=0&&x+dx<8&&y+dy>=0&&y+dy<8&&!this.grid[y+dy][x+dx]); }
  place(i,x,y) { const p=this.pieces[i]; if(!this.fits(p,x,y))return false; p.forEach(([dx,dy])=>this.grid[y+dy][x+dx]=1); this.score+=p.length*10; this.pieces[i]=null; const rows=[],cols=[]; for(let j=0;j<8;j++){if(this.grid[j].every(Boolean))rows.push(j); if(this.grid.every(r=>r[j]))cols.push(j);} rows.forEach(y=>this.grid[y].fill(0)); cols.forEach(x=>this.grid.forEach(r=>r[x]=0)); this.score+=(rows.length+cols.length)*100; if(this.pieces.every(p=>!p))this.refill(); this.done=!this.pieces.some(p=>p&&this.grid.some((r,y)=>r.some((v,x)=>this.fits(p,x,y)))); return true; }
}
class Gomoku {
  constructor(){this.grid=Array.from({length:15},()=>Array(15).fill(0));this.turn=1;this.done=false;this.winner=0;this.moves=0;}
  place(x,y){if(this.done||x<0||y<0||x>=15||y>=15||this.grid[y][x])return false;const p=this.turn;this.grid[y][x]=p;this.moves++;for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let count=1;for(const sign of [-1,1]){let nx=x+dx*sign,ny=y+dy*sign;while(nx>=0&&ny>=0&&nx<15&&ny<15&&this.grid[ny][nx]===p){count++;nx+=dx*sign;ny+=dy*sign;}}if(count>=5){this.winner=p;this.done=true;}}if(this.moves===225)this.done=true;this.turn=3-p;return true;}
}
class Line {
  constructor(random){this.random=random;this.score=0;this.level=1;this.done=false;this.make();}
  make(){ // Random reflections of a Hamiltonian snake guarantee one solution.
    const base=[];for(let y=0;y<4;y++)for(let k=0;k<4;k++)base.push([y%2?3-k:k,y]);const flipX=this.random()<.5,flipY=this.random()<.5,swap=this.random()<.5;
    this.solution=base.map(([x,y])=>{x=flipX?3-x:x;y=flipY?3-y:y;return swap?[y,x]:[x,y];});this.path=[this.solution[0]];this.goal=this.solution[15]; }
  visit(x,y){const last=this.path[this.path.length-1];if(this.path.length>1){const prev=this.path[this.path.length-2];if(prev[0]===x&&prev[1]===y){this.path.pop();return true;}}if(x<0||x>3||y<0||y>3||Math.abs(x-last[0])+Math.abs(y-last[1])!==1||this.path.some(p=>p[0]===x&&p[1]===y))return false;if(x===this.goal[0]&&y===this.goal[1]&&this.path.length!==15)return false;this.path.push([x,y]);if(this.path.length===16){this.score+=100;this.level++;if(this.level>5)this.done=true;else this.make();}return true;}
}
class Reaction {
  constructor(random){this.random=random;this.points=[0,0];this.score=0;this.done=false;this.round=1;this.next();}
  next(){this.phase='wait';this.timer=1.2+this.random()*2.3;this.elapsed=0;this.message='等待绿色';}
  update(dt){if(this.done)return;if(this.phase==='wait'){this.timer-=dt;if(this.timer<=0){this.phase='green';this.elapsed=0;this.message='现在点击！';}}else if(this.phase==='green'){this.elapsed+=dt;if(this.elapsed>8){this.phase='result';this.timer=1.5;this.message='无人点击，重开本轮';}}else{this.timer-=dt;if(this.timer<=0)this.next();}}
  hit(p){if(this.done||this.phase==='result')return;const early=this.phase==='wait',winner=early?1-p:p;this.points[winner]++;this.message=early?'抢跑！对手得分':`玩家${p+1} · ${Math.round(this.elapsed*1000)}毫秒`;this.phase='result';this.timer=1.8;this.round++;if(this.points[winner]>=2){this.done=true;this.winner=winner+1;} }
}
const RADII=[12,17,23,30,36,43,51,62,74];
class Fruit {
  constructor(random){this.random=random;this.items=[];this.score=0;this.done=false;this.cooldown=0;this.danger=0;this.next=Math.floor(random()*3);this.upcoming=Math.floor(random()*3);this.events=[];this.x=170;this.width=340;this.height=380;}
  drop(x){if(this.done||this.cooldown>0)return false;const level=this.next,r=RADII[level];this.items.push({x:Math.max(r,Math.min(this.width-r,x)),y:r+5,vx:0,vy:0,level,r,age:0});this.events.push({type:"drop",x:this.items[this.items.length-1].x,y:r+5,level});this.next=this.upcoming;this.upcoming=Math.floor(this.random()*3);this.cooldown=.55;return true;}
  update(dt){if(this.done)return;if(this.events.length>32)this.events.splice(0,this.events.length-32);this.cooldown=Math.max(0,this.cooldown-dt);const step=dt/3;for(let s=0;s<3;s++){for(const a of this.items){a.age+=step;a.vy+=420*step;a.x+=a.vx*step;a.y+=a.vy*step;a.vx*=Math.pow(.5,step);if(a.y+a.r>this.height){a.y=this.height-a.r;a.vy=-a.vy*.12;}if(a.x<a.r){a.x=a.r;a.vx=Math.abs(a.vx)*.4;}if(a.x>this.width-a.r){a.x=this.width-a.r;a.vx=-Math.abs(a.vx)*.4;}}
      outer:for(let i=0;i<this.items.length;i++)for(let j=i+1;j<this.items.length;j++){const a=this.items[i],b=this.items[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=a.r+b.r)continue;if(a.level===b.level&&a.level<RADII.length-1){const level=a.level+1,r=RADII[level],m={x:Math.max(r,Math.min(this.width-r,(a.x+b.x)/2)),y:Math.min(this.height-r,(a.y+b.y)/2),vx:0,vy:0,level,r,age:0};this.items.splice(j,1);this.items.splice(i,1,m);const points=Math.pow(2,level)*10;this.score+=points;this.events.push({type:"merge",x:m.x,y:m.y,level,points});break outer;}if(d<.01){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,overlap=a.r+b.r-d;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){a.vx+=rel*nx*.5;a.vy+=rel*ny*.5;b.vx-=rel*nx*.5;b.vy-=rel*ny*.5;}}
    }const high=this.items.some(a=>a.age>2&&a.y-a.r<44);this.danger=high?this.danger+dt:0;if(this.danger>2)this.done=true;}
}
class Brick {
  constructor(){this.score=0;this.done=false;this.lives=3;this.width=340;this.height=380;this.paddle=170;this.bricks=[];for(let y=0;y<4;y++)for(let x=0;x<7;x++)this.bricks.push({x:6+x*47,y:30+y*35,w:42,h:[42*99/148,42*100/144,42*100/146][(x+2*y)%3],art:(x+2*y)%3,on:true});this.reset();}
  reset(){this.ball={x:this.paddle,y:330,vx:125,vy:-190};this.launched=false;}
  update(dt){if(this.done)return;if(!this.launched){this.ball.x=this.paddle;return;}const b=this.ball;for(let k=0;k<3;k++){const oldX=b.x,oldY=b.y;b.x+=b.vx*dt/3;b.y+=b.vy*dt/3;if(b.x<7){b.x=7;b.vx=Math.abs(b.vx);}if(b.x>333){b.x=333;b.vx=-Math.abs(b.vx);}if(b.y<7){b.y=7;b.vy=Math.abs(b.vy);}if(b.vy>0&&oldY<=343&&b.y>=343&&Math.abs(b.x-this.paddle)<43){b.y=343;b.vy=-Math.abs(b.vy);b.vx=(b.x-this.paddle)*5;}for(const r of this.bricks){if(r.on&&b.x+7>r.x&&b.x-7<r.x+r.w&&b.y+7>r.y&&b.y-7<r.y+r.h){r.on=false;this.score+=20;if(oldX+7<=r.x||oldX-7>=r.x+r.w)b.vx=-b.vx;else b.vy=-b.vy;break;}}if(b.y>this.height+10){this.lives--;if(!this.lives)this.done=true;else this.reset();break;}}
    if(this.bricks.every(r=>!r.on)){this.done=true;this.won=true;}}
}
module.exports={rng,Blocks,Gomoku,Line,Reaction,Fruit,Brick,RADII};
