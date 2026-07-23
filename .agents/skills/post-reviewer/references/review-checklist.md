# Required Review Checklist

在检查阶段对每篇选中的文章执行所有章节。以仓库当前 schema、plugins、scripts 与既有约定为准。在用户审阅修复建议集并回复之前，不得编辑。

## 1. Standard Markdown

- 要求开头有格式正确的 YAML frontmatter 块，文件末尾有换行。
- 检查 ATX heading 语法、无不明层级跳跃的标题层级、标题唯一性与编号一致性。注意 page template 可能已将 frontmatter `title` 渲染为 page H1。
- 检查 headings、lists、block quotes、tables 与 fenced code 周围会影响 Markdown 解析的空行。
- 检查列表缩进、在有意义时保持 ordered list 连续、task list 语法，以及文章内部标记与空格风格一致。
- 确保 backtick 与 tilde fences 成对。已知时使用有效的 language identifier，并保留 Expressive Code metadata。
- 检查强调、转义、嵌套分隔符、inline code、block quotes、tables 与 link/image 语法是否意外损坏。
- 标记 trailing whitespace、正文中的 tab、non-breaking spaces、重复空行、merge markers 与意外 raw HTML。
- 保留有意使用的双空格 hard break，除非显然应改为普通段落分隔。

## 2. Canonical Article Structure

将以下从 `src/content/posts/domain-driven-design.md` 提取的结构视为仓库规范文章格式。即使 Markdown 仍可成功渲染，也要报告偏差。

### 2.1. Opening Classical Epigraph

- 在 frontmatter 结束分隔符之后、第一章之前，紧接一则与主题相关的中国古典引文。不要为它添加 heading。
- 使用同一个 block quote 容纳引文与出处，并在二者之间放一个空白引用行：

  ```markdown
  > 名无固宜，约之以命
  >
  > ——《荀子·正名》
  ```

- 将出处写为 `——《典籍·篇名》`；使用一对 em dash，前后不加空格。核实引文文字与出处。不得虚构或静默替换引文或出处。
- 已核实引文周围的 markup 损坏时，将其归为 **Definite repairs（确定性修复）**。引文缺失、文字不确定、出处不确定或建议替换时，将其归为 **Needs user review（需用户复核）**。

### 2.2. Chapter Organization

- 不要在正文中添加 H1；page template 会把 frontmatter `title` 渲染为 page H1。
- 以 `## 01. 标题` 形式的编号 H2 开始正文。允许 `01.` 后使用任何有意义的标题，不要求固定为 `引言`。后续 H2 章节使用两位阿拉伯数字，并按同一 `## NN. 标题` 格式连续编号。
- 使用 `### N.M. 标题` 形式的 H3 headings 组织子节。父章节编号使用不带前导零的整数值；每个父章节中的 `M` 从 `1` 重新开始并保持连续。
- 正文层级主要使用 H2 与 H3。仅在内容确实需要时引入更深层级，并将偏离项标记为需用户复核。
- 将最后一个无编号 H2 heading `## 引用` 保留给来源条目。它不计入章节编号，之后不得再放其他章节。
- 只有在保留现有标题文本且 anchors 未被外部依赖时，才将纯编号修复归为确定性修复。其他标题重命名、插入、删除或重新编号应归为需用户复核，因为生成的 anchors 可能改变。

### 2.3. Reference Entries

- 当文章使用书籍、文章、文档或其他外部材料时，以 `## 引用` 结束文章，并按稳定且有意义的顺序为每个来源添加一个 ordered list 条目。
- 每个 ordered list marker 后使用两个空格，格式为 `1.  条目`，并从 `1` 开始连续编号。
- 书籍使用 `《书名》（作者 著，出版社）` 格式。多个作者以 `、` 连接，作者列表后保留 `著`，末尾不加标点。
- 非书籍来源保留在同一个 ordered list 中，并提供足以定位来源的信息。不得为非书籍来源虚构书籍格式字段。
- 每个条目必须在一行内自包含。来源身份明确时，将空格、编号与标点规范化归为确定性修复；作者、标题、出版社、URL 或来源身份缺失或不确定时，归为需用户复核。

## 3. Astro and Repository Conventions

- 读取 `src/content/config.ts`，按当前 posts collection schema 验证字段。
- 将 schema 与 `README.md`、文章生成器和验证脚本对照。字段可能在 schema 中可选，但被仓库发布策略要求必填。
- 检查 YAML 类型、duplicate keys、引号、ISO 日期、booleans、arrays 与 unknown keys。确保 `published` 和 `updated` 的时间关系合理；没有证据时不得改动日期。
- 按 `README.md` 的说明，从所选文章路径派生 slug：对于 `src/content/posts/<slug>.md`，检查 `<slug>` 文件名 stem。
- 要求 slug 使用 lowercase ASCII kebab-case。将产品名、acronyms 与技术术语转换为 URL-safe words 时，保留官方拼写与惯用形式。
- 将英文 slug 与 frontmatter `title`、`description` 和文章中心主题比较。检查英文语法、词语选择、单复数、词性、介词与自然语序。
- 优先采用简洁、地道且保留中文标题区分性含义的英文表达。不要求逐字翻译，但要标记误译、生硬的机器翻译、歧义、遗漏核心概念与无依据的过度具体化。
- 每个 slug 修正建议都归为需用户复核，因为文件名决定发布 route。展示当前 slug 与拟议 slug、理由及 URL/link 影响；不得将重命名归为确定性修复。
- 检查 `draft` 状态、language tag、category、tags、description 与 cover image 的内部一致性。
- 保持 `description` 有用、语法正确、未截断，并能代表文章内容。避免复制导航文字或正文的任意片段。
- 保留仓库支持的扩展：math、directives、GitHub-style admonitions、custom components 与 Expressive Code annotations。
- 运行 Astro/content/build checks，不得仅凭目视检查假定解析有效。

## 4. Chinese Copy Editing and Mixed-Language Spacing

- 修正明确的错别字、词语重复或缺失、病句、助词误用、标点问题，以及主谓或修饰关系歧义。
- 在正文中的中文与相邻拉丁文字、acronyms 或阿拉伯数字之间添加一个半角空格，例如 `使用 Java 编写` 与 `MySQL 8.0 引入`。
- 不要在产品名、identifiers、versions、URLs、paths、commands、code 或被引用的 literal output 内添加空格。
- 中文句子优先使用中文全角标点，英文句子使用英文标点。删除中文标点前的多余空格。
- 检查成对标点与引号，特别是 `（）`、`“”`、`「」`、backticks，以及包含英文术语的圆括号。
- 保留作者语体。修正语法，但不要把文章改成泛化的营销文案。

## 5. Consistency

- 在所选文章内统一同一技术的大小写与拼写，例如 `GitHub`、`Java`、`JavaScript`、`MySQL`、`RabbitMQ` 与 `Nginx`，同时遵循官方品牌写法。
- 同一概念使用同一术语，除非有意引入同义词。检查翻译、abbreviations、单复数，以及 acronym 首次出现时的展开。
- 保持标题编号、列表标点、code-fence labels、引用列表风格、emphasis 与图片说明风格内部一致。
- 仅为发现约定而比较相邻文章的 frontmatter 措辞与格式。不得在所选 scope 外批量规范化。

## 6. Links and Media

- 验证 Markdown links、autolinks、HTML `href`/`src`、reference definitions、frontmatter 图片，以及 custom syntax 使用的图片来源。
- 以 `public/` 为基准解析 root-relative media。按文章位置与仓库规则解析 source-relative imports 与 media。拒绝逃逸仓库的路径。
- 检查路径是否存在前先解码 percent-encoded paths；检查本地文件时忽略 query strings/fragments。
- 可行时，根据生成的 heading IDs 验证 same-page fragments。对内部 routes 与生成页面使用 build/site check。
- 对外部链接，遵循 `SKILL.md` 中的状态规则。记录最终落到无关页面、parked domain、login wall 或通用首页的 redirects。
- 除非图片有意作为装饰，否则要求有意义的 image alt text。检查图片说明、captions、dimensions 与 formats 是否合理。
- 不要将正文或 code 中的 `http://<your_ip>:8080` 等 example URLs 归类为失效的 production links。

## 7. Technical and Editorial Safety

- 检查明显的事实自相矛盾、过时的 cross-references、重复 headings/paragraphs、未定义 abbreviations，以及文中从未引用的 references。
- 检查 code block language labels 与可见语法，但没有足够上下文和授权时，不得重构或“修复”可运行代码。
- 保留警告、限制、出处、引文与 license-sensitive text。
- 若发现 secrets、tokens、private hosts、personal data 或 unsafe commands，进行标记；报告中不得重复敏感值。
- 区分明确错误、可能改进与主观建议。用户回复后，仅应用获批的确定性修复与选中的需判断改动。
