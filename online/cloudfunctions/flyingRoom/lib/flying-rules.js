'use strict';
function normalizeSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('房间设置无效');
 const out={launch:input.launch===undefined?'246':input.launch,turnSeconds:input.turnSeconds===undefined?60:input.turnSeconds,extraTurn:input.extraTurn===undefined?true:input.extraTurn};
 if(!['246','6'].includes(out.launch)||![30,60,90].includes(out.turnSeconds)||typeof out.extraTurn!=='boolean')throw Error('房间设置无效');
 return out;
}
function describeSettings(input){const s=normalizeSettings(input);return (s.launch==='6'?'仅6起飞':'2/4/6起飞')+' · '+s.turnSeconds+'秒 · '+(s.extraTurn?'6点连掷':'不连掷');}
module.exports={normalizeSettings,describeSettings};
