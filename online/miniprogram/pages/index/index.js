const {call}=require('../../lib/api');
const DEFAULT_RULES={launch:'six',threeSix:'noBonus',jump:true,flight:true,capture:true,stack:'block',bounce:true};
Page({
 data:{
  busy:false,error:'',lastRoom:'',rules:{...DEFAULT_RULES},
  launchLabels:['仅6点','5或6点','偶数点'],launchIndex:0,
  threeSixLabels:['第三次6正常走完、不再连投','第三次6走完后该棋回机库'],threeSixIndex:0,
  stackLabels:['敌方叠机阻挡','落点叠机双方回机库'],stackIndex:0
 },
 onShow(){this.setData({lastRoom:wx.getStorageSync('flyingRoomId')||''});},
 nameInput(e){this.name=e.detail.value;},
 roomInput(e){this.roomId=e.detail.value.trim();},
 launchChange(e){
  const index=Number(e.detail.value);
  this.setData({launchIndex:index,rules:{...this.data.rules,launch:['six','fiveSix','even'][index]}});
 },
 threeSixChange(e){
  const index=Number(e.detail.value);
  this.setData({threeSixIndex:index,rules:{...this.data.rules,threeSix:['noBonus','returnMoved'][index]}});
 },
 stackChange(e){
  const index=Number(e.detail.value);
  this.setData({stackIndex:index,rules:{...this.data.rules,stack:['block','mutual'][index]}});
 },
 ruleToggle(e){
  const key=e.currentTarget.dataset.rule;
  if(!['jump','flight','capture','bounce'].includes(key))return;
  this.setData({rules:{...this.data.rules,[key]:!!e.detail.value}});
 },
 async create(){
  if(this.data.busy)return;
  this.setData({busy:true,error:''});
  try{const r=await call('create',{name:this.name||'',rules:this.data.rules});this.open(r.room.id);}
  catch(e){this.setData({error:e.message});}
  finally{this.setData({busy:false});}
 },
 join(){
  if(!/^[a-f0-9]{32}$/.test(this.roomId||'')){this.setData({error:'请输入完整房间码'});return;}
  this.open(this.roomId);
 },
 resume(){this.open(this.data.lastRoom);},
 open(id){wx.navigateTo({url:'/pages/room/room?roomId='+id});}
});
