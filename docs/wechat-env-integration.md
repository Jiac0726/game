# 微信云开发方案 B · 同环境云函数 + 文档数据库（2026-10-15）

用户已确认微信小游戏环境：`cloudbase-d1gj6cm1ncb1f981a`。**不再尝试让小游戏绑定 `gskj`，也不再要求跨环境 PostgreSQL TCP 连接**。旧 `gskj-d7gp86qo88751cc06` 内的 PostgreSQL 和素材保持原状，素材域名 `www.gskj.cloud` 继续使用。

## A. 先在微信侧新建集合（必须人工执行）

微信开发者工具 → 选择**真实小游戏 AppID** →「云开发」→ 环境 `cloudbase-d1gj6cm1ncb1f981a` →「数据库」→「添加集合」：

- 名称：`flying_rooms`
- 安全权限：**仅管理员可读写**（自定义安全规则 `{"read":false,"write":false}`），禁止客户端直接改房间状态。服务器云函数拥有管理权限。
- 无需增加额外字段、导入 JSON、创建 PostgreSQL 表，也不需要复制旧环境数据库密码。
- 文档会由新后端首次创建房间时写入，使用 `_id=32 位房间码`，其他字段 `state`、`expiresAt`、`updatedAt`。

若数据库菜单不存在或提示“未开通”，先开通对应环境的**文档型云数据库**。本方案无法在只有 PostgreSQL、没有文档数据库的环境中运行。

## B. 上传新 flyingRoom

源码位置 `cloudfunctions/flyingRoom`。本分支已把后端改为 `wx-server-sdk` 的 `cloud.database({throwOnNotFound:false})`、`db.runTransaction`，`package.json` 删除了 `pg`。

右键 `flyingRoom` →「上传并部署：云端安装依赖」。确保选择的是 `cloudbase-d1gj6cm1ncb1f981a`，不是旧 `gskj`。CloudBase 普通事件函数（Event），入口 `index.main`。

部署失败时可进入 GitHub Actions 的 `Package flyingRoom for SCF` 下载已校验的 `flyingRoom.zip`：下载的 Artifact 可能还有一层 ZIP，上传前只解开外层一次。

**验证云端版本**：从小游戏 Console 请求 `flyingRoom` 的 `get`，传 `roomId:'invalid'`。新版应返回 `ROOM / 房间码无效`。若还是“云函数未配置 PostgreSQL”，表明**新函数尚未更新成功**。旧 PG 环境的函数无需删除，历史数据无需迁移。

## B2. 校验云端实际部署版本（2026-10-15 事务热修复）

更新新版云函数后，在微信小游戏调试器 Console 执行：

```javascript
wx.cloud.callFunction({
  name:'flyingRoom',
  config:{env:'cloudbase-d1gj6cm1ncb1f981a'},
  data:{action:'health'}
}).then(r=>console.log('云函数版本',r.result))
  .catch(e=>console.error('云函数调用错误',e));
```

正确结果应包含 `ok:true`、`store:'wechat-cloud-database'` 和 **`version:'wxdb-txset-20261015-2'`**。若返回 `ROOM / 房间码无效` 或没有版本号，表示云端仍执行旧版 `flyingRoom`，或小游戏请求的是别的云环境；如果界面仍显示「请检查新环境是否创建 flying_rooms」，也可能是旧版函数报错或旧提示未清除。

本热修复解决两个真实遇到的服务端事务问题：
- `-502001 Cannot create field 'colors' in element {game: null}`：`doc.update` 把嵌套对象展开，不能在 `null` 创建 `colors`。
- **微信 Node SDK 事务中 `doc.set` 接收裸文档**：应使用 `tx.collection('flying_rooms').doc(id).set({state:next,expiresAt:...,updatedAt:...})`，**不要**像普通 `collection.add` 一样包一层 `{data:{...}}`，否则错误写成 `document.data.state`。

热修复兼容读取上一次错误部署导致的 `document.data.state` 包装，后续正确事务写入将恢复到 `document.state`；不要求删除原房间。若仍失败，请从新环境 `flyingRoom` 的运行日志提取 `stage/action/code/message` 四个字段，不能只看 `200` 状态码。

## C. 建房链路

1. 微信开发者工具以真实小游戏 AppID 编译 V1.0，`src/config.js` 的 `envId` 为 `cloudbase-d1gj6cm1ncb1f981a`。
2. 首页创建联机房间；默认只占房主一个座位，其余三个预留给真人好友；可在开局前调整 AI 数量。
3. 新环境数据库 `flying_rooms` 出现房间文档；状态由服务端事务保存。
4. 邀请另一台微信设备进入同一个房间，验证准备、掷骰、棋子移动；再测试四个真人同时加入。

若报 `DATABASE`：查看**新环境** `flyingRoom` 日志，重点检查 `flying_rooms` 集合是否已存在、云开发数据库是否开通、事务 API 是否支持及函数权限。如果报告 `invalid scope`：检查真实小游戏 AppID 和云开发授权；不要通过关闭数据库权限来绕过授权问题。

## D. 数据安全与一致性

- 只允许云函数访问房间完整文档；客户端不得直接读写 `state` 中的真人 OPENID 或自定义骰子结果。
- 所有加入/准备/房主改 AI/开局/掷骰/移动/超时/重赛统一由服务端业务规则验证，并在单文档 `runTransaction` 中进行读改写。
- 每次玩家操作带 `revision` 与 `requestId`；并发冲突靠事务重试与 `STALE` 响应，确保房间不会在并发写中丢更新。
- 无需 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`、`PGSSLMODE`；禁止把数据库密码提交到 GitHub。
- 旧 PG `public.flying_rooms` 是**完全独立的历史数据**，此方案不会读取、覆盖、删除或自动迁移旧房间。

## E. 发布约束

代码测试为本地模拟云数据库，不等于线上压力测试。至少完成：两台不同微信账号的加入/准备/轮流操作、四台抢座、断线重连、重赛后胜负计数、真实云数据库文档检查。需要时可再安排过期房间清理任务，当前仅业务层按时间拒绝已过期房间。
