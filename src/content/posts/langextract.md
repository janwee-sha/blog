---
title: "LangExtract初探"
published: 2026-02-25
updated: 2026-05-05
description: "最近关注到 Google 开源的 LangExtract 。从定位上看，它并不是一个通用聊天框架，而是一个面向信息抽取场景的工具：通过大语言模型，按照开发者定义的抽取规则，将非结构化文本转换为结构化结果。 如果你曾经接触过传统的 NER、关键词抽取或关系抽取，会比较容易理解 LangExtract 的价值。它的重点并不在于完成“识别人名、地名、组织名”这类固"
image: ""
tags: ["AI", "Lang Extract"]
category: "AI"
draft: false
lang: "zh_CN"
---
> 操千曲而后晓声，观千剑而后识器
>
> — ——《文心雕龙·知音》

最近关注到 Google 开源的 **LangExtract**。从定位上看，它并不是一个通用聊天框架，而是一个面向信息抽取场景的工具：通过大语言模型，按照开发者定义的抽取规则，将非结构化文本转换为结构化结果。

如果你曾经接触过传统的 NER、关键词抽取或关系抽取，会比较容易理解 LangExtract 的价值。它的重点并不在于完成“识别人名、地名、组织名”这类固定任务，而在于允许开发者直接使用自然语言描述业务化的抽取目标。例如：

-   抽取人物；
-   抽取人物别名或称谓；
-   抽取人物行为；
-   为行为补充执行者、目标等上下文属性。

因此，LangExtract 更像是一个**面向业务场景的可编排信息抽取层**。它将抽取任务从传统的规则工程、模型训练或标签体系设计中抽离出来，转化为“定义抽取目标、提供示例、调用模型”的流程。

## 01.LangExtract能解决什么问题

LangExtract 适合处理以下类型的任务：

-   从长文本中抽取指定类型的信息；
-   按照业务语义定义实体类型，而不是受限于通用标签体系；
-   为抽取结果附加属性，以补充必要的上下文信息；
-   通过 few-shot 示例约束模型输出，使抽取结果更加稳定；
-   将非结构化文本整理为便于后续处理的结构化数据。

概括来说，LangExtract 的核心目标不是“让模型回答问题”，而是“让模型按照指定格式完成抽取”。

本文将以《西游记》片段作为示例，希望从文本中抽取以下信息：

-   人物：`character`
-   别名或称谓：`alias`
-   行为：`action`

同时，要求抽取过程遵循以下约束：

-   抽取内容应尽量使用原文表述；
-   保持文本中的出现顺序；
-   不随意改写、合并或泛化实体；
-   可以补充上下文属性，例如行为的执行者、目标对象等。

## 02.安装依赖

LangExtract 是一个 Python 库，因此可以通过 Python 的包管理工具 `pip` 安装。建议先为项目创建独立的 Python 虚拟环境，以避免与系统环境或其他项目依赖发生冲突。

```bash
python -m venv langextract_env
```

Linux / macOS 环境下执行：

```java
source langextract_env/bin/activate
pip install langextract
```

Windows 环境下执行：

```bash
langextract_env\Scripts\activate
pip install langextract
```

虚拟环境创建完成后，后续安装的依赖都会隔离在当前项目目录中，便于管理和清理。

## 03.使用本地 Ollama 模型

LangExtract 可以接入多种大语言模型。如果希望在本地运行，避免依赖云端 API，可以结合 Ollama 使用。

### 3.1.安装并准备模型

从[Ollama官网](https://ollama.com/)下载并安装 Ollama。然后验证安装结果：

```bash
ollama --version
```

随后下载一个本地模型。这里以 `qwen3` 为例：

```bash
ollama pull qwen3
```

模型下载完成后，可以先运行一次，确认模型能够正常启动：

```bash
ollama run qwen3
```

### 3.2.运行示例

在 Python 项目中创建文件 `quick_test_ollama.py`：

```python
import langextract as lx
import textwrap

# 1. 定义抽取规则（Prompt）
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下实体：
1. 人物（character）
2. 人物的别名或称谓（alias）
3. 明确描述的行为（action）

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
    model_id="qwen3"
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

```bash
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

不过需要注意，本地模型的输出稳定性与模型能力、提示词约束、示例质量都有关系。如果出现格式不稳定或抽取结果不符合预期的情况，通常需要继续调整 prompt 与 examples。

## 04.使用 OpenAI 模型

除了本地模型，LangExtract 也可以接入 OpenAI 模型。使用前需要先配置 OpenAI API Key。推荐将 API Key 保存到环境变量中，避免直接写入代码。

Linux / macOS:

```bash
export OPENAI_API_KEY="your_api_key"
```

Windows PowerShell:

```bash
$env:OPENAI_API_KEY="your_api_key"
```

随后在 Python 项目中创建测试文件，例如 `quick_test_openai.py`：

```python
import langextract as lx
import textwrap
import os
from langextract.providers.openai import OpenAILanguageModel

# 1. 定义抽取规则（Prompt）
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下实体：
1. 人物（character）
2. 人物的别名或称谓（alias）
3. 明确描述的行为（action）

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
    language_model_type=OpenAILanguageModel,
    api_key=os.environ["OPENAI_API_KEY"],
    fence_output=True,
    use_schema_constraints=False,
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

-   `model_id="gpt-4.1-mini"`：指定使用的 OpenAI 模型；
-   `language_model_type=OpenAILanguageModel`：指定模型提供方为 OpenAI；
-   `api_key=os.environ["OPENAI_API_KEY"]`：从环境变量中读取 API Key；
-   `fence_output=True`：要求模型输出边界更加清晰；
-   `use_schema_constraints=False`：关闭 schema 约束，以减少部分模型或输出格式上的兼容性问题。

执行脚本：

```bash
python quick_test_openai.py
```

## 05.代码是怎么工作的

虽然上述两个脚本都比较简短，但已经覆盖了 LangExtract 的几个核心概念。

### 5.1.用 prompt\_description 定义抽取目标

脚本开头定义了抽取规则：

```python
prompt = textwrap.dedent("""
从中文文本中抽取与《西游记》相关的关键信息。

请按文本出现顺序抽取以下实体：
1. 人物（character）
2. 人物的别名或称谓（alias）
3. 明确描述的行为（action）

要求：
- 抽取内容必须使用原文中的“原句或原词”，不要改写
- 不要合并不同实体
- 可为每个实体补充必要的属性来说明上下文
""")
```

对于信息抽取任务而言，prompt 的重点不在于语言是否华丽，而在于约束是否明确。至少需要说明以下内容：

-   需要抽取哪些类型的信息；
-   是否需要保持原文顺序；
-   抽取结果是否允许改写；
-   是否允许补充属性；
-   属性应该表达何种上下文关系。

在结构化抽取场景中，清晰的规则通常比复杂的描述更重要。

### 5.2.用 examples 做 few-shot 对齐

接着，脚本通过 `examples` 提供了一个示例：

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

这一部分非常关键。它相当于向模型展示了一组“输入文本与期望输出”的对应关系，明确告诉模型：

-   输入文本可能是什么样的；
-   哪些内容需要被抽取；
-   抽取结果应该使用什么类别；
-   属性应当如何挂载；
-   哪些信息可以忽略。

在实际项目中，高质量的 few-shot 示例往往比继续堆叠 prompt 约束更有效。尤其是在实体边界、属性归属和抽取粒度较为复杂的场景中，示例可以显著提升输出稳定性。

### 5.3.用 lx.extract() 执行抽取

两个脚本最终都会调用 `lx.extract()`：

```python
result = lx.extract(
    text_or_documents=input_text,
    prompt_description=prompt,
    examples=examples,
    ...)
```

其中几个核心参数如下：

-   `text_or_documents`：待处理文本或文档；
-   `prompt_description`：抽取规则说明；
-   `examples`：few-shot 示例；
-   `model_id`：底层模型名称。

如果使用本地 Ollama 模型，可以直接指定：

```python
model_id="qwen3"
```

如果使用 OpenAI 模型，则需要额外指定：

```python
language_model_type=OpenAILanguageModel,
api_key=os.environ["OPENAI_API_KEY"],
fence_output=True,
use_schema_constraints=False,
```

这使得 LangExtract 在使用方式上具备较好的可切换性：同一套抽取规则和示例，可以尝试接入不同的模型提供方，并根据成本、性能和稳定性选择合适的部署方案。

## 06.总结

LangExtract 的核心价值在于，它将“信息抽取”从传统的规则编写、模型训练或固定标签体系中解放出来，转化为一种更轻量的工程流程：

> 定义抽取目标 → 提供 few-shot 示例 → 调用大语言模型 → 获得结构化结果。

本文中的两个示例分别展示了两种常见接入方式：

-   `quick_test_ollama.py`：演示如何接入本地 Ollama 模型；
-   `quick_test_openai.py`：演示如何接入 OpenAI 模型。

如果项目中存在文本结构化、知识抽取、内容理解、文档解析等需求，LangExtract 值得作为一个轻量级方案进行试验。它并不一定能完全替代传统 NLP 流水线，但在业务规则变化较快、抽取目标高度定制化、样本数据有限的场景中，能够显著降低原型验证和功能迭代成本。

## 参考

-   [Langextract](https://github.com/google/langextract)
