# 玩一会儿 · 微信小游戏源码

此仓库只保存微信小游戏入口、业务源码、素材 ID/尺寸/路径映射与测试。图片、素材 ZIP、网页预览和导出工具不提交到仓库。

项目类型为微信 **小游戏**，不是 WXML 小程序。入口为 `game.js`，采用现有 Canvas 微信适配器。原 DOM 网页版在此前交付的完整资料包中。

## 引用外置素材库

素材包：`game-asset-library.zip`（单独交付，879 张 PNG）。解压后保留 `assets/` 下的分类及文件名。

1. 将整个 `assets/` 目录上传到自己的 HTTPS 对象存储或 CDN。例如公开路径结构为 `https://你的域名/game-assets/v1/assets/BG/...png`。
2. 修改 `src/asset-config.js`：

   ```js
   module.exports = {
     baseUrl: 'https://你的域名/game-assets/v1',
     useLocalAssets: false
   };
   ```

   `baseUrl` 填 `assets/` 的父目录，不包含 `assets`。使用版本目录管理更新；不要填写 ZIP 下载链接、临时签名链接或 ChatGPT 文件链接。客户端按 ID 查表，按需加载独立图片，不下载整个 ZIP。
3. 在微信后台配置素材服务器域名，并使用自己的小游戏 AppID 替换 `project.config.json` 中的 `touristappid`。导入项目目录，在微信开发者工具及真机检查素材加载。

官方示例及网络说明：
- https://github.com/wechat-miniprogram/minigame-demo
- https://developers.weixin.qq.com/minigame/dev/guide/base-ability/network.html

当前没有提供真实素材托管域名，所以 `baseUrl` 留空。留空时显示配置提示，使用内置绘制组件，游戏规则仍可运行；这不代表远程素材已经接通。

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

测试覆盖游戏规则、界面流程、素材 URL 映射与尺寸元数据、布局命中及图片内存复用。远程真实地址、微信开发者工具和真机尚未验证。图片加载失败时使用内置绘制组件；图片只缓存于当前进程，尚未实现跨启动磁盘缓存。

## 飞行棋手绘扩展

主界面入口：**玩法 → 派对 → 一起玩飞行棋**。支持 2—4 人同机轮流，人数选择、16 帧掷骰表现、选择飞机、52 格环线移动、撞子回机场、精确到终点、胜负和暂停/离开确认。

本版使用明确的基础规则：2/4/6 起飞，6 点连掷；暂不含同色跳格和跨区飞越，不是联网房间。骰子动画不参与点数判断，最终点数由游戏状态单独绘制。

新增源码：`flying-model.js`、`flying-ui.js`、`flying-paths.js`、`flying-assets.js`，位于 `src/`。路径以 1254×1254 棋盘为坐标基准，环线 52 节点、各色终点通道 6 节点、各色停机位 4 个。四处双三角转角按两个节点计数，已提供配套编号校对图。

单独交付的 `flying-chess-handdrawn-library.zip` 包含 54 张编号 PNG、原图裁片、透明重建元素、路径 JSON、尺寸清单、动画 GIF/WebP 和离线 HTML 目录。将其中的 `assets/FLYING/` 合并到已有素材库并托管，继续使用同一个 `baseUrl`。代码仓库不包含这些图片。

新增页面和游戏逻辑已通过自动测试；真实素材地址与微信真机仍需验证。派对效果参考图保存在素材包中，不代表实际代码已逐像素复刻该效果图。
