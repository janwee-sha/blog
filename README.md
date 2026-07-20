# Janwee's Blog

基于 [Astro](https://astro.build/) 与 [Fuwari](https://github.com/saicaca/fuwari) 的静态博客。历史内容从 WordPress 迁移而来，当前内容以仓库中的 Markdown 为唯一发布源。

- 生产域名：`https://janwee.blog`
- GitHub：`janwee-sha/blog`
- 生产分支：`main`
- 构建输出：`dist`

## 本地开发

需要 Node.js 22 和 pnpm 9.14.4：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

提交前执行完整校验：

```bash
pnpm content:verify
pnpm check
pnpm type-check
pnpm build
pnpm check:site
```

需要在浏览器中核对构建结果时，再运行 `pnpm preview`。

## 发布新文章

```bash
git switch -c post/<slug>
pnpm new-post <slug>
# 编辑 src/content/posts/<slug>.md 并添加所需图片
pnpm content:verify
pnpm check
pnpm type-check
pnpm build
pnpm check:site
git add <相关文件>
git commit -m "post: <文章标题>"
git push -u origin post/<slug>
```

提交 Pull Request 后，Cloudflare Pages 会生成预览部署；合并到 `main` 后自动构建并发布到生产域名。回滚优先使用 `git revert`，不要改写 `main` 历史。

文章 frontmatter 示例：

```yaml
---
title: "文章标题"
published: 2026-07-20
description: "文章摘要"
image: ""
tags: ["tag"]
category: "category"
draft: false
lang: "zh_CN"
---
```

图片可放在 `public/uploads/` 并使用 `/uploads/...` 引用，也可以与文章 Markdown 放在同一目录后使用相对路径引用。

## Cloudflare Pages

生产项目通过 Git 集成连接本仓库：

- Framework preset：Astro
- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- `NODE_VERSION`：`22.22.1`
- `PNPM_VERSION`：`9.14.4`
- Custom domain：`janwee.blog`

`janwee-blog.pages.dev` 仅作为平台生产域入口并 301 跳转到主域；分支 Preview 子域保持可访问。`static.janwee.blog` 是已完成验收的临时域，主域切换后不再绑定。

迁移历史见 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)，主域切换与源站下线步骤见 [MIGRATE_TO_JANWEE_BLOG.md](./MIGRATE_TO_JANWEE_BLOG.md)，Agent 执行规则见 [AGENTS.md](./AGENTS.md)。

## 许可证

主题代码保留 Fuwari 的 MIT 许可证和来源说明。博客文章及本站原创内容默认 All Rights Reserved，未启用 Fuwari 的 CC BY-NC-SA 文章许可卡片。
