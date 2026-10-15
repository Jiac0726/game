# 你小子给我飞起来 · V1.0 独立微信小游戏

> **当前为代码版 V1.0（待真机联机验收）**。版本功能与腾讯小游戏内容审核文案、升级步骤、截图清单请看 [V1.0 发布与审核清单](docs/v1.0-release-and-review.md)。

**V1.0 新增**：本机战绩（胜场、总场次、单机/联机数、胜率）、零充值的免费幸运星（完成对局 10 星、胜利额外 20 星）、纸张主题兑换和切换、规则帮助页、默认预留 3 个真人位置的好友房间。所有积分只用于本机外观，不支持充值、提现、交易或跨设备同步。

**部署变化**：云函数房间 JSONB 状态新增 `round` 局号，用于区分重赛积分奖励，不需要新增 SQL 表或字段，但须重新部署 `flyingRoom` 最新代码。

这是独立的 **微信小游戏**（`compileType: game`），不是 WXML / WXSS 微信小程序。入口 `game.js`，大厅、建房、邀请、棋盘、掷骰、棋子和结算都是 Canvas 绘制。支持单机 1 人 + 3 AI 及四人联机（1–4 真人，其余可用 AI）。

## 技术架构

- 微信小游戏：`src/game-app.js` + `src/view.js`（Canvas）
- 游戏规则：`src/flying-model.js` 和 `src/flying-ai.js`
- 联机云函数：`cloudfunctions/flyingRoom`，使用微信上下文 OPENID，服务器掷骰
- 数据持久化：**PostgreSQL**，非 NoSQL，单表 `public.flying_rooms` 保存 JSONB 房间状态
- 并发安全：每个写操作 `BEGIN` → `SELECT ... FOR UPDATE` → 验证修订号/权限 → `UPDATE` → `COMMIT`
- 图片：`https://www.gskj.cloud/game-assets/v1/assets/FLYING/`，不打包 PNG

## 微信云服务开通问题

如果微信开发者工具报 `cloud init error: invalid scope 没有权限，请先开通云服务`，请求尚未正常进入云函数，**不要重新改 PostgreSQL 密码或 SQL 表**。优先核对小游戏真实 AppID、微信侧云服务是否开通以及小游戏账号是否关联/授权 `gskj-d7gp86qo88751cc06` 环境。仓库的 `project.config.json` 仍使用 `touristappid` 作为占位，不应直接用于真机联机。

## ① 数据库：执行建表脚本

进入 CloudBase 环境 `gskj-d7gp86qo88751cc06` → **SQL 型数据库 → SQL 编辑器**，打开仓库的 [`sql/001_flying_rooms_postgres.sql`](sql/001_flying_rooms_postgres.sql)，将 SQL 全文复制到编辑器执行。

该脚本只创建房间表、过期索引、启用 RLS 并撤销 PUBLIC 的表权限，**不删除已有表**。RLS 默认拒绝普通客户端操作；云函数所用数据库角色必须拥有该表的 INSERT、SELECT 和 UPDATE 权限。最简单的初次验证是使用建表所有者角色；上线前应配置最小权限独立账号。

执行完成后，在 SQL 编辑器执行：

```sql
SELECT to_regclass('public.flying_rooms') AS flying_rooms_table;
SELECT relrowsecurity FROM pg_class WHERE oid='public.flying_rooms'::regclass;
```

预期 `flying_rooms_table` 有值，`relrowsecurity` 为 `true`。不要创建 NoSQL 集合 `flying_rooms`，也不要把旧 `database.rules.json` 作为数据库权限配置。

## ② 云函数连接信息（不要提交密码）

在腾讯云 CloudBase 控制台查看 PostgreSQL 的**连接参数**（不是 SQL 编辑器里的 `version()` 结果）。打开该环境中的「云函数/托管」，新建或编辑 `flyingRoom` 普通事件云函数，选择 Node.js 18 或更高运行时，将这些信息设置为**云函数环境变量**：

| 变量 | 内容 |
| --- | --- |
| `PGHOST` | 数据库连接主机地址（优先可用的同地域内网地址） |
| `PGPORT` | 数据库端口，一般 5432，实际以控制台为准 |
| `PGDATABASE` | SQL 编辑器正在操作的数据库名称 |
| `PGUSER` | 具有房间表读取和写入权限的数据库账号 |
| `PGPASSWORD` | 账号密码（仅填入云函数设置，**不要发给聊天或 GitHub**） |
| `PGSSLMODE` | 默认 `verify-full` 验证证书；仅在控制台明确指示或测试环境使用 `require`（不验证证书）；内网允许明文时才用 `disable` |

**重要：** CloudBase SQL 编辑器能运行 SQL 不能自动证明云函数能直连数据库。需要在 CloudBase 控制台确认 PostgreSQL 地址、账号、网络连通性及 SSL 配置。无法直连时请先核实 CloudBase 的网络访问设置，不要把用户数据库密码写入小游戏前端。

## ③ 部署云函数与小游戏

通过微信开发者工具在本仓库根目录导入为**小游戏**，并在根目录 `project.config.json` 中填你自己的微信**小游戏** AppID。打开 CloudBase 并关联该 AppID 的环境。

在同一个 CloudBase 环境 `gskj-d7gp86qo88751cc06` 中，将 `cloudfunctions/flyingRoom` 目录**上传并部署（云端安装依赖）**，确认云端已安装 `pg` 和 `wx-server-sdk`。`src/config.js` 的 `envId` 已使用这一环境 ID，静态资源地址沿用原有域名。

### 常见问题

- `云函数未配置 PostgreSQL`：检查云函数环境变量是否填写及函数是否重新部署。
- `请求失败，请检查云函数 PostgreSQL 连接与表结构`：检查 PostgreSQL 的地址、权限、SSL、表是否建好、函数云端日志中的 PG 错误码。
- `无法获取微信身份`：检查小游戏 AppID、关联环境、是否真机从合法小游戏入口调用。
- `source package include invalid app.wxss`：导入错了普通小程序工程；本分支**没有 WXML/WXSS**。
- `roll` 或 `move` 返回 `STALE`：不同手机已提交更新，重新获取房间状态后按新版本操作。

## ④ 验收

在仓库根目录运行：

```cmd
node --test tests\*.test.js
```

测试覆盖本地规则、机器人、运动分帧、Canvas 界面、PostgreSQL JSONB 逻辑、并发锁模拟和防重复提交。**这些是离线模拟测试，不代替连接真实 PostgreSQL 和真机联机验收。** 真机依次验证：单人三 AI、两人联机、四人联机、分享加入、掷骰、撞机、重复请求、后台重连和重赛。

### 注意
- 该分支独立于小游戏合集 main，暂未合并。
- 最近生成的四角独立停机坪新版棋盘，尚未替换已托管的 `FG-BOARD-001.png`。
- 房间记录目前 24 小时过期由业务判断，但**未配置定期清理过期数据库记录的任务**。
