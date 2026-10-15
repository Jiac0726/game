'use strict';
// All difficulties use exactly the same legal moves and dice.
// "hard" anticipates potential replies; it cannot inspect future dice.
const LEVELS = ['easy','normal','hard'];
function normalizeDifficulty(value) { return LEVELS.includes(value) ? value : 'normal'; }
function sample(random,length) {
  const value=Math.max(0,Math.min(.999999999,Number(random())));
  return Math.floor(value*length);
}
function baseScore(game,option) {
  let score = option.from<0 ? 24 : (option.to<0?-18:option.to-option.from)*2;
  if(option.to>=52 && option.from<52) score+=45;
  if(option.to===57) score+=160;
  if(option.board[option.player].every(p=>p===57))score+=2000;
  score+=option.captures.length*95;
  score+=option.events.filter(x=>x.type==='jump').length*18;
  score+=option.events.filter(x=>x.type==='flight').length*36;
  if(option.events.some(x=>x.type==='mutual'||x.type==='threeSixPenalty'))score-=140;
  return score;
}
function threatProbability(game,option) {
  if(option.to<0 || option.to>=52)return 0; // Airport and home corridor are safe.
  let highest=0;
  for(let enemy=0;enemy<game.pieces.length;enemy++){
    if(enemy===option.player)continue;
    let dangerousRolls=0;
    for(let die=1;die<=6;die++){
      const hypothetical=Object.assign(Object.create(Object.getPrototypeOf(game)),game,{
        pieces:option.board,turn:enemy,phase:'choose',die
      });
      let threatened=false;
      for(let piece=0;piece<4;piece++){
        const reply=hypothetical.plan(piece);
        if(reply && reply.captures.some(hit=>hit.player===option.player&&hit.piece===option.piece)){
          threatened=true;break;
        }
      }
      if(threatened)dangerousRolls++;
    }
    highest=Math.max(highest,dangerousRolls/6);
  }
  return highest;
}
function chooseMove(game,difficulty='normal',random=Math.random) {
  const legal=game.legal();
  if(!legal.length)return null;
  const level=normalizeDifficulty(difficulty);
  if(level==='easy')return legal[sample(random,legal.length)];
  const scored=legal.map(piece=>{
    const plan=game.plan(piece);
    let score=baseScore(game,plan);
    if(level==='hard'){
      const risk=threatProbability(game,plan);
      const highValue=plan.to>=40?1.5:1;
      score-=risk*(155*highValue);
      // Avoid wasting a six on a second parked piece when a protected piece can advance.
      if(plan.from<0 && game.pieces[game.turn].some(p=>p>=0 && p<52))score-=12;
      if(plan.to>=52)score+=55;
    }
    return {piece,score};
  });
  const top=Math.max(...scored.map(x=>x.score));
  const tied=scored.filter(x=>Math.abs(x.score-top)<1e-9);
  return tied[sample(random,tied.length)].piece;
}
module.exports={LEVELS,normalizeDifficulty,chooseMove,baseScore,threatProbability};
