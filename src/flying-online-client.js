'use strict';
const ROOM=/^[a-f0-9]{32}$/;
class FlyingOnlineClient {
  constructor(platform,config,onChange=()=>{},timers={setTimeout,clearTimeout}) {
    this.platform=platform;this.config=config;this.onChange=onChange;this.timers=timers;
    this.room=null;this.busy=false;this.error='';this.hidden=false;this.active=false;this.epoch=0;
    const saved=this.stored('collectionFlyingPending');this.pending=saved&&ROOM.test(saved.roomId||'')?saved:null;this.offset=0;this.pollTimer=null;
  }
  stored(key){try{return this.platform.getStorageSync(key);}catch(_){return null;}}
  store(key,value){try{this.platform.setStorageSync(key,value);}catch(_){}}
  clearPending(){this.pending=null;try{this.platform.removeStorageSync('collectionFlyingPending');}catch(_){} }
  changed(){this.onChange(this);}
  async call(action,data={}) {
    if(!this.config.envId)throw new Error('请配置 src/cloud-config.js 的云环境');
    if(!this.platform.cloud||!this.platform.cloud.callFunction)throw new Error('当前环境不支持云开发，请使用已开通云开发的小游戏 AppID');
    let timer;
    try {
      const response=await Promise.race([
        this.invokeCloud(action,data),
        new Promise((_,reject)=>{timer=this.timers.setTimeout(()=>reject(new Error('网络超时，可同步或重试')),15000);})
      ]);
      const result=response&&response.result;
      if(!result||!result.ok){const e=new Error(result&&result.message||'服务暂不可用');e.code=result&&result.code;throw e;}
      return result;
    } catch(e){
      const message=String(e&& (e.message||e.errMsg)||e);
      if(/invalid scope|没有权限|未开通|请先开通|无权限/i.test(message))throw new Error('云服务未开通或未关联小游戏 AppID');
      throw e;
    } finally {if(timer)this.timers.clearTimeout(timer);}
  }
  async invokeCloud(action,data){
    const cloud=this.platform.cloud;
    if(!this.cloudInitialized&&typeof cloud.init==='function'){
      await cloud.init({env:this.config.envId});
      this.cloudInitialized=true;
    }
    return cloud.callFunction({name:this.config.functionName,data:{...data,action},config:{env:this.config.envId}});
  }
  accept(result) {
    const room=result.room;
    if(!room||!ROOM.test(room.id))throw new Error('服务器房间数据无效');
    if(this.room&&this.room.id===room.id&&room.revision<this.room.revision)return false;
    this.room=room;this.offset=result.serverNow-Date.now();this.error='';
    this.store('collectionFlyingRoom',room.id);this.changed();return true;
  }
  stop(){this.active=false;this.epoch++;this.timers.clearTimeout(this.pollTimer);this.pollTimer=null;}
  async enter(action,roomId,settings) {
    if(this.busy)return false;
    if(action!=='create'&&!ROOM.test(roomId||'')){this.error='请复制完整的32位房间码后加入';this.changed();return false;}
    if(this.pending&&(action==='create'||this.pending.roomId!==roomId)){this.error='上一局有待确认操作，请先返回原房间重试';this.changed();return false;}
    this.stop();this.active=true;this.room=null;const epoch=this.epoch;
    this.busy=true;this.error='';this.changed();
    try {
      const result=await this.call(action,{roomId,...(action==='create'?{settings}: {})});
      if(epoch!==this.epoch)return false;
      this.accept(result);
      const saved=this.stored('collectionFlyingPending');
      if(saved&&saved.roomId===this.room.id)this.pending=saved;
      return true;
    }catch(e){if(epoch===this.epoch){this.error=e.message;this.changed();}return false;}
    finally{this.busy=false;if(epoch===this.epoch){this.changed();this.schedule();}}
  }
  schedule(){this.timers.clearTimeout(this.pollTimer);if(this.active&&!this.hidden&&this.room)this.pollTimer=this.timers.setTimeout(()=>this.sync(),1500);}
  async sync(){
    if(!this.active||this.hidden||!this.room)return;
    if(this.busy){this.schedule();return;}
    const epoch=this.epoch,id=this.room.id;this.busy=true;
    try{const result=await this.call('get',{roomId:id});if(epoch===this.epoch)this.accept(result);}
    catch(e){if(epoch===this.epoch){this.error=e.message;this.changed();}}
    finally{this.busy=false;if(epoch===this.epoch)this.schedule();}
  }
  async command(action,extra={}) {
    if(this.busy||!this.room)return false;
    if(this.pending){this.error='请先重试并确认上一次操作';this.changed();return false;}
    this.pending={...extra,roomId:this.room.id,revision:this.room.revision,requestId:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14),action};
    this.store('collectionFlyingPending',this.pending);return this.retry();
  }
  async retry(){
    if(this.busy||!this.pending||!this.room||this.pending.roomId!==this.room.id)return false;
    const epoch=this.epoch;this.busy=true;this.error='';this.changed();
    try{const request=this.pending,result=await this.call(request.action,request);this.clearPending();if(epoch===this.epoch)this.accept(result);return true;}
    catch(e){if(e.code&&e.code!=='SERVER')this.clearPending();if(epoch===this.epoch){this.error=e.message;this.changed();}return false;}
    finally{this.busy=false;if(epoch===this.epoch){this.changed();this.schedule();}}
  }
  hide(){this.hidden=true;this.timers.clearTimeout(this.pollTimer);}
  show(){this.hidden=false;if(this.active)this.sync();}
  seconds(){return this.room?Math.max(0,Math.ceil((this.room.deadline-Date.now()-this.offset)/1000)):0;}
}
module.exports={FlyingOnlineClient,ROOM};
