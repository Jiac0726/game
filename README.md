# 手绘飞行棋 · 独立微信小程序

这是独立的微信小程序工程，**不是微信小游戏合集**。打开本仓库根目录即可使用微信开发者工具导入，不要再导入原 `game` 目录里的小游戏配置。飞行棋代码独立维护；原小游戏合集不受影响。

## 已有功能

- 4 个座位，支持 1–4 位真人和最多 3 位云端 AI
- 微信好友分享邀请、重连原房间、房间准备和房主开始
- 服务器掷骰、事务同步、请求幂等、60 秒超时、24 小时过期
- 可配置起飞点数、连投、跳跃、飞越、叠机、撞机、终点反弹
- 手绘棋盘、棋子放大 2 倍、16 帧骰子、机器人逐格动画
- 图片放在独立云端素材库，不打入安装包

## 首次部署

1. 微信开发者工具 → 导入项目 → 选择**本仓库根目录** → 项目类型选 **小程序**。把 `project.config.json` 的 `appid` 替换为你自己的**小程序 AppID**。请不要直接复用小游戏 AppID；小游戏和小程序类型不同。
2. 打开 `miniprogram/config.js`，设置 `envId` 为你为本程序开通并部署 `flyingRoom` 的云开发环境。不要把旧项目的环境 ID 未核实就直接照抄。
3. 云开发数据库创建集合 `flying_rooms`，权限禁止客户端读写（可参考 `database.rules.json`）。云函数通过服务端 SDK 访问。
4. 右键 `cloudfunctions/flyingRoom` → 「上传并部署：云端安装依赖」。选择相同云环境并确认支持事务。
5. 云端素材根地址已设置为 `https://www.gskj.cloud/game-assets/v1`，请在微信后台配置相应合法下载域名并验证 PNG 资源可用。
6. 使用两个或更多微信账号真机验收建房、准备、邀请、掷骰、逐格走棋、重新进入房间与重赛。

项目结构：

```text
project.config.json
miniprogram/
  app.js
  app.json
  app.wxss
  config.js
  lib/
  pages/index/
  pages/room/
cloudfunctions/
  flyingRoom/
database.rules.json
tests/
```

在仓库根目录运行 `node --test tests/*.test.js` 进行离线结构与规则检查。**本地测试不等同于云函数成功部署或多手机联机通过。**

旧版本小游戏合集仍在 `Jiac0726/game` 的 `main` / `feat/cloud-handdrawn-ui-20261014` 分支。此独立工程可通过 `standalone/flying-chess-wechat` 分支检出或下载 ZIP。

注：主棋盘使用云端已上传的 `FG-BOARD-001.png`；最近新绘制的四角独立停机坪棋盘图尚未接入云端素材地址，不能把它误认为已发布。
