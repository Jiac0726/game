# 玩一会儿 · 微信小游戏源码

此仓库只保存微信小游戏入口、业务源码、素材 ID/尺寸/路径映射与测试。图片、素材 ZIP、网页预览和导出工具不提交到仓库。

项目类型为微信 **小游戏**，不是 WXML 小程序。入口为 `game.js`，采用现有 Canvas 微信适配器。原 DOM 网页版在此前交付的完整资料包中。

## 引用外置素材库

素材包：`game-asset-library.zip`（单独交付，879 张 PNG）。解压后保留 `assets/` 下的分类及文件名。

1. 将整个 `assets/` 目录上传到自己的 HTTPS 对象存储或 CDN。当前已使用 `https://www.gskj.cloud/game-assets/v1/assets/BG/...png`。CloudBase 的 HTTP 网关根路由 `/` 指向 `gamecenter` 静态托管应用，因此公网 URL **不需要**添加 `/gamecenter`。
2. 修改 `src/asset-config.js`：

   ```js
   module.exports = {
     baseUrl: 'https://www.gskj.cloud/game-assets/v1',
     useLocalAssets: false
   };
   ```

   `baseUrl` 填 `assets/` 的父目录，不包含 `assets`。使用版本目录管理更新；不要填写 ZIP 下载链接、临时签名链接或 ChatGPT 文件链接。客户端按 ID 查表，按需加载独立图片，不下载整个 ZIP。
3. 在微信后台配置素材服务器域名，并使用自己的小游戏 AppID 替换 `project.config.json` 中的 `touristappid`。导入项目目录，在微信开发者工具及真机检查素材加载。

官方示例及网络说明：
- https://github.com/wechat-miniprogram/minigame-demo
- https://developers.weixin.qq.com/minigame/dev/guide/base-ability/network.html

当前已配置 `www.gskj.cloud` 的 HTTPS 素材域名，已有单张 PNG 经浏览器验证可以打开；全量素材及微信真机加载仍需验收。图片失败时使用内置绘制组件，不代表远程素材全部可用。

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

六款游戏：方块消除、水果合成、一笔连线、弹球打砖块、反应对决、五子棋。底部玩法/个人，玩法顶部个人/对战/派对。同屏对战与同机轮流挑战；未接入联网房间、云账号及云排行榜。

```sh
node --test tests/*.test.js
```

测试覆盖游戏规则、界面流程、素材 URL 映射与尺寸元数据、布局命中及图片内存复用。微信开发者工具和真机的完整远程素材加载尚未验证。图片加载失败时使用内置绘制组件；图片只缓存于当前进程，尚未实现跨启动磁盘缓存。

## 飞行棋手绘扩展

主界面入口：**玩法 → 派对 → 一起玩飞行棋**。支持 2—4 人同机轮流或电脑挑战，人数选择、0—3 名电脑玩家和简单/普通/困难难度、16 帧掷骰表现、电脑棋子逐格移动和虚线直线飞越动画、选择飞机、52 格环线移动、同色跳跃、虚线飞越、撞子回机场、叠机阻挡、终点反弹、胜负和暂停/离开确认。

本版使用明确的基础规则：6 点起飞（联机房间可选 5/6 点或偶数点），6 点连掷并限制三连 6，包含同色跳 4 格、虚线飞越 12 格、撞子与叠机、终点超点反弹，不是联网房间。骰子动画不参与点数判断，最终点数由游戏状态单独绘制。

新增源码：`flying-model.js`、`flying-ui.js`、`flying-paths.js`、`flying-assets.js`，位于 `src/`。路径以 1254×1254 棋盘为坐标基准，环线 52 节点、各色终点通道 6 节点、各色停机位 4 个。四处双三角转角按两个节点计数，已提供配套编号校对图。

单独交付的 `flying-chess-handdrawn-library.zip` 包含 54 张编号 PNG、原图裁片、透明重建元素、路径 JSON、尺寸清单、动画 GIF/WebP 和离线 HTML 目录。将其中的 `assets/FLYING/` 合并到已有素材库并托管，继续使用同一个 `baseUrl`。代码仓库不包含这些图片。

新增页面和游戏逻辑已通过自动测试；真实素材地址与微信真机仍需验证。派对效果参考图保存在素材包中，不代表实际代码已逐像素复刻该效果图。

## 四人联机 / AI 机器人小程序版本

新增 `online/`，在微信开发者工具单独导入此目录。支持 1—4 位真人加 0—3 名 AI 电脑（总共四个阵营），建房规则预设、电脑难度设置、原生分享邀请、真人准备、房主开局、云端骰子与电脑自动走棋、断线恢复、超时跳过。部署步骤见 [online/README.md](online/README.md)。需要自己的小程序 AppID、云开发环境及素材 HTTPS 地址；当前提交包含可部署源码，没有部署到真实云环境。
