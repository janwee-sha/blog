# AI Agent 工作指引

本仓库是从本机 WordPress 迁移而来的 Fuwari/Astro 静态博客。

## 必读计划

执行内容、主题、GitHub、Cloudflare 或 DNS 工作前，必须完整阅读并遵循 [MIGRATE_TO_JANWEE_BLOG.md](./MIGRATE_TO_JANWEE_BLOG.md)。原 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) 仅作为已完成的 WordPress 内容迁移历史。实现状态或用户决策变化时，先更新当前计划再继续。

## 数据边界

- WordPress 数据位于仓库父目录的 `../wpdata/` 和 `../wpmysql/`，仅作为未提交 Git 的本机回滚数据保留。
- 日常内容校验不得依赖 WordPress 容器、数据库、导出快照或固定迁移数量。
- 只允许公开明确发布的文章和页面。
- Privacy、草稿、待审、私密内容、评论、邮箱、用户令牌和登录数据不得进入仓库。
- 数据库标记为 private 的附件不得导入；作者头像使用公开附件 8539 的 300px 衍生图。

## 安全约束

- 不提交 `db_password.txt`、`wp-config.php`、数据库、SQL、WPress 备份、OAuth 凭据、`.env`、日志或缓存。
- 不修改或删除 WordPress/MySQL 数据；只可在当前计划验收完成后停止两个容器，不执行强制推送或破坏性 Git 操作。
- `janwee.blog` 的 Pages 切换与 `static.janwee.blog` 的解除绑定已由当前计划授权；不得修改其他子域或停止 Nginx。
- 自定义域只通过 Cloudflare Pages Custom domains 和明确记录的 Redirect Rules/Bulk Redirect 管理；覆盖根域记录前必须记录回滚值。

## 实施与验证

- 使用不依赖 WordPress 的 `pnpm content:verify` 检查日常内容完整性。
- 推送前至少运行 Biome、`pnpm content:verify`、`pnpm check`、`pnpm type-check`、`pnpm build` 和 `pnpm check:site`。
- 生产部署必须使用 Cloudflare Pages Git 集成，生产分支为 `main`，构建命令为 `pnpm build`，输出目录为 `dist`。
- 不得用 Wrangler Direct Upload 创建生产项目；先验证部署专属 `*.pages.dev`，再绑定 `janwee.blog`。
