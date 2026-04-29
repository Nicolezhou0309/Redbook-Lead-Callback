# 小红书线索同步 · 多维表格边栏插件

本仓库包含：**边栏插件前端**（源码在 `frontend`，构建产物在仓库根目录 `dist/`）与 **Webhook/Relay 服务**（`relay`）。静态资源目录 `public/` 与插件同级，供 Vite 构建引用。

不包含：`node_modules`、`deploy.env` 及根目录下的大型本地参考文档。

## 插件前端

```bash
cd frontend
npm ci
npm run build
```

产物：仓库根目录 `dist/`（由 `frontend` 下 `npm run build` 生成）。

## Relay 服务

```bash
cd relay
npm ci
node src/index.js
```

详见 `relay/README.md`。

## 产品说明

上架与配置清单见：`小红书线索同步-多维表格-边栏插件.md`。
