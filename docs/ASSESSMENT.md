# ACP AI Research 站 — 文章生成策略更新·评估报告

**日期**: 2026-07-05  
**改动范围**: 文章生成新鲜度窗口、前台列表排序、发布前校验  
**验证状态**: 全部通过

---

## 1. 改动概述

### 1.1 新鲜度窗口调整

| 规则 | 旧值 | 新值 |
|---|---|---|
| AI 新闻（`news`）来源允许范围 | 3 个月 | **7 天** |
| 其它生成分类（`tools`/`resources`/`research`）来源允许范围 | 3 个月 | **1 个月** |
| `personal` 板块 | 不参与自动生成，规则不变 | — |

实施范围覆盖三条执行路径：
- Cloudflare Worker 线上生成（`src/lib/generation.ts`）：提示词、Prompt Rules、`getOldestAllowedSourceDate` / `normalizeRecentDate` / `getFreshnessWindow`
- 本地生成脚本（`scripts/local-generate.mjs`）：同上，保持与 Worker 端一致的规则
- 数据库查询（`src/lib/db.ts`）：前台列表只返回窗口内内容，发布前校验也按分类判断死线

### 1.2 列表排序修正

| 路径 | 旧行为 | 新行为 |
|---|---|---|
| 有 D1 数据库时 | `ORDER BY COALESCE(g.published_at, g.created_at) DESC, g.heat_score DESC` | 保持不变（已按日期倒序） |
| 无数据库（sample 模式） | `sort((a, b) => b.heatScore - a.heatScore)` | `compareArticlesByDateDesc`：按 `publishedAt` 降序，同日期以热度兜底 |

所有前台文章列表（首页、分类页）现在统一按发布时间从新到旧排列。

### 1.3 发布前校验强化

- 旧逻辑：`published_at < date('now', '-3 months')` 即拒绝
- 新逻辑：根据 `content_groups.category` 动态计算死线 — `news` 7 天，其余 1 个月
- 同时对无日期来源和数量不足也保持原有拦截

---

## 2. 修改文件清单

| 文件 | 改动摘要 |
|---|---|
| `src/lib/generation.ts` | 加入 `getFreshnessWindow`；`getOldestAllowedSourceDate` 改签名为按分类计算；`normalizeRecentDate` / `normalizeSource` 传分类；Prompt Rules 补充窗口描述 |
| `scripts/local-generate.mjs` | 同步上述新鲜度函数与 Prompt 规则 |
| `src/lib/db.ts` | 发布校验 SQL 改为分类感知；前台列表查询加入三重过滤（内容窗口 + 来源数量 + 来源新鲜度）；sample 模式改用日期降序排序并新增 `isSampleArticleFresh` 过滤 |
| `scripts/verify-freshness.mjs` | **新增**——8 项回归检查脚本，后续可随时运行 |

---

## 3. 测试与验证

| 测试类型 | 工具 | 结果 |
|---|---|---|
| 新鲜度规则回归检查 | `node scripts/verify-freshness.mjs` | **8/8 PASS** |
| Astro 类型与模板检查 | `npx astro check` | **0 errors, 0 warnings**（123 文件） |
| 完整生产构建 | `npm run build`（含 `astro check` + `astro build`） | **Complete!**（server built in 2.90s） |

### 验证覆盖的关键点

1. Worker / 本地两条生成路径均使用 7 天（news）/ 1 个月（非 news）
2. 生成 Prompt 中包含了 `this category requires sources from within X` 的显式窗口提示
3. 发布校验 SQL 按分类动态判断死线
4. 前台列表同时过滤内容发布时间超窗口、来源数量不足、来源日期陈旧
5. 列表排序统一为 `published_at / created_at` 降序
6. 旧 3 个月硬编码已从三个活跃源文件中移除

---

## 4. 风险与注意事项

- **D1 SQLite `date('now', '-X days')` 依赖 UTC**：因为 Cloudflare Workers 运行在 UTC 时区，7 天/1 个月的死线可能和本地感知相差几小时。`src/lib/db.ts` 的 `getOldestAllowedDate` 函数已统一用 UTC，与 SQL 端行为一致。
- **sample 模式验证受限于示例数据日期**：`sample-data.ts` 中所有内容统一使用 `2026-07-01` 的固定日期。当前日期已过 7 月 1 日，news 类别的 sample 内容会因超 7 天被过滤，导致首页 news 区域在无数据库模式下可能空白。这是预期行为——真实 D1 数据库中只要存在合规内容就会正常显示。
- **旧历史文章不再展示**：部署后，已发布超过 1 个月的旧文章将不会出现在前台列表。如果未来需要历史归档页面，可以额外添加不受窗口限制的“归档”查询路径。

---

## 5. 建议后续动作

- 提交代码变更
- 运行一次 `npm run generate:local -- --dry-run` 验证 Vertex AI 生成的来源日期是否落在窗口内
- 在 Cloudflare 部署后观察 `/admin` 和首页的实际数据表现
- 如需要历史文章仍可查阅，考虑新增 `/zh/archive` 归档页面（不应用窗口过滤）

---

*报告由自动化测试脚本 `scripts/verify-freshness.mjs` 和 `npm run build` 结果驱动生成。*
