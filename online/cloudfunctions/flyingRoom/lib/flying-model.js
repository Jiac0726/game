'use strict';
const PATHS = require('./flying-paths');
const ORDER = ['R', 'Y', 'B', 'G'];
const DEFAULT_RULES = Object.freeze({
  launch: 'six', threeSix: 'noBonus', jump: true, flight: true,
  capture: true, stack: 'block', bounce: true
});
const CROSSINGS = {R:'Y', Y:'B', B:'G', G:'R'};
const FLIGHT_START = 16; // Board-specific progress marker; change with the artwork calibration.
function normalizeRules(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowed = (field, choices) => choices.includes(value[field]) ? value[field] : DEFAULT_RULES[field];
  return {
    launch: allowed('launch',['six','fiveSix','even']),
    threeSix: allowed('threeSix',['noBonus','returnMoved']),
    jump: typeof value.jump === 'boolean' ? value.jump : DEFAULT_RULES.jump,
    flight: typeof value.flight === 'boolean' ? value.flight : DEFAULT_RULES.flight,
    capture: typeof value.capture === 'boolean' ? value.capture : DEFAULT_RULES.capture,
    stack: allowed('stack',['block','mutual']),
    bounce: typeof value.bounce === 'boolean' ? value.bounce : DEFAULT_RULES.bounce
  };
}
class Flying {
  constructor(count = 4, random = Math.random, rules) {
    this.colors = count === 2 ? ['R','B'] : ORDER.slice(0,Math.max(2,Math.min(4,count)));
    this.pieces = this.colors.map(() => [-1,-1,-1,-1]);
    this.turn = 0; this.phase = 'roll'; this.die = 0; this.random = random;
    this.winner = null; this.sixStreak = 0; this.rules = normalizeRules(rules);
  }
  canLaunch() {
    return this.rules.launch === 'six' ? this.die === 6 :
      this.rules.launch === 'fiveSix' ? this.die >= 5 : this.die % 2 === 0;
  }
  ringIndex(player, progress) {
    return (PATHS.colors[this.colors[player]].startIndex + progress) % 52;
  }
  position(player, piece) {
    const progress = this.pieces[player][piece], route = PATHS.colors[this.colors[player]];
    return progress < 0 ? route.airport[piece] :
      progress < 52 ? PATHS.ring[this.ringIndex(player,progress)] : route.home[progress-52];
  }
  // A pure simulation: no pieces change until a legal move commits atomically.
  plan(piece) {
    if(this.phase !== 'choose' || !Number.isInteger(piece) || piece < 0 || piece >= 4) return null;
    const player=this.turn, from=this.pieces[player][piece];
    if(from === 57) return null;
    const board=this.pieces.map(row=>row.slice()), events=[];
    const captures=[];
    let current=from, lost=false;
    const opponentsAt = target => {
      if(target < 0 || target >= 52) return [];
      const index=this.ringIndex(player,target), found=[];
      for(let p=0;p<this.colors.length;p++) if(p!==player)
        for(let i=0;i<4;i++) if(board[p][i]>=0 && board[p][i]<52 && this.ringIndex(p,board[p][i])===index)
          found.push({player:p,piece:i});
      return found;
    };
    const collide=(target,kind)=>{
      const opponents=opponentsAt(target), totals={};
      opponents.forEach(o=>{totals[o.player]=(totals[o.player]||0)+1;});
      const stacked=Object.values(totals).some(n=>n>=2);
      if(stacked && (this.rules.stack==='block' || kind==='through')) return false;
      if(stacked && this.rules.stack==='mutual') {
        opponents.forEach(o=>{board[o.player][o.piece]=-1;captures.push(o);});
        board[player][piece]=-1; current=-1; lost=true;
        events.push({type:'mutual',at:target}); return true;
      }
      if(this.rules.capture) opponents.forEach(o=>{
        board[o.player][o.piece]=-1;captures.push(o);
      });
      current=target;board[player][piece]=target;
      events.push({type:kind,to:target});return true;
    };
    if(from<0) {
      if(!this.canLaunch() || !collide(0,'launch')) return null;
    } else {
      let currentStep=from, direction=1;
      for(let n=0;n<this.die;n++) {
        let next=currentStep+direction;
        if(next>57) {
          if(!this.rules.bounce) return null;
          direction=-1;next=56;
        }
        if(next>=0 && next<52) {
          const found=opponentsAt(next), totals={};
          found.forEach(o=>{totals[o.player]=(totals[o.player]||0)+1;});
          if(Object.values(totals).some(c=>c>=2)) {
            if(n!==this.die-1 || this.rules.stack==='block') return null;
          }
        }
        currentStep=next;
      }
      if(!collide(currentStep,'move')) return null;
    }
    const sameColor = progress => progress>0 && progress<52 && progress%4===0 && progress+4<52;
    const bonus=(target,kind) => !lost && collide(target,kind);
    const flight=()=>{
      if(!this.rules.flight || lost || current!==FLIGHT_START) return false;
      if(!bonus(current+12,'flight')) return false;
      if(lost)return true;
      // A flight crosses the opposing safe corridor at the designated intersection.
      const other=this.colors.indexOf(CROSSINGS[this.colors[player]]);
      if(other>=0 && this.rules.capture) for(let i=0;i<4;i++) if(board[other][i]===54){
        board[other][i]=-1;captures.push({player:other,piece:i});
        events.push({type:'crossCapture',player:other,piece:i});
      }
      if(sameColor(current)) bonus(current+4,'jump');
      return true;
    };
    if(from>=0 && !lost && current<52) {
      if(!flight() && this.rules.jump && sameColor(current)) {
        if(bonus(current+4,'jump')) flight();
      }
    }
    if(this.die===6 && this.sixStreak>=3 && this.rules.threeSix==='returnMoved' && !lost){
      board[player][piece]=-1;current=-1;events.push({type:'threeSixPenalty'});
    }
    return {player,piece,from,to:current,board,events,captures};
  }
  legal() {
    if(this.phase!=='choose')return [];
    return this.pieces[this.turn].map((_,i)=>this.plan(i)?i:-1).filter(i=>i>=0);
  }
  roll() {
    if(this.phase!=='roll')return false;
    this.die=1+Math.floor(Math.max(0,Math.min(.999999,this.random()))*6);
    this.sixStreak=this.die===6?this.sixStreak+1:0;
    this.phase='choose';return this.die;
  }
  pass(){if(this.phase!=='choose' || this.legal().length)return false;this.next();return true;}
  next(){
    const extra=this.die===6 && this.sixStreak<3;
    if(!extra){this.turn=(this.turn+1)%this.colors.length;this.sixStreak=0;}
    this.phase='roll';this.die=0;
  }
  move(piece) {
    const result=this.plan(piece);if(!result)return false;
    this.pieces=result.board;
    if(this.pieces[result.player].every(p=>p===57)){
      this.winner=result.player;this.phase='done';
    } else this.next();
    const {board,...movement}=result;return movement;
  }
}
module.exports={Flying,normalizeRules,DEFAULT_RULES};
