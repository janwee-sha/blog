# Janwee's Blog

基于 [Astro](https://astro.build/) 与 [Fuwari](https://github.com/saicaca/fuwari) 的静态博客，内容从 `janwee.blog` WordPress 站点迁移而来。

- 生产域名：`https://static.janwee.blog`
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

生产校验：

```bash
pnpm test:migration
pnpm wp:verify
pnpm check
pnpm type-check
pnpm build
pnpm check:site
pnpm preview
```

## 发布新文章

```bash
git switch -c post/<slug>
pnpm new-post <slug>
# 编辑 src/content/posts/<slug>.md 并添加所需图片
pnpm check
pnpm type-check
pnpm build
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

## 重新执行 WordPress 迁移

迁移要求父目录中存在只读 WordPress 数据和名为 `wordpress` 的运行中容器：

```bash
pnpm wp:export
pnpm wp:migrate
pnpm wp:verify
```

导出快照写入被 Git 忽略的 `.migration/`。迁移脚本只导出公开白名单字段；遇到未知 Elementor 组件或缺失媒体会失败，不会静默丢弃内容。

完整边界和部署说明见 [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)，Agent 执行规则见 [AGENTS.md](./AGENTS.md)。

## Cloudflare Pages

通过 Git 集成连接本仓库，不要把生产项目创建为 Direct Upload：

- Framework preset：Astro
- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- `NODE_VERSION`：`22.22.1`
- `PNPM_VERSION`：`9.14.4`

首次部署先验证 `*.pages.dev`，再在 Pages 的 Custom domains 中添加 `static.janwee.blog`。

## 许可证

主题代码保留 Fuwari 的 MIT 许可证和来源说明。博客文章及本站原创内容默认 All Rights Reserved，未启用 Fuwari 的 CC BY-NC-SA 文章许可卡片。
