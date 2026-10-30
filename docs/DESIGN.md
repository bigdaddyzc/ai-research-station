# ACP AI Research 设计文档

## 1. 已确认产品决策

- 公开品牌名：ACP AI Research
- 网站定位：AI研究站，偏科技媒体风，兼具研究深度和可读性
- 语言策略：中文和英文同等重要
- 内容发布：AI生成内容进入草稿，站长批准后立即发布
- 原APP页面：保留为独立页面，路径使用 `/app`
- 后台认证：MVP阶段使用简单密码保护
- 数据库：Cloudflare D1，由项目配置自动初始化
- 部署：Cloudflare Pages + Workers/Functions + D1 + Cron Triggers
- AI生成服务：优先设计为可插拔Provider；Google Cloud/Gemini可作为首选候选，但账号和密钥不写入代码

## 2. 产品气质

ACP AI Research 应该像一个每天更新的AI观察编辑部，而不是普通博客或工具导航。

关键词：

- 快速了解
- 来源可追溯
- 判断清晰
- 双语一致
- 少噪音
- 有站长把关

视觉关键词：

- 科技媒体
- 信息密度高
- 明确分类
- 研究感
- 不营销化
- 不堆砌大而空的口号

## 3. 首页设计

首页首屏直接呈现今日内容，而不是宣传型Hero。

### 3.1 顶部导航

包含：

- 品牌：ACP AI Research
- 一级频道：AI工具评测、AI新闻、AI资源、深度研究、个人资源
- 搜索入口
- 中英文切换
- Admin入口

### 3.2 今日情报区

展示当天最重要内容：

- 今日主推深度文章
- 今日AI新闻摘要
- 今日工具评测评分
- 今日资源数量
- 数据指标：草稿数、来源数、已发布数、平均可信度

### 3.3 内容分区

首页向下分为五块：

1. AI工具评测
2. AI新闻
3. AI资源分享
4. 深度研究
5. 个人资源分享

每块不做复杂解释，直接呈现内容卡片。

## 4. 主要页面

### 4.1 频道页

路径建议：

- `/zh/tools`、`/en/tools`
- `/zh/news`、`/en/news`
- `/zh/resources`、`/en/resources`
- `/zh/research`、`/en/research`
- `/zh/personal`、`/en/personal`

频道页能力：

- 分类筛选
- 标签筛选
- 时间筛选
- 热度/评分排序
- 搜索
- 分页

### 4.2 文章页

路径示例：

- `/zh/research/ai-agent-runtime-landscape`
- `/en/research/ai-agent-runtime-landscape`

文章页结构：

- 标题
- 摘要
- 发布时间
- 来源数量
- 可信度/热度指标
- 正文
- 来源列表
- 相关文章
- AI辅助生成声明
- 对应语言版本链接

### 4.3 APP页面

路径：`/app`

要求：

- 保留原有APP宣传内容
- 从个人资源分享板块进入
- 后续可以把APP作为个人项目之一展示

### 4.4 Admin后台

路径建议：`/admin`

MVP功能：

- 密码登录
- 查看AI生成草稿
- 按频道、语言、状态筛选
- 查看中英文文章对
- 编辑标题、摘要、正文、标签
- 查看来源和生成日志
- 批准并立即发布
- 拒绝
- 归档
- 管理个人资源

## 5. 双语设计

采用语言前缀路由：

- 中文：`/zh`
- 英文：`/en`

内容生成不建议“中文写完后直接翻译英文”。推荐流程：

1. 抽取来源事实
2. 生成结构化事实包
3. 分别生成中文稿和英文稿
4. 绑定到同一个 `content_group`
5. 在后台成对审核

这样可以保证英文不是低质量附属版本。

## 6. 内容生成与审核流程

### 6.1 自动任务

建议每天运行一次主任务，必要时可增加午间快讯任务。

主任务流程：

1. 拉取候选来源
2. 去重
3. 热度评分
4. 频道分类
5. 来源质量评分
6. 抽取事实
7. 生成中英文草稿
8. 自动质量检查
9. 写入D1数据库
10. 后台等待站长审核

### 6.2 批准即发布

站长在后台点击“批准”后：

- `content_group.status` 改为 `published`
- 中英文文章同时可见
- 自动刷新sitemap/RSS或触发增量更新
- 记录发布时间和审核人

## 7. Cloudflare D1 设计

### 7.1 推荐表结构

核心表：

- `content_groups`
- `articles`
- `sources`
- `generation_jobs`
- `personal_resources`
- `admin_events`

### 7.2 content_groups

用于绑定同一主题的中英文内容。

字段建议：

- `id`
- `canonical_slug`
- `category`
- `status`
- `heat_score`
- `source_quality_score`
- `created_at`
- `updated_at`
- `published_at`

### 7.3 articles

用于存储具体语言版本。

字段建议：

- `id`
- `content_group_id`
- `language`
- `title`
- `slug`
- `summary`
- `content_markdown`
- `tags_json`
- `reading_time`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

### 7.4 sources

用于文章溯源。

字段建议：

- `id`
- `content_group_id`
- `url`
- `title`
- `publisher`
- `published_at`
- `retrieved_at`
- `source_type`
- `reliability_score`

### 7.5 D1自动配置

后续实现时需要提供：

- `wrangler.toml`
- D1数据库绑定，例如 `DB`
- `migrations/0001_init.sql`
- 初始化脚本
- 本地开发命令
- Cloudflare Pages绑定说明

注意：Cloudflare token只放在本机环境变量或Cloudflare后台，不写入仓库。

## 8. AI Provider 设计

MVP不要把模型供应商写死，建议抽象接口：

- `generateFactsFromSources`
- `generateArticleDraft`
- `translateOrRegenerateLocalizedArticle`
- `qualityCheckDraft`
- `generateSeoMetadata`

候选Provider：

- Google Gemini / Vertex AI
- OpenAI
- Anthropic Claude
- OpenRouter

Google Cloud相关说明：

- 不建议在聊天中直接发送Google账号密码。
- 如需配置，可后续通过浏览器或本机登录流程操作。
- API key、服务账号、OAuth凭据都必须走环境变量或Cloudflare Secrets。

## 9. 原型说明

本轮原型先做首页静态版本，用于确认：

- 品牌气质
- 首页信息密度
- 双语切换方向
- 五大板块布局
- 个人资源中保留APP入口
- 科技媒体风格

原型不代表最终技术栈，只用于产品视觉和信息架构确认。
