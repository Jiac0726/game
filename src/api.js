'use strict';
const config=require('./config');
function createClient(wxApi,options={}){
 const timeoutMs=Number.isFinite(options.timeoutMs)?options.timeoutMs:25000;
 let initialized=false;
 function init(){
  if(!config.envId)throw new Error('请先在 src/config.js 填写 flyingRoom 云环境 ID');
  if(!wxApi.cloud||!wxApi.cloud.init||!wxApi.cloud.callFunction)
   throw new Error('当前小游戏缺少 wx.cloud，请在微信开发者工具开通云开发');
  if(!initialized){wxApi.cloud.init({env:config.envId});initialized=true;}
 }
 async function call(action,data={}){
  init();
  let response,timer;
  try{
   // Always pin the function to the configured mini-game environment.
   // A bounded wait prevents the UI from showing "creating room" indefinitely.
   response=await Promise.race([
    wxApi.cloud.callFunction({
     name:'flyingRoom',
     config:{env:config.envId},
     data:Object.assign({},data,{action})
    }),
    new Promise((_,reject)=>{
     timer=setTimeout(()=>{
      const err=new Error('云函数等待超时。建房可能已成功，请先查看云函数日志或 flying_rooms 集合，避免重复创建');
      err.code='CLOUD_TIMEOUT';reject(err);
     },timeoutMs);
    })
   ]);
  }catch(e){
   const details=String(e&&((e.errMsg||'')+' '+(e.message||''))||'');
   if(/invalid scope|没有权限|请先开通云服务|cloud init error/i.test(details)){
    const error=new Error('云服务未授权：请开通云开发并确认小游戏 AppID 已关联当前环境');
    error.code='CLOUD_SCOPE';throw error;
   }
   if(/function.*not.*exist|FUNCTION_NOT_FOUND|FunctionName parameter could not be found|函数不存在/i.test(details)){
    const error=new Error('找不到 flyingRoom 云函数，请检查部署环境');
    error.code='FUNCTION_NOT_FOUND';throw error;
   }
   throw e;
  }finally{
   if(timer!==undefined)clearTimeout(timer);
  }
  const result=response&&response.result;
  if(!result||!result.ok){
   const error=new Error(result&&result.message||'云函数调用失败');
   error.code=result&&result.code||'SERVER';
   // Preserve structured diagnostics for the UI modal and one-tap copying.
   // Server only sends raw SDK detail in explicitly enabled debug mode.
   error.stage=result&&result.stage;
   error.action=result&&result.action||action;
   error.dbCode=result&&result.dbCode;
   error.detail=result&&result.detail;
   throw error;
  }
  return result;
 }
 return {call,init};
}
module.exports={createClient};
