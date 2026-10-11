# 玩一会儿 · 原素材前端 0.6

六款可玩的微信小游戏，共用一套手绘涂鸦组件。包含 21 页交互设计、离线试玩、页面画廊和批量 PNG 导出工具。

## 先看效果

1. 克隆仓库：`git clone https://github.com/Jiac0726/game.git`，进入 `game` 目录。
   或下载ZIP并解压，保持目录结构。
2. 打开 `frontend/index.html`：实际试玩新的原素材前端。
3. 打开 `frontend/gallery.html`：并排查看全部 21 页。
   游戏场景见 `frontend/scene-gallery.html`，九级水果素材见 `frontend/fruit-assets.html`。
4. 预览页不保存成绩；实际试玩使用本设备真实记录。

新前端使用 DOM、独立 PNG、可编辑文字与 SVG 路径，不使用 Canvas 绘制。
876 张原始 PNG 已注册；纸张、插画、边框、按钮使用原图层，示例棋子和成绩由真实游戏状态替换。
布局按 941×1672 原设计整体等比缩放，PNG 保持纵横比。文字使用系统中文字体，不保证与 Canva 原字体逐像素一致。
浏览器直接打开即可使用；若浏览器限制本地存储或分享，可用本地静态服务器打开。
`preview.html` / 根目录 `gallery.html` 保留旧 Canvas 版本，微信小游戏当前仍使用旧适配器。

## 微信开发者工具

导入本目录，项目类型选择“小游戏”。项目配置暂用 touristappid；工具要求 AppID 时填入自己的小游戏 AppID。真机预览和分享也需要自己的 AppID。尚未上传或发布。

## 导航与功能

- 底部：玩法 / 个人。
- 玩法顶部：个人 / 对战 / 派对。
- 单人：方块消除、水果合成、一笔连线、弹球打砖块。
- 对战：同屏反应对决、轮流五子棋、同机好友挑战。
- 派对：2—4 人，选择 1—3 个项目；每人每项 60 秒，同项目相同开局，累计原始分数，支持并列冠军。浏览器支持保留轮次进度、继续上次。
- 个人：真实本地纪录、触感设置、清空记录确认、分享合集。
- 连线：5 关逐步解锁；当前是基础蛇形可解路径的反射变体。
- 暂停冻结计时；派对不允许重开当前轮；中途退出需要确认。

| 游戏 | 操作 |
|---|---|
| 方块 | 点击下方形状，再点击棋盘锚点 |
| 水果 | 场地内移动瞄准，松手投放 |
| 连线 | 绿点出发经过全部点，橙点结束；原路退格撤销 |
| 弹球 | 点击发射，左右滑动接球 |
| 反应对决 | 两人各点半屏，绿色才能点；抢跑给对手一分 |
| 五子棋 | 黑白轮流点击交叉点 |

## 如何批量制造界面

- `frontend/app.js`：DOM素材拼装、点击区域、真实游戏操作与音效。
- `frontend/scene-plan.js`：页面状态映射、示例图层隐藏、实时文案。
- `frontend/scene-data.js`：1158层的原始坐标、876张图片路径，由脚本生成。
- `src/theme.js`：颜色、描边、纸纹、按钮和涂鸦图标。改一次，全局生效。
- `src/interface.js`：页面模板、流程、21 页清单 `PAGES`、样例状态。
- `src/app.js`：游戏操作和棋盘绘制。
- `src/models.js`：六款游戏规则。
- `docs/design-system.md`：可继续扩展的界面规范。

修改代码后重新构建浏览器文件：

```sh
python3 tools/build_scene_assets.py
python3 tools/build_frontend.py
python3 tools/build_preview.py
node tools/build_gallery.js
```

批量导出 21 张 750×1624 PNG：

```sh
npm install --no-save @napi-rs/canvas
node tools/render_pages.js --font "你的中文字体.ttf" --out renders
```

系统已有中文字体时可省略 `--font`。输出还包含 `manifest.json`，对应页面 ID、中文名、文件名与尺寸。PNG 属于样例状态；不要用样例成绩替换用户真实数据。使用自备且获授权的中文字体。

## 验证与边界

```sh
node tests/models.test.js
node tests/interface.test.js
```

本次通过 10 组游戏规则/输入测试和 6 组界面流程测试；21 页均通过实际 Canvas 离屏渲染。流程覆盖不同屏幕点击、派对计分及相同开局、暂停计时、挑战重开、关卡保存和清空确认。

测试环境缺少中文字体，离屏图未用于确认中文字形；完整浏览器、微信开发者工具及真机尚未验证。渲染器按系统字体展示中文。代码版采用设计稿配色与组件语言，并非逐像素还原已生成效果图。

好友挑战当前为同一部手机轮流挑战。微信分享仅分享文字和合集入口；远程挑战链接、账号同步、云排行榜、联机房间未接入。停车解谜与找不同尚未实现，首页只展示可玩的四款单人游戏。

新浏览器前端会保存派对轮次与积分进度，重开后从当前待挑战玩家继续；正在进行的棋盘不会保存。个人分数与关卡记录保存在本设备。新前端提供通过WebAudio生成的基础音效和背景旋律。

## 0.3：尺寸与防遮挡接入

浏览器预览右上角点击“布局检查”；也可使用 `preview.html?debug=1`。
红色按钮边框表示该按钮有尺寸或交互重叠提示，绿色表示本次按钮检查未发现问题。文字候选问题在 `window.__arcade.layoutSnapshot.issues` 查看。
微信开发时可在创建 app 后调用 `app.enableLayoutDebug(true)`；正式默认关闭检查。

- `src/layout.js`：运行时等比放置、文字测量、按钮标签缩放与检查。
- `src/asset-catalog.js`：原21页1158个Canva元素的ID与参考尺寸。
- `layoutSnapshot`：当前页面元素、按钮范围及候选问题。弹窗打开时仅检查当前有效按钮，避免把被遮罩的底页误判为可点击。
- 点击命中直接读取按钮的 `bounds`，与登记的布局框一致。
- 不自动移动冲突元素，避免改变游戏棋盘坐标或误移有意重叠的元素。

### 原始图片绑定

```js
app.setAssetFiles({
  // 键可用真实asset_id或目录catalog_id，值是已导出的本地图片路径。
  '你的真实asset_id': 'assets/exported-image.png'
});
// 在页面的绘制函数内调用；按原比例装入指定区域。
const result = app.drawAsset('真实目录catalog_id', 24, 180, 150, 140);
```

没有图片文件绑定时返回 `missing_asset_file`；不会把Canva ID伪装成可访问图片地址。
876张独立PNG已全部导出，位于 `assets/分类/目录ID_素材ID.png`。`src/asset-files.js` 提供目录ID与真实asset_id到文件的映射；微信入口和浏览器预览自动注册。六款游戏插画通过统一 doodle 入口调用原始素材，其他页面仍使用现有组件布局；不是整套页面逐像素复刻。
`src/asset-catalog.js` 已补齐实际像素尺寸与非零alpha可见边界。drawAsset 返回 image bounds 与 visibleBounds，布局检查使用可见边界的矩形。检查不能保证完全无视觉遮挡，也不会改变真实游戏碰撞逻辑。


## 0.4：完整素材库

本次新增876个原始独立PNG、自动路径映射、透明边界测量与原素材插画。693个尺寸与此前Canva元数据完全一致；其余183个记录实际PNG尺寸。完整资料包的 `asset-library/index.html` 可以按页面、类别或ID浏览图片，`asset-dimensions.csv` 提供尺寸表。282个文字层继续保存为可编辑文字数据，未烘焙进背景。

素材占约17 MB，应按业务拆分微信分包与加载策略后再提交发布。当前目录可用于本地开发；微信AppID、分包配额、真机和发布审核尚未验证。

## 本地验证

```sh
node --test tests/*.test.js
```

重建素材尺寸与浏览器包，需要 Python 与 Pillow：

```sh
python -m pip install -r requirements.txt
python tools/build_scene_assets.py
python tools/build_frontend.py
```
