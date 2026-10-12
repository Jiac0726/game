const { App } = require('./src/app');
const canvas = wx.createCanvas();
const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const app = new App(canvas, info, wx);
const cloudConfig = require('./src/cloud-config');
try {
  if (wx.cloud && cloudConfig.envId) wx.cloud.init({ env: cloudConfig.envId });
} catch (e) { app.toast('云环境初始化失败，请检查小游戏 AppID 与环境关联'); }
const assetConfig = require('./src/asset-config');
const { createAssetFiles } = require('./src/asset-source');
app.setAssetFiles(createAssetFiles(assetConfig));
if (!assetConfig.baseUrl && !assetConfig.useLocalAssets) {
  console.warn('素材库地址未配置：请填写 src/asset-config.js 的 baseUrl。当前使用内置绘制组件。');
  app.toast('请配置素材库地址');
}
wx.onTouchStart(e => e.changedTouches.forEach(t => app.pointer('down', t.clientX, t.clientY, t.identifier)));
wx.onTouchMove(e => e.changedTouches.forEach(t => app.pointer('move', t.clientX, t.clientY, t.identifier)));
wx.onTouchEnd(e => e.changedTouches.forEach(t => app.pointer('up', t.clientX, t.clientY, t.identifier)));
wx.onTouchCancel(() => app.cancel());
wx.onHide(() => app.pause());
wx.onShow(options => { app.resetClock(); app.resumeOnline(); app.handleShareEntry(options && options.query); });
// 分享卡片的落地：启动时就要接住参数，否则接收者会落到大厅（设计指南 3.6）。
try {
  const launch = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : null;
  app.handleShareEntry(launch && launch.query);
} catch (e) { /* 老版本基础库拿不到启动参数，退化为普通启动 */ }
// shareTimeline 一并开启：微信要求二者同开，否则 onShareTimeline 不生效。
wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
// 右上角菜单转发与游戏内「分享」按钮共用同一份场景化内容（设计指南 3.6 一致性）。
wx.onShareAppMessage(() => app.buildShareContent());
wx.onShareTimeline(() => ({ title: app.buildShareContent().title }));
let last = 0;
function frame(t) {
  app.update(last ? Math.min((t - last) / 1000, 0.04) : 0);
  last = t;
  app.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
