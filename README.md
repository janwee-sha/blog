# Janwee 的博客

基于 [Astro](https://astro.build/) 与 [Fuwari](https://github.com/saicaca/fuwari) 的静态博客。

本仓库所基于的 Fuwari 项目说明见 [Fuwari README](docs/fuwari/README.md)。

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

需要在浏览器中核对构建结果时，再运行：
```bash
pnpm preview
````

## 个人信息配置

笔名、职业、头像、Bio、从业起始日期、关注领域和社交链接统一配置在
[`src/me.config.ts`](src/me.config.ts)。工作年限会根据 `careerStartedAt` 按完整周年自动计算，
并在构建时写入页面。

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

提交 Pull Request 后，Cloudflare Pages 会生成预览部署；合并到 `main` 后自动构建并发布到生产域名。

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

图片可放在 `public/uploads/` 并使用相对路径引用。

## Cloudflare Pages

生产项目通过 Git 集成连接本仓库：

- Framework preset：Astro
- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- `NODE_VERSION`：`22.22.1`
- `PNPM_VERSION`：`9.14.4`

## 许可证

主题代码保留 Fuwari 的 MIT 许可证和来源说明。博客文章及本站原创内容默认 All Rights Reserved，未启用 Fuwari 的 CC BY-NC-SA 文章许可卡片。
