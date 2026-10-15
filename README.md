# 你小子给我飞起来 · V1.0 微信小游戏

这是**独立微信小游戏**（`project.config.json`: `compileType: game`），不是 WXML/WXSS 普通小程序。采用 Canvas 渲染；支持单机一人对抗三名 AI、四座位好友联机、规则自定义、本机战绩、无充值的幸运星及纸张主题兑换。

**当前状态：V1.0 源码与离线自动测试完成；微信侧文档数据库需要建集合并更新部署 `flyingRoom`；真机四人联机尚未验收。**

## 统一云环境架构（方案 B）

| 资源 | 位置 |
| --- | --- |
| 微信小游戏 `wx.cloud` 调用环境 | `cloudbase-d1gj6cm1ncb1f981a` |
| 联机云函数 `flyingRoom` | 同一个 `cloudbase-d1gj6cm1ncb1f981a` |
| 房间数据（文档数据库集合 `flying_rooms`） | 同一个 `cloudbase-d1gj6cm1ncb1f981a` |
| 手绘棋盘与飞机素材 | `https://www.gskj.cloud/game-assets/v1` |
| 旧 PostgreSQL | `gskj-d7gp86qo88751cc06`，**历史数据保留，但联机不再依赖** |

重要：只把 `src/config.js` 的 `envId` 指向**小游戏实际已开通的云环境**，不能把旧 `gskj` 环境或图片域名填到 `envId` 中。根目录 `project.config.json` 的 `touristappid` 是占位值，请使用自己的真实**微信小游戏** AppID。

## 一、创建微信云数据库集合

在微信开发者工具中选择小游戏环境 `cloudbase-d1gj6cm1ncb1f981a` → 云开发 → 数据库：

1. **新建集合**，准确命名为 `flying_rooms`（全小写，使用下划线）。
2. 为集合设置**仅管理员可读写**，禁止小程序端直接读取房间全量状态或直接改写掷骰结果。可在安全规则中使用仓库 `database.rules.json` 的内容：
   ```json
   {
     "read": false,
     "write": false
   }
   ```
   这一限制是对小游戏客户端生效，云函数的服务端 SDK 仍然能够访问集合。
3. **不需要手动插入文档**：首次创建房间时由 `flyingRoom` 写入首条文档，`_id` 等于 32 位房间码。
4. **不需要 SQL 或 PostgreSQL 密码**，也不需要安装 `pg`。

数据库集合应创建在微信小游戏环境，不是 `gskj-d7gp86qo88751cc06`。目前旧 PG 房间不会自动迁移；请在新环境中新建游戏房间。

## 二、上传并部署最新版云函数

微信开发者工具 → 当前项目 → `cloudfunctions/flyingRoom` 文件夹 → **右键「上传并部署：云端安装依赖」**，目标环境必须是 `cloudbase-d1gj6cm1ncb1f981a`。

- 类型：**普通云函数（Event）**；
- 函数名：`flyingRoom`；执行入口：`index.main`；
- Node.js 运行环境：20.x（按控制台支持版本选）；
- 依赖只需要 `wx-server-sdk ~3.0.1`；不再需要 `pg`；
- 后端操作 `flying_rooms` 集合，使用 `db.runTransaction()` 保存对局；
- 云函数环境变量里原先的 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSLMODE` 已不再使用；更新后可视需要在**新函数**中删除废弃配置，旧环境无需修改。

如微信开发者工具不能上传，也可用 GitHub Actions 的 **Package flyingRoom for SCF** 产出的标准 ZIP，在微信小游戏云开发控制台上传，不要直接上传 GitHub Artifacts 的外层 ZIP 文件。

## 三、云函数调用自检

在微信开发者工具的**小游戏 JavaScript Console** 执行：

```javascript
wx.cloud.init({env:'cloudbase-d1gj6cm1ncb1f981a'});
wx.cloud.callFunction({
  name:'flyingRoom',
  data:{action:'get',roomId:'invalid'}
}).then(r=>console.log('flyingRoom:',r.result))
  .catch(e=>console.error('调用失败',e));
```

`{ok:false,code:'ROOM',message:'房间码无效'}` 是**预期结果**：说明微信小游戏已经成功执行最新后端函数。若仍显示“未配置 PostgreSQL”，表示新后端代码**尚未成功替换云端**；若 `function not found` 或 `invalid scope`，优先检查 AppID、环境、函数部署及授权。

随后在小游戏创建联机房间，云数据库 `flying_rooms` 中应出现一条由服务端写入的房间文档，内部有 `state`、`expiresAt` 和 `updatedAt`。

## 四、多人联机一致性

房间状态存放在同一个文档的 `state` 对象里。服务器根据真实微信 OPENID 校验房间成员，所有重要写操作走 **`db.runTransaction`**；同时检查 `revision` 与 `requestId`，避免重复提交或多名玩家同时抢座而覆盖数据。读请求只返回过滤后的房间视图，不向小游戏前端返回参与者的 OPENID。

`runTransaction` 依赖云函数所在环境支持**微信文档数据库事务**，不支持事务的数据库版本不能安全运行当前四人联机持久化。如果控制台报告事务不支持，请先确认环境数据库类型和 SDK 支持情况，**不要降级成直接 get 后 update 的非原子写法**。

## 五、源码测试

```cmd
cd /d "C:\Users\费克玛尼\flying-chess-minigame"
node --test
```

测试覆盖飞行棋完整规则、AI、动画、Canvas、好友房间、云数据库事务模拟、并发抢座、重复请求和客户端隐私过滤。这些测试**不等同于真实微信云数据库集成测试**，必须完成真机建房、两人加入、四人对局、断线重连、重赛验证。

## 六、上线文档

- [微信云环境接入操作](docs/wechat-env-integration.md)
- [V1.0 内容审核和验收清单](docs/v1.0-release-and-review.md)
- [标准云函数 ZIP 自动打包工作流](.github/workflows/package-flying-room.yml)

**旧 PG SQL 迁移脚本** `sql/001_flying_rooms_postgres.sql` 仅作为历史兼容存档，**方案 B 不执行该 SQL，也不迁移旧数据库**。
