# 微信小游戏云环境接入（2026-10-15）

## 两个环境的用途

| 资源 | 环境 |
| --- | --- |
| 微信小游戏直接调用的云函数 `flyingRoom` | `cloudbase-d1gj6cm1ncb1f981a`（在小游戏云开发面板可见） |
| 旧版 `flyingRoom` 云函数与 `public.flying_rooms` PostgreSQL | `gskj-d7gp86qo88751cc06` |
| 手绘图片 CDN | `https://www.gskj.cloud/game-assets/v1` |

本分支 `src/config.js` 的 `envId` 已改为微信环境。**环境之间相互隔离，旧环境的云函数不会被小游戏自动调用，也不能把 PostgreSQL 表直接视为新环境的表。**

## 第一步：先证明小游戏能调用新环境

保证 `project.config.json` 是该小游戏的真实 AppID，而不是 `touristappid`。在微信开发者工具小游戏 Console 中：

```javascript
wx.cloud.init({env:'cloudbase-d1gj6cm1ncb1f981a'});
wx.cloud.callFunction({
  name:'flyingRoom',
  data:{action:'get',roomId:'invalid'}
}).then(r=>console.log('CALL_OK',r.result))
  .catch(e=>console.error('CALL_FAIL',e.errCode,e.errMsg,e));
```

- 返回 `function not found`、`函数不存在`：新环境授权可能已过关，但正式函数尚未部署。
- 返回 `ROOM / 房间码无效`：新环境的正式函数已正常收到调用。
- 返回 `AUTH`：函数已运行，但尚未正确获取微信用户身份。
- 返回 `invalid scope`：仍需要确认小游戏真实 AppID、账号及云服务权限；**先不要迁移数据库**。
- 其他错误：以完整错误码和新环境函数日志为准。

## 第二步：部署函数到微信环境

保持 `flyingRoom` 作为 **普通 Event 云函数**，入口 `index.main`，Node.js 20.x，并启用云端安装依赖（`pg`, `wx-server-sdk`）。使用本项目 `cloudfunctions/flyingRoom` 的最新代码。

在 PowerShell（云开发 CLI 已登录到管理该微信云环境的账号的前提下）：

```powershell
tcb env list -r ap-shanghai
tcb fn list --env-id cloudbase-d1gj6cm1ncb1f981a --region ap-shanghai
```

**先确认新环境出现在列表中且有权限，才部署。** `cloudbase-d1gj6cm1ncb1f981a` 的地域以控制台为准；如果不是上海，命令中的 `ap-shanghai` 应据实修改。

```powershell
$src = "C:\Users\费克玛尼\flying-chess-minigame\cloudfunctions\flyingRoom"
tcb fn deploy flyingRoom --dir "$src" --env-id cloudbase-d1gj6cm1ncb1f981a --region ap-shanghai --install-dependency true
```

如果 CLI 无权限管理微信侧新环境，改用微信开发者工具对应环境的云函数上传/部署入口；不必删除原 gskj 环境里的 `flyingRoom`。上传 ZIP 时确保根目录直接包含 `index.js`、`service.js`、`package.json`、`lib/`，不要上传 GitHub artifact 外层 ZIP。

## 第三步：复用原 PostgreSQL，仅在可达条件下

新环境函数需要独立配置 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`、`PGSSLMODE`；这些变量**不会从旧环境自动继承**。原环境 SQL 表无需重新建。

跨环境数据库访问**不保证通**：确认 PG 主机支持新环境可达的网络入口（同地域互联 VPC，或严格限制的公网 TLS 连接），数据库账号通过权限与 RLS 检查。切勿直接把 `PGPASSWORD` 或 CloudBase 管理 API Key 放入小游戏客户端、控制台截图、仓库。不要为调通服务无条件将数据库公网开放。

## 第四步：验收

1. 微信小游戏点击“创建联机房间”，新环境 `flyingRoom` 日志出现调用。
2. PG SQL 编辑器执行 `SELECT room_id, updated_at FROM public.flying_rooms ORDER BY updated_at DESC LIMIT 5;`，观察新纪录。
3. 用两台不同微信账户加入一个房间，再验证四人实际联机、断线重连、胜负统计。

如果第三步跨环境 PostgreSQL 无法连接，先保留全部数据库和资产，改为**新微信环境自带文档数据库 + 服务器事务**方案；这需要替换当前 `pg` 持久化层，而不是简单修改 `PGHOST`。

当前项目不应被标记为“真机联机上线成功”，直到微信调用、数据库写入、两人和四人测试均通过。
