# 静态博客迁移到 `janwee.blog` 计划

更新时间：2026-07-20

## 1. 目标

将 Cloudflare Pages 项目 `janwee-blog` 的生产域从 `https://static.janwee.blog` 切换为 `https://janwee.blog`，并保持以下发布链路：

```text
本地 Markdown -> GitHub main -> Cloudflare Pages -> https://janwee.blog
```

本计划接续 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)。原计划保留为 WordPress 内容迁移和 `static.janwee.blog` 验收的历史记录。

## 2. 已确认决策

- `janwee.blog` 使用裸域作为唯一 canonical 生产域。
- 不配置 `www.janwee.blog`。
- 主域验收通过后解除 `static.janwee.blog` 的 Pages 绑定并删除其 Pages 管理的 DNS 记录，不提供重定向。
- 仅将精确生产地址 `janwee-blog.pages.dev` 301 到 `janwee.blog`；分支 Preview 子域继续可访问。
- 完整删除 WordPress 导出、转换、迁移测试和迁移报告，改用不依赖 WordPress 的日常内容完整性检查。
- 主域验收通过后立即停止 WordPress/MySQL 容器，但保留 `wpdata/`、`wpmysql/`、Compose 配置和凭据文件。
- 不创建额外 WordPress 备份；接受只依赖现有数据目录回滚的风险。
- Nginx 仍承载其他本机域名，不得停止或删除其配置。

## 3. 仓库改造

1. 将 Astro `site`、RSS fallback、canonical/OG/Twitter URL 和构建产物检查基址统一为 `https://janwee.blog`。
2. 保留 `public/_redirects` 中旧 WordPress 路径到 `/posts/<slug>/` 及 `/about/` 的兼容 301。
3. 删除 WordPress 导出器、迁移转换器、迁移单测、迁移报告和 URL 映射，以及对应的 package scripts、README 和 CI 步骤。
4. 新增 `content:verify`，动态检查文章 frontmatter、重复 slug、本地媒体引用、Privacy 排除、私密旧头像目录及重定向规则，不依赖 WordPress 容器或固定迁移数量。
5. 构建产物检查按当前非草稿文章数量动态核对生成页面，不再硬编码 17 篇。
6. 更新 README、`AGENTS.md` 和原迁移计划，说明新的生产域、维护命令和回滚边界。

## 4. 切换顺序

1. 在独立分支完成仓库改造，并通过 Preview 检查生成页面的 canonical 已指向 `janwee.blog`。
2. 合并到 `main`，等待 GitHub Actions 和 Cloudflare Pages 生产构建成功；在修改 DNS 前用部署专属 `pages.dev` 地址复验。
3. 记录 `janwee.blog` 当前根域 DNS 的类型、目标、代理状态和 TTL；无法得到可恢复的原值时不得继续。
4. 在 Pages Custom domains 中添加 `janwee.blog`，确认替换根域记录，等待域名总状态、HTTP 验证和所有权验证全部变为 `active`。
5. 验证主域后，为精确主机 `janwee-blog.pages.dev` 创建保留路径和查询参数的 301；不得匹配 Preview 子域。
6. 从 Pages 移除 `static.janwee.blog` 并删除其 DNS 记录。
7. 完成最终验收后执行 `docker compose stop wordpress mysql`；保持 Nginx active。

## 5. 验收清单

- [x] 仓库不再包含 WordPress 运行时依赖、迁移工具、迁移测试或迁移报告。
- [x] Biome、`content:verify`、Astro check、TypeScript、build 和站点产物检查全部通过。
- [ ] GitHub `main` 与 Cloudflare 最新生产提交一致，GitHub Actions 全部通过。
- [ ] `janwee.blog` 的 Pages 域名、HTTP 验证和所有权验证均为 `active`。
- [ ] 首页、About、全部非草稿文章、搜索、媒体、RSS、robots、sitemap 和 404 正常。
- [ ] canonical、Open Graph 和 Twitter URL 均使用 `https://janwee.blog`。
- [ ] 旧 WordPress 路径逐条返回 301，目标页面返回 200。
- [ ] `janwee-blog.pages.dev` 精确生产域 301 到主域，Preview 子域不受影响。
- [ ] `static.janwee.blog` 已解除 Pages 绑定且不再解析。
- [ ] `www.janwee.blog` 未配置。
- [ ] WordPress/MySQL 已停止，Nginx 仍运行，现有 WordPress 数据目录未删除或修改。

## 6. 回滚

发生 Pages 域名无法激活、TLS 错误、核心页面不可用或旧 URL 重定向错误时，不停止 WordPress。若已停止，则先启动 MySQL 和 WordPress 并确认 `127.0.0.1:8088` 正常，再解除 `janwee.blog` 的 Pages 绑定并恢复预先记录的根域 DNS。
