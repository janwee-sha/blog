# WordPress 到 Fuwari/Astro 迁移计划

更新时间：2026-07-20

> 本文档记录已经完成的 WordPress 内容迁移与 `static.janwee.blog` 验收过程。当前主域切换、迁移工具清理和源站下线工作以 [MIGRATE_TO_JANWEE_BLOG.md](./MIGRATE_TO_JANWEE_BLOG.md) 为准。

## 当前实施记录

- Fuwari 上游已固定为提交 `6d39b0dec41282e7852e23e032998a5789abee28`。
- 只读导出已确认 17 篇公开文章、2 个公开页面和 55 个公开附件。
- 转换结果为 17 篇文章、About 页面、14 个实际使用媒体文件及 18 条 URL 兼容规则。
- Privacy、全部非公开内容、评论、用户私密资料以及 private 附件均未导入。
- 公开作者头像采用附件 8539 的 `my_avatar-300x300.jpg` 衍生图；站点图标采用附件 9002。
- 本地迁移测试、内容清单验证、Astro 检查、TypeScript 检查和生产构建均纳入验收命令。
- 桌面端、移动端、About 页面及复杂文章的视觉核对已通过；中文字体随站点打包，Mermaid 按需在浏览器端渲染。
- 可构建主题基线提交 `5631df9` 已推送到 GitHub `main`；完整迁移内容保留为第二个本地提交，将作为 Cloudflare Pages Git 自动构建的触发验证。
- 用户从 Cloudflare 控制台安装并只授权 `janwee-sha/blog` 后，Git 集成项目 `janwee-blog` 已成功创建；生产分支为 `main`，生产与预览分支自动部署均已启用。
- 完整迁移提交 `a5ee4a8` 已由 `github:push` 自动构建并成功发布到 `janwee-blog.pages.dev`；首次冒烟测试发现缺少顶层 `404.html` 会使未知路径回退为 200。修正提交 `176ad47` 已再次通过 GitHub push 自动发布；线上首页、About、文章、RSS、站点地图、301 重定向和 404 响应均已复验通过。
- 非生产分支已成功触发 Cloudflare Preview 部署并完成访问验证，临时测试分支随后已删除。用户已在 Cloudflare 确认创建 `static` → `janwee-blog.pages.dev`；权威与公共 DNS、严格 HTTPS、关键页面、301、404、canonical、RSS、站点地图和静态资源缓存均已通过。Pages 自定义域总状态、HTTP 证书验证和域名所有权验证现均为 `active`。
- canonical 修正提交 `40cd38d` 及格式修正提交 `a1a4bf9` 均已由 GitHub push 自动完成生产构建；最终提交对应的 GitHub “Build and Check”与“Code quality”工作流全部通过。
- 原 `janwee.blog` 公网仍返回 200，WordPress 与 MySQL 容器持续运行，本轮操作未修改主域 DNS 或服务。

## 1. 目标与边界

将当前 WordPress 博客迁移为基于 [Fuwari](https://github.com/saicaca/fuwari) 的 Astro 静态站点，并建立以下发布链路：

```text
本地撰写 Markdown
  -> 推送到 GitHub: janwee-sha/blog
  -> Cloudflare Pages 自动构建
  -> 发布到 https://static.janwee.blog
```

迁移验收阶段使用 `static.janwee.blog`。现有 `janwee.blog` WordPress 站点继续运行，不在本轮迁移中切换、重定向或下线。将来是否把主域名切换到静态站点，必须在内容、URL、SEO 和发布流程验收完成后另行决定。

## 2. 已知环境与技术选择

| 项目 | 选择或状态 |
| --- | --- |
| WordPress 源站 | `https://janwee.blog`，本机数据位于本工作区 |
| Astro 主题 | `https://github.com/saicaca/fuwari` |
| 本地目标目录 | `/root/wordpress/blog` |
| GitHub 目标仓库 | `git@github.com:janwee-sha/blog.git` |
| 生产分支 | `main` |
| 托管平台 | Cloudflare Pages |
| 迁移验收域名 | `https://static.janwee.blog` |
| 包管理器 | 跟随 Fuwari 的 `pnpm-lock.yaml` 和 `packageManager` 声明 |
| Node.js | 20 或更高版本；Cloudflare 构建环境优先固定为 Node.js 22 |
| 构建命令 | `pnpm build` |
| 构建输出目录 | `dist` |
| 发布方式 | Cloudflare Pages Git 集成；不使用 Direct Upload 创建生产项目 |
| 文章路径 | 保留 Fuwari 默认的 `/posts/<slug>/`，并在静态站提供旧根路径的 301 兼容跳转 |
| 内容许可 | 不启用 Fuwari 默认 CC BY-NC-SA 卡片；站点页脚保留 All Rights Reserved |
| 隐私页面 | 本轮不发布 WordPress Privacy 页面，也不加入导航 |

选择 Git 集成是为了让 `main` 分支的每次更新自动触发生产构建，并让其他分支或 Pull Request 获得预览部署。Cloudflare 的 Git 集成项目与 Direct Upload 项目不能直接互相切换，因此生产项目一开始就应通过 GitHub 集成创建。

## 3. 数据安全规则

1. 把 `wpdata/`、`wpmysql/` 和运行中的 WordPress 数据库视为只读迁移源。
2. 不提交 `db_password.txt`、`wp-config.php`、数据库文件、备份包、缓存、日志、OAuth 凭据或其他秘密。
3. 默认只公开迁移已发布的文章和页面；草稿、私密、密码保护、回收站内容及用户数据不得进入目标仓库。
4. 所有迁移转换应由可重复运行的脚本完成，避免只能手工复现的内容修改。
5. 在推送前扫描仓库中的凭据、私密内容、大文件和不必要的 WordPress 备份。

## 4. 分阶段实施

### 阶段 A：盘点并冻结迁移基线

- 记录 WordPress 版本、站点标题、作者资料、时区、固定链接结构和启用的内容相关插件。
- 统计已发布文章、页面、分类、标签和媒体文件的数量。
- 导出文章元数据和正文，并保留一份仅用于迁移核对的本地清单。
- 识别 Gutenberg 区块、Elementor 内容、短代码、Mermaid、代码块、嵌入内容、图库、附件页和站内链接。
- 记录 WordPress 中需要静态替代方案的功能，例如评论、搜索、表单、登录和动态小工具。

完成标准：得到可核对的源内容清单，且未修改源站。

### 阶段 B：建立目标仓库

- 将 Fuwari 克隆到 `/root/wordpress/blog`。
- 将主题原仓库保留为 `upstream`，将 `git@github.com:janwee-sha/blog.git` 设置为 `origin`。
- 检查上游许可证、当前 Node.js/pnpm 要求、内容 schema、示例文章和构建脚本。
- 安装锁定版本依赖，依次运行 `pnpm check` 和 `pnpm build`，确认未修改的基线可以构建。
- 建立忽略规则，确保 WordPress 数据和秘密不会进入目标仓库。

完成标准：Fuwari 基线在本地构建成功，Git 远端指向正确且没有秘密文件。

### 阶段 C：替换主题作者资源和站点配置

- 在 `src/config.ts` 及相关配置中替换站点名、作者名、简介、头像、横幅、社交链接和导航。
- 使用 WordPress 中现有且确属本站的图片、图标和品牌资源，移除上游示例作者的资源与示例文章。
- 将 Astro `site`/canonical 基址设为 `https://static.janwee.blog`，路径基址为 `/`。
- 核对语言、时区、日期显示、RSS、站点地图、Open Graph 图片和 favicon。
- 保留 Fuwari 的许可证要求，并在需要时注明主题来源。
- 使用 About 页面公开照片的 300px 衍生图作为作者头像，并使用咖啡杯 Logo；不导入数据库标记为 private 的旧头像附件，不启用横幅，社交链接仅配置 `janwee-sha` GitHub 主页。
- 关闭 Fuwari 的文章 CC 许可卡片；保留 MIT 许可证、Astro/Fuwari 来源和站点 All Rights Reserved 声明。

完成标准：站点不再展示上游作者身份，所有生成的正式 URL 都指向 `static.janwee.blog`。

### 阶段 D：迁移内容和媒体

- 编写迁移脚本，把 WordPress 文章转换为 Fuwari 当前内容 schema 所需的 Markdown/MDX 和 frontmatter。
- 优先保留原始 slug、标题、发布日期、更新日期、摘要、分类、标签、封面图和语言。
- 将正文中的 WordPress HTML、区块注释和短代码转换为兼容 Markdown/MDX；对无法无损转换的内容生成报告并人工复核。
- 将所需媒体复制到目标仓库。批量历史媒体优先使用可保持稳定路径的 `public/uploads/YYYY/MM/...`，并把正文中的 WordPress 绝对地址改为站内地址。
- 检查重名文件、非 ASCII 文件名、带空格路径、缺失附件、超大图片和无效 MIME 类型。
- 重写内部文章链接，同时保留一份旧 URL 到新 URL 的映射，为以后切换 `janwee.blog` 时配置重定向做准备。
- 单独迁移 About 等必要页面。评论默认不导入为公开静态内容，除非用户另行指定评论系统或归档方案。
- 当前基线为 17 篇已发布公开文章和 2 个公开页面；只迁移 17 篇文章与 About，Privacy 按用户决定暂不发布。
- 19 个公开文章/页面均使用 Elementor 数据；转换器必须按节点顺序处理已发现组件，并在出现未知组件时失败而不是静默丢弃。
- 将两个 `[mermaid]` 短代码转换为 Mermaid 代码块并提供前端渲染支持。
- 文章继续使用 `/posts/<slug>/`；同时生成 `/<slug>/ -> /posts/<slug>/` 和 `/about-me/ -> /about/` 的静态站兼容重定向。

完成标准：公开内容数量与迁移清单一致，文章可构建，媒体和站内链接可访问，私密内容未进入仓库。

### 阶段 E：本地质量验收

- 运行 `pnpm check`、`pnpm build` 和本地预览。
- 验证首页、列表、分页、分类、标签、文章、独立页面、RSS、站点地图、搜索、404、暗色模式和移动端布局。
- 自动检查断链、缺图、重复 slug、错误 canonical、混合内容和指向本机或 WordPress 后台的链接。
- 对复杂文章、最早和最新文章、含代码/表格/数学公式/Mermaid/嵌入内容的文章进行抽样视觉核对。
- 比对文章、页面、分类、标签和媒体清单，生成尚未解决的差异报告。

完成标准：生产构建无错误，核心页面无明显视觉或内容缺失，差异均已解决或得到明确接受。

### 阶段 F：推送 GitHub

- 确认 `janwee-sha/blog` 为空仓库或其现有内容可以安全合并。
- 提交主题定制、迁移脚本、迁移后的内容和维护文档。
- 推送 `main` 到 `git@github.com:janwee-sha/blog.git`；未经明确授权不强制推送或改写远端历史。
- 在 GitHub 上复核仓库文件，确认没有秘密、数据库、备份或非预期的大文件。
- 首次先推送完成定制但尚未加入迁移内容的可构建基线，以便建立 Pages Git 集成；随后推送迁移内容提交，用第二次构建验证发布触发链路。

完成标准：`main` 可从干净环境安装依赖并构建相同的 `dist` 输出。

### 阶段 G：配置 Cloudflare Pages 和临时域名

- 在 Cloudflare Pages 中通过 Git 集成连接 GitHub，并只授权所需的 `janwee-sha/blog` 仓库。
- 创建 Pages 项目，生产分支设为 `main`，构建命令设为 `pnpm build`，输出目录设为 `dist`。
- 按克隆后项目的 `packageManager` 字段固定 pnpm 版本，并将构建环境固定为 Node.js 22。
- 首次构建先使用 Cloudflare 分配的 `*.pages.dev` 地址完成冒烟测试。
- 在 Pages 项目的 Custom domains 中添加 `static.janwee.blog`。由于 `janwee.blog` 已由 Cloudflare 管理，应让 Pages 在确认域名后创建或管理对应 DNS 记录；若已经存在同名记录，先核对用途，不直接覆盖。
- 验证 DNS、TLS 证书、HTTPS、canonical、RSS、站点地图和静态资源缓存。
- Pages 项目名优先使用 `janwee-blog`，若已占用则使用 `janwee-sha-blog`。
- GitHub App 仓库授权需要在 Cloudflare 控制台中确认；Wrangler OAuth 不替代 GitHub Git 集成，也不得先用 Wrangler 建立 Direct Upload 项目。

完成标准：`https://static.janwee.blog` 正常访问，且 `janwee.blog` 的现有 WordPress 服务不受影响。

### 阶段 H：打通日常发文流程

推荐流程：

```bash
cd /root/wordpress/blog
git switch -c post/<slug>
pnpm new-post <slug>
# 编辑 src/content/posts/ 下的 Markdown 和图片
pnpm check
pnpm build
git add <相关文件>
git commit -m "post: <文章标题>"
git push -u origin post/<slug>
```

- GitHub Pull Request 触发 Cloudflare 预览部署，用预览 URL 校对文章。
- 合并到 `main` 后触发生产构建并发布到 `static.janwee.blog`。
- 对简单发布也可以直接推送 `main`，但仍须先在本地通过检查和构建。
- 在 README 中补充日常发文、草稿、图片组织、预览、回滚和故障排查说明。

完成标准：新增一篇测试文章并推送后，Cloudflare 自动构建成功；文章可从生产域名访问，回滚流程经过验证。

## 5. 验收清单

- [x] WordPress 源站在整个迁移期间保持可用且未被修改。
- [x] 已发布文章和必要页面的数量与源清单一致。
- [x] 标题、时间、slug、分类、标签、封面和正文转换正确。
- [x] 图片、附件、内部链接、RSS、站点地图、搜索和 404 正常。
- [x] 仓库不含凭据、数据库、备份、私密内容和无关缓存。
- [x] `pnpm check` 与 `pnpm build` 成功。
- [x] GitHub `main` 分支是 Cloudflare Pages 的生产源。
- [x] Pull Request/非生产分支可获得预览部署。
- [x] `https://static.janwee.blog` 的 DNS、TLS 和页面访问正常。
- [x] 向 GitHub 推送新文章可以自动触发生产发布。
- [x] `https://janwee.blog` 仍指向原 WordPress 站点。

## 6. 暂不执行的事项

- 不把 `janwee.blog` 主域名切换到 Cloudflare Pages。
- 不关闭或删除 WordPress、MySQL、上传目录或备份。
- 不自动公开评论、草稿、私密文章、用户资料或表单数据。
- 不在未核对 URL 映射和 SEO 影响前设置全站重定向。

## 7. 后续主域名切换条件

只有在静态站点稳定运行、内容差异清零、日常发文流程经过实际使用、旧 URL 重定向方案完成并保留可回滚备份后，才另行制定 `janwee.blog` 的切换计划。该动作不属于当前计划的授权范围。
