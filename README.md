# 玩一会儿 · 微信小游戏源码

此仓库只保存微信小游戏入口、业务源码、素材 ID/尺寸/路径映射与测试。图片、素材 ZIP、网页预览和导出工具不提交到仓库。

项目类型为微信 **小游戏**，不是 WXML 小程序。入口为 `game.js`，采用现有 Canvas 微信适配器。原 DOM 网页版在此前交付的完整资料包中。

## 合集内四人联机飞行棋（当前入口）

导入仓库根目录，项目类型选择 **小游戏**。打开合集 → 玩法 → 派对 → 一起玩飞行棋 → 创建四人联机房间。邀请卡片通过小游戏 query 携带房间码，好友打开同一个合集就加入该房间，不跳转其他小程序。也支持复制房间码并点击“粘贴房间码加入”。四人到齐并准备后由房主开始；仍保留同机轮流试玩。

`online/` 是之前的独立小程序入口，合集用户不需要导入它。

### 本地克隆与部署

```powershell
git clone --branch fix/handdrawn-online-ui --single-branch https://github.com/Jiac0726/game.git "$env:USERPROFILE\game-collection"
cd "$env:USERPROFILE\game-collection"
powershell -ExecutionPolicy Bypass -File .\deploy-game.ps1
```

脚本会询问 **小游戏 AppID** 和 **与该 AppID 关联的云环境 ID**，修正根目录项目类型，配置 `src/cloud-config.js`，运行测试并部署根目录 `cloudfunctions/flyingRoom`。云函数为游戏后端；素材托管环境可以与它不同，素材包无需重新上传。

在所选云环境中新建 `flying_rooms` 集合，权限 `{ "read": false, "write": false }`，仅云函数访问。配置素材 HTTPS 下载域名后，在开发工具导入克隆的 `game-collection` 根目录，选择小游戏。

云端判定身份、骰子、操作版本、回合和胜负。客户端每1.5秒同步、后台暂停同步、前台恢复；未确认操作持久保存并用同一请求编号重试，禁止重复掷骰。等待室离开释放座位，对局中回合集保留座位，可从“返回上次房间”恢复。

测试覆盖模拟四客户端建房、分享落地、准备开局、走棋、网络中断重试和迟到响应。真实微信 AppID、云环境授权、四部手机及邀请卡片仍需体验版验收；自动测试不代表实际云端已部署。

## 引用外置素材库

素材包：`game-asset-library.zip`（单独交付，879 张 PNG）。解压后保留 `assets/` 下的分类及文件名。

1. 将整个 `assets/` 目录上传到自己的 HTTPS 对象存储或 CDN。例如公开路径结构为 `https://你的域名/game-assets/v1/assets/BG/...png`。
2. 修改 `src/asset-config.js`：

   ```js
   module.exports = {
     baseUrl: 'https://gskj-d7gp86qo88751cc06-1345665452.tcloudbaseapp.com/gamecenter/game-assets/v1',
     useLocalAssets: false
   };
   ```

   `baseUrl` 填 `assets/` 的父目录，不包含 `assets`。使用版本目录管理更新；不要填写 ZIP 下载链接、临时签名链接或 ChatGPT 文件链接。客户端按 ID 查表，按需加载独立图片，不下载整个 ZIP。
3. 在微信后台配置素材服务器域名，并使用自己的小游戏 AppID 替换 `project.config.json` 中的 `touristappid`。导入项目目录，在微信开发者工具及真机检查素材加载。

官方示例及网络说明：
- https://github.com/wechat-miniprogram/minigame-demo
- https://developers.weixin.qq.com/minigame/dev/guide/base-ability/network.html

当前 `baseUrl` 已配置为 CloudBase 静态托管地址：`https://gskj-d7gp86qo88751cc06-1345665452.tcloudbaseapp.com/gamecenter/game-assets/v1`。上传目录包含 `/gamecenter/game-assets/v1`，不要遗漏 `/gamecenter`，也不要再追加一层 `assets`。联机小程序 `online/miniprogram/config.js` 使用相同素材地址，联机云环境 `envId` 保持原配置。

2026-10-12 上传包包含原素材库和 Canva 最新三页的拆分素材，拆分目录为 `assets/CANVA_SPLIT_20261012/`。飞行棋现保留 `FG-*` 逻辑 ID，但图片路径已替换为这些已上传的 Canva 图层，不再请求旧 `assets/FLYING/` 目录。棋盘、四方机场、头像、按钮和四种单枚飞机图标均使用新图；客户端单独校准绘制坐标，不改变服务器规则和进度。16 个骰子帧 ID 共享一张 PNG，通过旋转表现滚动，最终点数仍由真实游戏状态绘制，并非16张独立动画帧。

本地临时验证：把素材包中的 `assets/` 解压到项目根目录，将 `useLocalAssets` 设为 `true`。图片目录已在 `.gitignore` 中排除，正式配置改回远程地址。开发工具上传本地模式时会包含图片，请自行检查包大小。

## 源码说明

| 文件 | 用途 |
| --- | --- |
| `game.js` | 微信入口、触摸与前后台事件、动画循环 |
| `src/app.js` | 游戏交互及绘制 |
| `src/models.js` | 六款游戏规则 |
| `src/interface.js` | 个人、对战、派对、纪录、设置等流程 |
| `src/theme.js` | 手绘组件和颜色 |
| `src/layout.js` | 素材等比缩放、可见边界、图片内存缓存与布局检查 |
| `src/asset-config.js` | 素材库地址与本地开发开关 |
| `src/asset-source.js` | 素材 ID 转远程 URL |
| `src/asset-files.js` | 原页面素材 ID、别名与相对路径表 |
| `src/asset-catalog.js` | 原页面元素尺寸、透明可见边界与参考坐标 |

素材库中的新增水果素材也保留在独立 ZIP；当前微信适配器使用原页面映射，并未迁移原 DOM 前端的全部场景拼装。

## 功能与验证

六款游戏：方块消除、水果合成、一笔连线、弹球打砖块、反应对决、五子棋。底部玩法/个人，玩法顶部个人/对战/派对。同屏对战与同机轮流挑战；六款原有游戏仍以本地规则运行；飞行棋已接入四人联机房间，未提供云排行榜。

```sh
node --test tests/*.test.js
```

测试覆盖游戏规则、界面流程、素材 URL 映射与尺寸元数据、布局命中及图片内存复用。远程真实地址、微信开发者工具和真机尚未验证。图片加载失败时使用内置绘制组件；图片只缓存于当前进程，尚未实现跨启动磁盘缓存。

## 飞行棋手绘扩展

主界面入口：**玩法 → 派对 → 一起玩飞行棋**。支持 2—4 人同机轮流，人数选择、16 帧掷骰表现、选择飞机、52 格环线移动、撞子回机场、精确到终点、胜负和暂停/离开确认。

本版使用明确的基础规则：2/4/6 起飞，6 点连掷；暂不含同色跳格和跨区飞越，不是联网房间。骰子动画不参与点数判断，最终点数由游戏状态单独绘制。

新增源码：`flying-model.js`、`flying-ui.js`、`flying-paths.js`、`flying-assets.js`，位于 `src/`。路径以 1254×1254 棋盘为坐标基准，环线 52 节点、各色终点通道 6 节点、各色停机位 4 个。四处双三角转角按两个节点计数，已提供配套编号校对图。

单独交付的 `flying-chess-handdrawn-library.zip` 包含 54 张编号 PNG、原图裁片、透明重建元素、路径 JSON、尺寸清单、动画 GIF/WebP 和离线 HTML 目录。将其中的 `assets/FLYING/` 合并到已有素材库并托管，继续使用同一个 `baseUrl`。代码仓库不包含这些图片。

新增页面和游戏逻辑已通过自动测试；真实素材地址与微信真机仍需验证。派对效果参考图保存在素材包中，不代表实际代码已逐像素复刻该效果图。

## 旧的独立四人联机小程序入口

新增 `online/`，在微信开发者工具单独导入此目录。固定四个微信账号在线同局，建房后原生分享邀请、四人准备、房主开局、云端骰子和走棋、断线恢复、超时跳过。部署步骤见 [online/README.md](online/README.md)。需要自己的小程序 AppID、云开发环境及素材 HTTPS 地址；当前提交包含可部署源码，没有部署到真实云环境。

## 共用手绘界面与 HTML 预览

旧 HTML 的 21 个页面继续使用同一份 `src/interface.js`、游戏模型和交互逻辑。`src/shared-ui.js` 统一纸张、装饰、标题、返回、导航、按钮和弹窗；`src/ui-layout.js` 固定 375 × 812 设计坐标。浏览器与微信都按相同比例缩放并居中，绘制与点击使用相同坐标。飞行棋同机和联机共用棋盘、骰子与操作区尺寸。

生成可试玩的浏览器预览（直接打包小游戏源码，不维护第二套界面）：

```bash
node tools/build-shared-preview.js /tmp/game-preview.html
# 可选第三参数：本地素材根目录，内部应有 assets/，可内嵌基础界面、游戏图标和飞行棋素材
node tools/build-shared-preview.js /tmp/game-preview.html /path/to/game-assets/v1
```

浏览器提供旧版 21 页及 3 个飞行棋页面；联机功能需微信云环境，预览中的同机游戏可直接试玩。导入微信开发者工具时仍选择仓库根目录。

创建四人飞行棋房间前可选起飞点数（2/4/6 或仅 6）、每次操作时限（30/60/90 秒）、6 点是否连掷。创建后固定规则；等待大厅和对局显示规则，云端校验并执行，再开一局保留相同设置。更新此功能后需重新部署根目录 `cloudfunctions/flyingRoom`。
