# 小红书线索中继服务

接收小红书私信数据推送 Webhook，按租户配置写入飞书多维表格。

## 用户前端提交配置（无需管理员人工录入）

插件内用户填写「服务器地址 + 授权码」后点击「提交并保存到服务器」，会请求本服务的 `POST /api/tenant`，服务器将 app_token、table_id、personal_base_token 写入 **SQLite 数据库**（支持十万级租户），后续该租户的线索即可自动写入对应多维表格，**无需管理员改 JSON 或数据库**。

**为何之前说「personal_base_token 只保存在服务器侧、不要从插件提交」？**  
授权码相当于该 Base 的**完全读写权限**，若在浏览器、网络链路或前端代码中暴露，可能被截获或滥用。因此推荐「只在服务器侧存储、不经过前端」。在本实现中采用「用户前端提交 → 后端写入 SQLite」，在保证部署与传输安全的情况下，可避免管理员被累死。

## 启动

```bash
npm install
npm start
```

环境变量：

- `PORT` 端口，默认 3000
- `TENANTS_DB_PATH` 租户库路径，默认 `./data/tenants.db`
- 单租户时可只用环境变量、不写库：`BASE_APP_TOKEN`、`BASE_PERSONAL_BASE_TOKEN`、`BASE_TABLE_ID`、`XHS_WEBHOOK_TOKEN`（可选）

## 接口

- `POST /api/tenant`  
  前端提交配置，服务器自动保存到 SQLite。Body：`{ "tenant_id", "app_token", "table_id", "personal_base_token" }`。响应 200 且 `ok: true` 表示保存成功。
- `POST /webhook/leads/:tenantId`  
  Body：小红书推送 JSON（含 `data`、`timestamp`、`source`）。**响应 200 即认为推送成功**（与小红书「消息发送」文档一致；非 200 会触发 30s 重试，最多 3 次）。

## 消息发送联调（与小红书文档一致）

- **文档**：客户完成有效私信标注且完成广告归因后，以 **POST、JSON** 推送到「私信 API 对接」中填写的**消息接收地址**；**response code 200 = 推送成功**，失败时每 30s 重试，最多 3 次。
- **本服务约定**：
  - 消息接收地址示例：`http://<host>:3000/webhook/leads/<tenant_id>`，其中 `tenant_id` 与插件内配置的 Base 对应（插件用 baseId 作为 tenant_id）。
  - 请求体：`{ "data": { ... } }` 必选，`data` 为单条线索对象；顶层可带 `timestamp`、`source`，本服务仅使用 `data`。
  - 成功：返回 **HTTP 200**，body 如 `{ "ok": true }` 或 `{ "ok": true, "message": "No fields to write" }`。
  - 失败：返回 400/404/500，平台会按文档重试。
- **自测命令**（在能访问服务器的环境执行）：
```bash
# 1. 缺少 data → 应为 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://101.132.138.196:3000/webhook/leads/default" -H "Content-Type: application/json" -d '{}'

# 2. 合法 body（租户未配置会 404，已配置且 Base 正常则 200）
curl -s -w "\nHTTP: %{http_code}\n" -X POST "http://101.132.138.196:3000/webhook/leads/default" -H "Content-Type: application/json" -d '{"data":{"id":"test1","type":0,"time":"2025-03-01 12:00:00","nick_name":"测试"},"timestamp":1709272800,"source":"official"}'
```

## 租户配置与存储

- **存储**：租户配置仅持久化在 SQLite（默认 `./data/tenants.db`），支持十万级租户；按 `tenant_id` 索引，读写均为单行操作，不常驻内存。
- 每户配置包含：`app_token`（多维表格）、`personal_base_token`（多维表格授权码）、`table_id`（目标表）。
