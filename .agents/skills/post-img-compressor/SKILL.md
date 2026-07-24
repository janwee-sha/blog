---
name: post-img-compressor
description: 将此 Astro/Fuwari 博客 public/uploads/ 下的静态 PNG、JPEG 或 WebP 图片以 WebP quality 90 压缩，保持像素尺寸与文件名主体，在格式变为 .webp 时更新 src/content 等仓库文本中的引用并移除被替换的旧格式文件。当用户要求 compress/压缩、optimize/优化、convert to WebP/转 WebP、减小博客或文章图片资源体积，或批量处理 public/uploads 图片时使用。
---

# Post Image Compressor

将本站博客图片统一压缩为 WebP quality 90。使用内置脚本完成确定性转码；不要调用图像生成模型。

## Scope

- 只处理仓库 `public/uploads/` 下的静态 `.png`、`.jpg`、`.jpeg` 与 `.webp` 文件。
- 保持原像素尺寸和文件名主体：`foo.png` 转为同目录的 `foo.webp`。
- 保留透明通道；自动应用 JPEG 等格式的 EXIF 方向。
- 拒绝 SVG、GIF、APNG、动画 WebP 及目录输入。不要把矢量图或动画静默转为静态 WebP。
- 不调整固定的 quality 90。若用户需要其他质量、尺寸或格式，说明该请求超出本技能的固定压缩策略。

## Workflow

1. 使用 `git rev-parse --show-toplevel` 确认仓库根目录，读取适用的 `AGENTS.md`、`README.md` 与初始 `git status --short`。保留无关改动，不自动暂存文件。
2. 将用户指定的图片解析为明确文件列表。范围含糊时先询问；不得把单图请求扩展为全部 `public/uploads/`。
3. 检查每个输入文件和目标 `<原文件名主体>.webp`。若目标已存在且不是输入文件本身，停止并确认，不得静默覆盖。
4. 用 `view_image` 查看输入，并记录尺寸与字节数。对多图任务逐一验证输入，不根据文件扩展名假定内容有效。
5. 从仓库根目录先预检映射：

   ```bash
   node <skill-dir>/scripts/compress-images.mjs --root <repo-root> --dry-run <image> [...]
   ```

6. 确认映射无冲突后执行压缩：

   ```bash
   node <skill-dir>/scripts/compress-images.mjs --root <repo-root> <image> [...]
   ```

   仅在用户明确要求覆盖已有同名 `.webp` 时添加 `--force`。
   脚本默认跳过体积未减小的结果；只有用户明确优先统一格式而非减小体积时才添加 `--allow-larger`。
7. 检查脚本输出。确保每个结果都是 WebP、尺寸符合源图的显示方向、文件可解码且体积非零。用 `view_image` 检查文字、细线、渐变、透明边缘与色彩；发现明显伪影时停止并报告，不要自行改变质量参数。
8. 对扩展名发生变化的结果，使用 `rg -n --fixed-strings` 搜索脚本返回的 `sourceUrl` 以及旧文件名。用最小 `apply_patch` 将文章、frontmatter、配置或其他仓库文本中的实际引用改为 `outputUrl`，并保留原有 query/hash。
9. 重新搜索旧 URL。只有在输出验证通过、引用已更新且旧 URL 不再被使用后，才删除被替换的旧格式文件。若结果状态为 `skipped-not-smaller`，报告候选体积，保留源文件且不要改引用。
10. 运行：

    ```bash
    pnpm content:verify
    ```

    引用发生变化时再运行：

    ```bash
    pnpm build
    ```

    最后检查 `git diff --check`、`git diff` 与 `git status --short`，确保没有改动任务范围外的文件。

## Preview Requests

若用户只要求“看看效果”“比较版本”或其他预览：

- 生成独立 `.webp` 文件并完成视觉验证；
- 保留原文件；
- 不修改引用；
- 不删除任何候选版本，除非用户随后明确选择。

## Final Handoff

报告每个源文件与输出文件的仓库相对路径、尺寸、压缩前后字节数及节省比例。说明更新了哪些引用、是否删除旧格式文件、执行了哪些验证。若存在输出冲突、体积变大、明显伪影或无法确认的引用，准确说明并停止在安全状态。
