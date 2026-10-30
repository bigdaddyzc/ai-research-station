# ACP AI Research 开发说明

## 本地开发

```bash
npm install
npm run dev
```

默认访问：`http://127.0.0.1:4321/zh`

## Cloudflare D1

创建数据库：

```bash
npm run cf:d1:create
```

创建成功后，把 Cloudflare 返回的 `database_id` 填入 `wrangler.toml` 的 `database_id`。

应用迁移：

```bash
npm run cf:d1:migrate:local
npm run cf:d1:migrate:remote
```

## 环境变量

复制 `.env.example` 为 `.env`，至少设置：

```bash
ADMIN_PASSWORD=your-password
AI_PROVIDER=mock
```

生产环境中，密钥应设置在 Cloudflare Pages/Workers 的环境变量或 Secrets 中，不要提交到仓库。

## 当前实现范围

- Astro + TypeScript + Cloudflare adapter 项目骨架
- Cloudflare D1 schema migration
- 中英文首页
- 中英文频道页
- 文章详情页
- `/app` 原APP页面占位
- `/admin` 审核台初版
- 批准即发布 API
- 每日生成任务 mock API

## 下一步

- 接入真实 Cloudflare D1 数据库并写 seed/import 脚本
- 接入 Google Gemini 或 Vertex AI Provider
- 实现新闻/工具/资源/研究来源采集器
- 完善后台编辑、拒绝、归档和个人资源管理
- 增加 RSS、sitemap、SEO 元数据和发布部署流程
