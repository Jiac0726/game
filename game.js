const { App } = require('./src/app');
const canvas = wx.createCanvas();
const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const app = new App(canvas, info, wx);
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
wx.onShow(() => app.resetClock());
wx.showShareMenu({ menus: ['shareAppMessage'] });
wx.onShareAppMessage(() => ({ title: '玩一会儿：单人解压，双人对决！' }));
let last = 0;
function frame(t) {
  app.update(last ? Math.min((t - last) / 1000, 0.04) : 0);
  last = t;
  app.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
