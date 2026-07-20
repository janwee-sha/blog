# AI Agent 工作指引

本仓库是从本机 WordPress 迁移而来的 Fuwari/Astro 静态博客。

## 必读计划

执行内容迁移、主题修改、GitHub、Cloudflare 或 DNS 工作前，必须完整阅读并遵循 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)。实现状态或用户决策变化时，先更新计划再继续。

## 数据边界

- WordPress 只读源位于仓库父目录的 `../wpdata/`、`../wpmysql/` 和运行中的本机容器。
- `.migration/wordpress-export.json` 是本地临时快照，必须保持 Git 忽略。
- 默认只迁移已发布、无密码保护的公开文章以及明确允许的页面。
- Privacy、草稿、待审、私密内容、评论、邮箱、用户令牌和登录数据不得进入仓库。
- 数据库标记为 private 的附件不得导入；作者头像使用公开附件 8539 的 300px 衍生图。

## 安全约束

- 不提交 `db_password.txt`、`wp-config.php`、数据库、SQL、WPress 备份、OAuth 凭据、`.env`、日志或缓存。
- 不修改或删除 WordPress/MySQL 数据，不停止容器，不执行强制推送或破坏性 Git 操作。
- 不修改 `janwee.blog` 的 DNS、重定向或运行状态。
- `static.janwee.blog` 的 DNS 只通过 Cloudflare Pages Custom domains 管理；覆盖既有记录前必须再次确认。

## 实施与验证

- 使用 `pnpm wp:export` 只读导出，使用 `pnpm wp:migrate` 生成内容，禁止用不可复现的批量手工转换替代脚本。
- 未知 Elementor 组件、缺失媒体、数量差异必须使迁移失败并输出报告。
- 推送前至少运行 `pnpm test:migration`、`pnpm wp:verify`、`pnpm check`、`pnpm type-check` 和 `pnpm build`。
- 生产部署必须使用 Cloudflare Pages Git 集成，生产分支为 `main`，构建命令为 `pnpm build`，输出目录为 `dist`。
- 不得用 Wrangler Direct Upload 创建生产项目；先验证 `*.pages.dev`，再绑定 `static.janwee.blog`。
