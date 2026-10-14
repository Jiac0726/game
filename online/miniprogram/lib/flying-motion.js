'use strict';
const PATHS=require('./flying-paths');
const MAX_FRAMES=420;
const clone=board=>board.map(row=>row.slice());
function position(colors,player,piece,progress){
 const route=PATHS.colors[colors[player]];
 if(!route)return null;
 if(progress<0)return route.airport[piece];
 if(progress<52)return PATHS.ring[(route.startIndex+progress)%52];
 return route.home[Math.min(5,progress-52)];
}
function buildFrames(motion,colors){
 if(!motion||!Array.isArray(motion.events)||!Array.isArray(colors))return [];
 const frames=[];
 let board=null,die=0;
 const add=(kind,duration,label,point)=>{
  if(frames.length>=MAX_FRAMES)return;
  frames.push({kind,duration,label,die,pieces:board?clone(board):null,point:point||null});
 };
 const nextBoard=()=>{const next=motion.events.find(e=>e.kind==='move'&&Array.isArray(e.before));return next?clone(next.before):null;};
 board=nextBoard();
 for(const e of motion.events){
  if(frames.length>=MAX_FRAMES)break;
  if(e.kind==='roll'){
   die=e.die;
   add('roll',320,'电脑掷出 '+die+' 点');
   continue;
  }
  if(e.kind!=='move'||!Array.isArray(e.before)||!Array.isArray(e.after))continue;
  board=clone(e.before);
  const owner=e.player,index=e.piece;
  let progress=e.from,events=Array.isArray(e.segments)?e.segments:[];
  die=e.die;
  const walk=(target,time,label)=>{
   if(target<0 || progress<0 || target===progress)return;
   let direction=1;
   if(target<progress) direction=-1;
   // Dice move: a corridor overshoot reflects at 57.
   if(label==='电脑移动'){
    direction=1;
    for(let step=0;step<die;step++){
     let next=progress+direction;
     if(next>57){direction=-1;next=56;}
     progress=next;board[owner][index]=progress;add('step',time,label);
    }
   }else{
    while(progress!==target){
     progress+=direction;board[owner][index]=progress;add('step',time,label);
     if(frames.length>=MAX_FRAMES)break;
    }
   }
  };
  for(const part of events){
   if(frames.length>=MAX_FRAMES)break;
   if(part.type==='launch'){
    progress=0;board[owner][index]=progress;add('step',240,'电脑起飞');
   }else if(part.type==='move'){
    walk(part.to,105,'电脑移动');
   }else if(part.type==='jump'){
    walk(part.to,85,'同色跳跃');
   }else if(part.type==='flight'){
    const start=position(colors,owner,index,progress);
    const end=position(colors,owner,index,part.to);
    if(start&&end){
     for(let frame=1;frame<=9;frame++){
      const portion=frame/9;
      add('flight',60,'虚线飞越',{
       player:owner,piece:index,
       x:start.x+(end.x-start.x)*portion,
       y:start.y+(end.y-start.y)*portion
      });
     }
    }
    progress=part.to;board[owner][index]=progress;
   }else if(part.type==='mutual'){
    // In a collision there is no preceding 'move' segment.
    walk(part.at,105,'电脑移动');
    add('collision',180,'叠机相撞');
   }else if(part.type==='threeSixPenalty'){
    add('penalty',200,'连续三次6点，飞机回机库');
   }else if(part.type==='crossCapture'){
    add('capture',170,'飞越途中撞子');
   }
  }
  // Resolve captures only after the travelling aircraft has reached its destination.
  board=clone(e.after);
  add('settle',180,e.to===57?'电脑飞机到达终点':'电脑完成落子');
 }
 return frames;
}
module.exports={buildFrames,position};
