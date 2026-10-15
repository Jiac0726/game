# 手绘飞行棋 · 独立微信小游戏

这是独立的 **微信小游戏**（`compileType: game`），不是 WXML / WXSS 微信小程序。入口 `game.js`，由 Canvas 完成首页、创建房间、邀请、准备、棋盘、掷骰、棋子与结算。

- 支持 1 人 + 3 台本地 AI 的离线挑战
- 在线 1–4 真人 + 0–3 云端 AI，微信原生分享邀请码，重连、超时跳过与重赛
- 复用 `flying-model`、`flying-ai`、`flying-motion`、云函数 `flyingRoom`
- 远程素材沿用 `www.gskj.cloud/game-assets/v1/assets/FLYING/`，不捆绑 PNG

## 初始化

1. 在微信开发者工具中导入仓库根目录，选择**小游戏**，在 `project.config.json` 设置自己对应的小游戏 AppID。它与普通小程序 AppID 的类型须匹配。
2. 开通云开发，新建数据库集合 `flying_rooms`，设置仅云函数读写（`database.rules.json`）。
3. 部署根目录 `cloudfunctions/flyingRoom` 云函数，安装服务端依赖。在 `src/config.js` 填云函数所在环境的真实 `envId`。
4. 将 `www.gskj.cloud` 配置为相应的合法网络资源域名；检查棋盘、棋子和骰子 PNG 的 200 状态。
5. 真机执行建房、分享、两手机加入、准备、开始、操作、重连、机器人回合和重赛验收。

本小游戏没有 `app.wxss` / `app.wxml` / `miniprogramRoot`，不会把小程序文件当作小游戏打包。不要把旧 `standalone/flying-chess-wechat` 小程序项目直接覆盖到这个分支。

运行 `node --test tests/*.test.js` 做离线回归。云开发环境、微信分享接口、图片下载及真实多端同步仍需真机验证。最近生成的四个小停机坪新版棋盘，尚未替换已托管的 `FG-BOARD-001.png`，不要视为已经发布。
