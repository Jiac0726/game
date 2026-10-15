const config = require('../config');
async function call(action, data = {}) {
  if (!config.envId) throw new Error('请先配置云开发环境');
  const response = await wx.cloud.callFunction({name:'flyingRoom', data:Object.assign({},data,{action})});
  const result = response.result;
  if (!result || !result.ok) { const error = new Error(result && result.message || '服务暂不可用'); error.code=result && result.code; throw error; }
  return result;
}
module.exports={call};
