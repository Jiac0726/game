'use strict';
const config=require('./config');
function createClient(wxApi){
 let initialized=false;
 function init(){
  if(!config.envId)throw new Error('请先在 src/config.js 填写 flyingRoom 云环境 ID');
  if(!wxApi.cloud||!wxApi.cloud.init||!wxApi.cloud.callFunction)
   throw new Error('当前小游戏缺少 wx.cloud，请在微信开发者工具开通云开发');
  if(!initialized){wxApi.cloud.init({env:config.envId});initialized=true;}
 }
 async function call(action,data={}){
  init();
  const response=await wxApi.cloud.callFunction({name:'flyingRoom',data:Object.assign({},data,{action})});
  const result=response&&response.result;
  if(!result||!result.ok){
   const error=new Error(result&&result.message||'云函数调用失败');
   error.code=result&&result.code||'SERVER';
   throw error;
  }
  return result;
 }
 return {call,init};
}
module.exports={createClient};
