# AI Research Station

A bilingual publishing site for AI research content, built with **Astro, TypeScript, and Cloudflare D1**. It brings channel pages, article pages, and an admin review-to-publish workflow into one application.

**For developers building a curated research site**, rather than a general-purpose chatbot. The repository includes development and mock-generation paths; generated or demo content should not be treated as verified research. Check the implementation notes below before assuming a feature is production-ready.

[Local Development](#本地开发) · [Database Setup](#cloudflare-d1) · [Environment Variables](#环境变量) · [Implementation Notes](#当前实现范围)

To try it locally, clone the repository, install the locked dependencies, and configure `.env` from `.env.example` before starting the development server. Database creation, migrations, and production secrets are documented below.

## 中文说明

这是一个面向 AI 研究内容的中英文发布站点，包含频道、文章页和后台审核发布流程。适合想搭建人工审核型内容站点的开发者；原有开发说明与实现范围保留如下。

## 本地开发

```bash
git clone https://github.com/bigdaddyzc/ai-research-station.git
cd ai-research-station
npm ci
# Copy .env.example to .env and configure it as described below.
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
