---
title: "LangExtract 初探"
published: 2026-02-25
updated: 2026-07-21
description: "试用 Google 开源的 LangExtract：用自然语言和 few-shot 示例定义抽取规则，分别接入 Ollama 与 OpenAI 模型，把《西游记》片段转换为结构化数据，并生成可交互的原文标注页面。"
image: ""
tags: ["AI", "LangExtract"]
category: "AI"
draft: false
lang: "zh_CN"
---
> 操千曲而后晓声，观千剑而后识器
>
> ——《文心雕龙·知音》

## 01. LangExtract 在做什么

最近关注到 Google 开源的 LangExtract。[LangExtract 官网](https://github.com/google/langextract)对它的介绍为：“一个使用大语言模型从非结构化文本中提取结构化信息的 Python 库，具备精确的源定位和交互式可视化功能。”提取结构化信息是其核心功能，而其亮点则是能够提供精确的源定位，并完成交互式的可视化呈现。

如果你曾经接触过传统的 NER、关键词抽取或关系抽取，会比较容易理解 LangExtract 的价值。它的重点并不在于完成“识别人名、地名、组织名”这类固定任务，而在于允许开发者直接使用自然语言描述业务化的抽取目标。例如：

-   抽取人物；
-   抽取人物别名或称谓；
-   抽取人物行为；
-   为行为补充执行者、目标等上下文属性。

因此，LangExtract 更像是一个**面向业务场景的可编排信息抽取层**。它将抽取任务从传统的规则工程、模型训练或标签体系设计中抽离出来，转化为“定义抽取目标、提供示例、调用模型”的流程。

如果只是让模型返回一段 JSON，直接调用模型 API 也能做到。LangExtract 真正有用的地方，在于它把抽取任务中几件麻烦事放到了一起：用 few-shot 示例约束输出结构、将结果对应回原文位置、处理长文档，以及生成便于核对结果的可视化页面。对于需要人工复核的抽取任务，“这条结果来自原文哪里”往往和结果本身同样重要。

这次我拿《西游记》中的一小段文字做测试，只定义两类结果：

-   `character`：人物，别名或称谓放在 `alias` 属性中；
-   `action`：行为，执行者和承受者分别放在 `actor`、`target` 属性中。

我还给抽取过程加了几条限制：结果必须照抄原文，顺序不能打乱，也不能擅自合并或概括。后面可以看到，即使要求写得很明确，模型也未必会完全照办。

## 02. 安装 LangExtract

LangExtract 是一个 Python 库，可以直接用 `pip` 安装。我习惯先建一个虚拟环境，免得把依赖混进系统环境：

```bash
python -m venv langextract_env
```

Linux 或 macOS 下执行：

```bash
source langextract_env/bin/activate
pip install langextract
```

Windows PowerShell 下执行：

```powershell
.\langextract_env\Scripts\Activate.ps1
pip install langextract
```

如果后面要试 OpenAI 模型，还需要安装对应的可选依赖：

```bash
pip install "langextract[openai]"
```

## 03. 使用本地 Ollama 模型

我先用 Ollama 跑本地模型。这样不用申请 API Key，也方便反复修改提示词；代价是抽取质量更依赖模型本身，运行速度也受本机配置影响。

### 3.1. 安装并准备模型

从 [Ollama 官网](https://ollama.com/)下载安装后，先确认命令能够正常执行：

```bash
ollama --version
```

这里用 `qwen3` 做测试：

```bash
ollama pull qwen3
```

下载完成后运行一次，确认 Ollama 服务和模型都没有问题：

```bash
ollama run qwen3
```

### 3.2. 运行示例

在 Python 项目中创建文件 `quick_test_ollama.py`：

```python
import langextract as lx
import textwrap

# 1. 定义抽取规则（Prompt）
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下信息：
1. 人物（character），将别名或称谓放入 alias 属性
2. 明确描述的行为（action），将执行者和承受者分别放入 actor、target 属性

要求：
- 抽取内容必须使用原文中的“原句或原词”，不要改写
- 不要合并不同实体
- 可为每个实体补充必要的属性来说明上下文
""")

# 2. 给 AI 一个示例，告诉它“你想要什么结果”
examples = [
    lx.data.ExampleData(
        text="行者道：“俺老孙乃齐天大圣孙悟空。”说罢，举起金箍棒便打。",
        extractions=[
            lx.data.Extraction(
                extraction_class="character",
                extraction_text="行者",
                attributes={"alias": ["齐天大圣", "孙悟空"]}
            ),
            lx.data.Extraction(
                extraction_class="action",
                extraction_text="举起金箍棒便打",
                attributes={"actor": "行者"}
            )
        ]
    )
]

# 3. 待处理文本
input_text = "怪物道：“我不是野豕，亦不是老彘，我本是天河里天蓬元帅。只因带酒调戏嫦娥，玉帝把我打了二千锤，贬下凡尘。”"

# 4. 执行抽取
result = lx.extract(
    text_or_documents=input_text,
    prompt_description=prompt,
    examples=examples,
    model_id="qwen3",
    model_url="http://localhost:11434",
)

print("Extraction successful!")

# 5. 查看抽取结果
for extraction in result.extractions:
    print(f"类型: {extraction.extraction_class}")
    print(f"文本: {extraction.extraction_text}")
    print(f"属性: {extraction.attributes}")
    print("----")
```

运行脚本：

```bash
python quick_test_ollama.py
```

示例输出如下：

```text
LangExtract: Processing, current=53 chars, processed=0 chars:  [00:04]
Extraction successful!
类型: character
文本: 怪物
属性: {'alias': ['天蓬元帅']}
----
类型: action
文本: 调戏嫦娥
属性: {'actor': '怪物'}
----
类型: action
文本: 被打
属性: {'actor': '怪物', 'target': '玉帝'}
----
```

从输出结果可以看出，模型不仅抽取出了人物和行为，还根据示例中的结构为抽取结果补充了属性信息。

不过需要注意，本地模型的输出稳定性与模型能力、提示词约束、示例质量都有关系。如果出现格式不稳定或抽取结果不符合预期的情况，通常需要继续调整 `prompt` 与 `examples`。

## 04. 使用 OpenAI 模型

除了本地模型，LangExtract 也可以接入 OpenAI 模型。使用前需要先配置 OpenAI API Key。推荐将 API Key 保存到环境变量中，避免直接写入代码。

Linux / macOS：

```bash
export OPENAI_API_KEY="your_api_key"
```

Windows PowerShell：

```powershell
$env:OPENAI_API_KEY="your_api_key"
```

随后在 Python 项目中创建测试文件，例如 `quick_test_openai.py`：

```python
import langextract as lx
import textwrap
import os

# 1. 定义抽取规则（Prompt）
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下信息：
1. 人物（character），将别名或称谓放入 alias 属性
2. 明确描述的行为（action），将执行者和承受者分别放入 actor、target 属性

要求：
- 抽取内容必须使用原文中的“原句或原词”，不要改写
- 不要合并不同实体
- 可为每个实体补充必要的属性来说明上下文
""")

# 2. 给 AI 一个示例，告诉它“你想要什么结果”
examples = [
    lx.data.ExampleData(
        text="行者道：“俺老孙乃齐天大圣孙悟空。”说罢，举起金箍棒便打。",
        extractions=[
            lx.data.Extraction(
                extraction_class="character",
                extraction_text="行者",
                attributes={"alias": ["齐天大圣", "孙悟空"]}
            ),
            lx.data.Extraction(
                extraction_class="action",
                extraction_text="举起金箍棒便打",
                attributes={"actor": "行者"}
            )
        ]
    )
]

# 3. 待处理文本
input_text = "怪物道：“我不是野豕，亦不是老彘，我本是天河里天蓬元帅。只因带酒调戏嫦娥，玉帝把我打了二千锤，贬下凡尘。”"

# 4. 执行抽取
result = lx.extract(
    text_or_documents=input_text,
    prompt_description=prompt,
    examples=examples,
    model_id="gpt-4.1-mini",
    api_key=os.environ["OPENAI_API_KEY"],
)

print("Extraction successful!")

# 5. 查看抽取结果
for extraction in result.extractions:
    print(f"类型: {extraction.extraction_class}")
    print(f"文本: {extraction.extraction_text}")
    print(f"属性: {extraction.attributes}")
    print("----")
```

这个脚本显式指定了以下配置：

-   `model_id="gpt-4.1-mini"`：指定模型，LangExtract 会根据模型名称自动选择 OpenAI provider；
-   `api_key=os.environ["OPENAI_API_KEY"]`：从环境变量中读取 API key。

输出格式和 schema 行为由 OpenAI provider 自动配置，无须显式传入 `fence_output` 或 `use_schema_constraints`。

执行脚本：

```bash
python quick_test_openai.py
```

## 05. 代码是怎么工作的

虽然上述两个脚本都比较简短，但已经覆盖了 LangExtract 的几个核心概念。

### 5.1. 用 `prompt_description` 定义抽取目标

脚本开头定义了抽取规则：

```python
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下信息：
1. 人物（character），将别名或称谓放入 alias 属性
2. 明确描述的行为（action），将执行者和承受者分别放入 actor、target 属性

要求：
- 抽取内容必须使用原文中的“原句或原词”，不要改写
- 不要合并不同实体
- 可为每个实体补充必要的属性来说明上下文
""")
```

写这种 `prompt` 不需要追求复杂，关键是把容易产生分歧的地方提前说清楚：抽取哪些类别、实体边界怎么算、是否允许改写，以及属性分别代表什么。如果 `actor` 和 `target` 的含义含糊，模型即使返回了格式正确的 JSON，也可能把两者填反。

### 5.2. 用 `examples` 示范抽取口径

光靠文字解释仍然可能有歧义，所以还要给出一组输入和期望输出：

```python
examples = [
    lx.data.ExampleData(
        text="行者道：“俺老孙乃齐天大圣孙悟空。”说罢，举起金箍棒便打。",
        extractions=[
            lx.data.Extraction(
                extraction_class="character",
                extraction_text="行者",
                attributes={"alias": ["齐天大圣", "孙悟空"]}
            ),
            lx.data.Extraction(
                extraction_class="action",
                extraction_text="举起金箍棒便打",
                attributes={"actor": "行者"}
            )
        ]
    )
]
```

这段示例同时演示了类别名称、原文边界和属性放置方式。模型由此知道，“行者”是要保留的原文，而“齐天大圣”和“孙悟空”应该作为它的别名。

如果抽取规则比较复杂，与其不断给 `prompt` 增加补丁，不如多准备几组有代表性的示例。尤其是容易混淆的边界情况，最好直接在示例中告诉模型该怎样处理。当然，示例之间也要保持一致，否则模型只会学到互相矛盾的规则。

### 5.3. 用 `lx.extract()` 执行抽取

准备好规则和示例后，调用 `lx.extract()`：

```python
result = lx.extract(
    text_or_documents=input_text,
    prompt_description=prompt,
    examples=examples,
    ...)
```

入门时主要会用到四个参数：

-   `text_or_documents`：待处理文本或文档；
-   `prompt_description`：抽取规则说明；
-   `examples`：few-shot 示例；
-   `model_id`：底层模型名称。

使用 Ollama 时，再告诉 LangExtract 本地服务的地址：

```python
model_id="qwen3",
model_url="http://localhost:11434",
```

切换到 OpenAI 时，保留同一套 `prompt_description` 和 `examples`，更换 `model_id` 即可。不同模型在速度、费用和抽取质量上各有差异，最终选哪个，还是要拿自己的数据测试。

### 5.4. 核对结果是否来自原文

LangExtract 会尝试把每条抽取结果映射回原文位置，这个信息保存在 `char_interval` 中：

```python
for extraction in result.extractions:
    print(extraction.extraction_text, extraction.char_interval)
```

如果模型给出的内容在原文中根本找不到，`char_interval` 会是 `None`。前面 `qwen3` 返回的“被打”就值得用这个办法检查。只保留能够回溯到原文的结果，可以先过滤一次：

```python
grounded_extractions = [
    extraction
    for extraction in result.extractions
    if extraction.char_interval is not None
]
```

不过，这只能挡住“原文里不存在”的内容，挡不住角色标反、漏抽等语义错误。最终仍然要靠评测数据和人工抽查兜底。

### 5.5. 生成交互式可视化页面

逐条打印结果适合调试，但抽取数量多起来以后，很难快速判断实体有没有错位、遗漏或重叠。LangExtract 官方 README 提供了一个更直观的核对方式：先把带有原文位置信息的结果保存为 JSONL，再用 `lx.visualize()` 生成一个自包含的交互式 HTML 页面。

把下面的代码接在前面的 `lx.extract()` 调用之后即可：

```python
# 1. 将抽取结果保存为 JSONL
lx.io.save_annotated_documents(
    [result],
    output_name="extraction_results.jsonl",
    output_dir=".",
)

# 2. 根据 JSONL 生成交互式 HTML
html_content = lx.visualize("extraction_results.jsonl")

# 3. 写入本地文件
with open("visualization.html", "w", encoding="utf-8") as f:
    if hasattr(html_content, "data"):
        # 在 Jupyter 或 Colab 中，返回值可能是 HTML 展示对象
        f.write(html_content.data)
    else:
        f.write(html_content)
```

运行完成后，当前目录会多出两个文件：

-   `extraction_results.jsonl`：保留原文、抽取类别、属性和位置等结构化结果，方便后续处理或重新生成页面；
-   `visualization.html`：可以直接用浏览器打开的可视化页面，不需要另外启动后端服务。

页面会把抽取结果放回原文上下文中进行高亮，并区分不同的抽取类别。浏览时可以在原文和实体信息之间对照，检查某个 `character` 或 `action` 究竟来自哪一段文本。相比终端里的一串字典，这种呈现更适合人工复核；当长文档中存在数百甚至数千条实体时，也更容易定位异常结果。

这里的可视化并没有重新调用模型。`lx.visualize()` 读取的是已经保存的 JSONL，所以可以在调整页面展示或复核结果时反复运行，不会产生新的模型调用费用。另一方面，它展示的是抽取结果和原文之间的对应关系，并不能自动证明属性在语义上正确。例如模型把 `actor` 和 `target` 填反时，页面能帮助我们更快发现问题，但仍然需要人来作出判断。

官方 README 中的 [Visualize the Results](https://github.com/google/langextract/blob/main/README.md#3-visualize-the-results) 示例也采用了相同流程，并说明生成的 HTML 是自包含文件，适合直接分享给其他人复核。

## 06. 总结

LangExtract 的核心价值在于，它将“信息抽取”从传统的规则编写、模型训练或固定标签体系中解放出来，转化为一种更轻量的工程流程：

> 定义抽取目标 → 提供 few-shot 示例 → 调用大语言模型 → 获得结构化结果 → 可视化复核。

本文中的两个示例分别展示了两种常见接入方式：

-   `quick_test_ollama.py`：演示如何接入本地 Ollama 模型；
-   `quick_test_openai.py`：演示如何接入 OpenAI 模型。

无论底层使用哪种模型，抽取结果都可以保存为统一的 JSONL，并进一步生成交互式 HTML。这个“抽取—定位—复核”的闭环，是 LangExtract 相比只让模型返回 JSON 更实用的地方。

如果项目中存在文本结构化、知识抽取、内容理解、文档解析等需求，LangExtract 值得作为一个轻量级方案进行试验。它并不一定能完全替代传统 NLP 流水线，但在业务规则变化较快、抽取目标高度定制化、样本数据有限的场景中，有望降低原型验证和功能迭代成本。

## 引用

1.  [LangExtract](https://github.com/google/langextract)
