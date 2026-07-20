---
title: "OpenClaw上手"
published: 2026-03-23
updated: 2026-04-08
description: "最近 OpenClaw 突然爆火。一开始我没太在意，觉得它不过是一个套了聊天软件外壳的 OpenAI Codex，和这段时间不断冒出来的各类 AI Bot 项目相比，好像也没有特别大的差别。 但前两天，一个并非程序员的朋友给我展示了他的用法：他用 OpenClaw 集成飞书，配置了两个机器人，一个负责产品管理，另一个负责程序开发，最后居然真的帮他搭出了一个像"
image: ""
tags: ["AI助手", "OpenClaw"]
category: "AI"
draft: false
lang: "zh_CN"
---
> 如臂使指，如指使臂。
>
> — ——《汉书·贾谊传》

最近 OpenClaw 突然爆火。一开始我没太在意，觉得它不过是一个套了聊天软件外壳的 OpenAI Codex，和这段时间不断冒出来的各类 AI Bot 项目相比，好像也没有特别大的差别。

但前两天，一个并非程序员的朋友给我展示了他的用法：他用 OpenClaw 集成飞书，配置了两个机器人，一个负责产品管理，另一个负责程序开发，最后居然真的帮他搭出了一个像模像样的游戏社区网站。虽然离完整产品还有距离，但那个雏形已经足够说明问题——它不是单纯“能聊天”，而是真的能参与任务协作。

这一下把我的兴趣勾起来了，于是我也动手试了试。

这段时间，能接入大模型的聊天机器人已经很多了。但用得多了也会发现，很多这类工具本质上还是“会回话的程序”：你问一句，它答一句；你发一个命令，它执行一下。它能用，但通常也就停在这里了。

OpenClaw 给我的第一感觉不太一样。它当然也能聊天，但它不只是等你发消息。它还有记忆、定时任务、技能这些机制，方向明显更偏向长期使用，而不是一次性的问答交互。

简单说，传统聊天机器人更像“消息驱动”的工具：有人发消息，它就工作。OpenClaw 则更像一个持续运行的代理：除了回复你，它还能记住一些事情、按时做一些事情、慢慢形成自己的使用方式。

也正因为如此，我觉得它值得认真看一看。比起再折腾一个“会接模型的 Bot”，我更关心的是：有没有一种方案，能把 AI 真的做成一个日常可用、能逐渐养成习惯的个人助手。OpenClaw 正好提供了这样一个入口。

## 01.OpenClaw 是什么

如果只看表面，OpenClaw 很像一个聊天机器人框架：它可以接入即时通信平台，可以连接大模型，也可以通过消息与用户交互。

但它的定位并不只是一个 Bot。更准确地说，OpenClaw 更像是一个面向个人场景的**智能代理运行时**。它想解决的问题，不只是“如何回复一条消息”，而是“如何让一个 AI 在长期运行中具备记忆、工具、任务和协作能力”。

从结构上看，OpenClaw 可以大致分成几个核心部分：

-   **Gateway**：对外入口，负责连接客户端、节点和控制界面。
-   **Agent**：真正执行对话、调用工具、处理任务的代理主体。
-   **Channel**：消息通道，例如 Telegram、飞书等。
-   **Workspace**：代理工作的本地工作区，承载配置、身份设定和技能。
-   **Memory**：负责长期记忆。
-   **Skills**：负责能力扩展。

相比传统聊天机器人偏向“消息收发、指令触发、规则处理”的思路，OpenClaw 更强调以下几个方向：

1.  **不仅能对话，还能执行任务**
    它不是只有一层消息回复逻辑，而是可以调用工具、运行任务、处理更复杂的工作流。

2.  **不仅有即时上下文，还有可持续记忆**
    很多 Bot 的“记忆”本质上只是会话上下文，而 OpenClaw 会把长期信息沉淀到工作区文件中。

3.  **不仅是一个入口 Bot，还有完整运行时结构**
    它不是单一脚本，而是一套围绕 Gateway、Agent、Channel、Memory 组织起来的系统。

4.  **不仅支持被动响应，还支持定时与主动工作**
    它可以通过 cron、reminder、heartbeat 等机制在合适的时间主动执行任务。


也正因为这些特性，OpenClaw 更适合拿来做“个人智能代理”，而不仅仅是一个能回消息的聊天机器人。

## 02.快速上手

### 2.1.前置准备

OpenClaw 基于 Node.js 运行，因此首先需要准备好 Node.js 环境。
在 Windows、macOS 和 Linux 上都可以使用，但如果只是初次体验，本地 Windows 或 Linux 桌面环境已经足够。

先确认本机已有 Node.js：

```bash
node -v
npm -v
```

如果命令能正常返回版本号，就说明基础环境已经具备。

### 2.2.安装 OpenClaw

安装方式很直接，可以通过 npm 全局安装：

```bash
npm install -g openclaw
```

安装完成后，先确认命令是否可用：

```bash
openclaw --help
```

如果能看到帮助信息，说明安装成功。

### 2.3.配置 OpenClaw

安装之后，OpenClaw 会在本地创建自己的配置和工作区。
如果是第一次使用，最方便的方式不是直接手改配置文件，而是先通过引导命令完成基础配置：

```bash
openclaw onboard
```

这个命令可以理解成 OpenClaw 的初始化向导。它会带你完成一些最基本的配置，例如：

-   选择或确认运行环境
-   初始化工作区
-   配置 Gateway 的基础参数
-   在需要时引导接入聊天通道

对于刚上手的人来说，这一步会省掉不少手动摸索配置项的时间。

完成引导之后，可以再执行下面两个命令检查当前状态：

```bash
openclaw status
openclaw gateway status
```

这两个命令分别用于：

-   查看整体运行状态
-   查看 Gateway 是否已经启动

Gateway 可以理解成 OpenClaw 的服务端。很多能力——例如控制界面、消息通道、节点连接——都依赖它。

如果需要手动启动 Gateway，可以执行下面的命令以后台方式启动：

```bash
openclaw gateway start
```

如果想前台观察启动过程，也可以执行：

```bash
openclaw gateway run --verbose
```

启动后 Gateway 默认在本地_18789_ 端口运行，首次访问[http://localhost:18789](http://localhost:18789) 会进入仪表盘登录界面：

![Openclaw Dashboard Login](/uploads/2026/03/Openclaw-Dashboard-Login.png)

输入网关令牌（存放在 OpenClaw 的配置文件 `~/.openclaw/openclaw.json` 中）后即可进入仪表盘：

![Openclaw Dashboard Overview](/uploads/2026/03/Openclaw-Dashboard-Overview.png)

### 2.4.接入即时聊天软件

OpenClaw 支持以 WebSocket 协议接入飞书、WhatsApp、Telegram等众多社交聊天软件和支持 WebSocket 的客户端。

以 Telegram 为例，大体流程如下：

-   在 Telegram 中通过 [@BotFather](https://t.me/BotFather) 这个机器人账号提供的入口创建 Bot；
-   在 @BotFather 处获取创建的 Bot 的 Token；
-   在 OpenClaw 配置中启用 Telegram 通道并填写Bot Token；
-   重启Gateway；

```bash
openclaw gateway restart
```

-   在 Telegram 中私聊 Bot 进行验证。

![Telegram Bot Chat](/uploads/2026/03/Telegram-Bot-Chat.png)

如果 Telegram 通道已成功启用，状态输出里通常能看到对应的 Channel 信息。

Telegram 对 OpenClaw 的意义，不只是“多了一个消息入口”，而是让它从本地工具变成了一个随时可以触达的个人代理。

## 03.让 OpenClaw 助手参与群组聊天

前面提到 Telegram 时，更多还是把 OpenClaw 当成一个“可在私聊中使用的个人代理”来看。但实际上，Telegram 对 OpenClaw 的价值并不只体现在私聊上。配置得当之后，它同样可以进入群组场景，参与多人对话，甚至承担一部分协作和通知功能。

这也是 OpenClaw 和很多传统 IM Bot 不太一样的地方。它不是只能在一对一窗口里回答问题，而是可以根据不同的聊天上下文，切换自己的工作方式。

在私聊里，OpenClaw 更像是一个直接服务于用户本人的个人助手；而在群组里，它更像一个“在场但不越位”的参与者。

换句话说，它不应该像某些机器人那样对每条消息都跳出来回复，而应该在真正需要的时候再发言。例如：

-   被明确提到或点名时
-   群里有人提出问题，需要补充资料时
-   讨论告一段落，需要做简要总结时
-   某些关键信息需要纠正或提醒时

这种角色切换其实非常重要。因为群聊不是一对一对话，代理如果过于主动，很容易打扰正常交流；但如果完全不能参与，它在群组中的价值又会大打折扣。

把 OpenClaw 拉进 Telegram 群组，并不只是“让它也能收群消息”这么简单。更准确地说，这一步是在为代理定义它在多人场景中的行为边界。

实际配置时，通常需要考虑几类问题：

-   是否允许群组消息进入代理
-   是否必须被 mention 才回应
-   是否只允许特定群组
-   是否对群组和私聊采用不同规则

以我当前的 Telegram 配置为例：

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "allowlist",
      "botToken": "<YOUR_BOT_TOKEN>",
      "allowFrom": [
        "<YOUR_TELEGRAM_NUMBER_ID>"
      ],
      "groupAllowFrom": [
        "<YOUR_TELEGRAM_NUMBER_ID>"
      ],
      "groupPolicy": "allowlist",
      "groups": {
        "<YOUR_GROUP_CHAT_ID>": {
          "enabled": true,
          "requireMention": false,
          "allowFrom": [
            "<YOUR_TELEGRAM_NUMBER_ID>"
          ]
        }
      },
      "streaming": "partial"
    }
  }
}
```

配置说明：

-   `dmPolicy: "allowlist"` ：它表示私聊并不是默认对所有人开放，而是只有在允许列表中的用户才能直接进入。
-   `groupPolicy: "allowlist"`：它表示群组也不是默认全部放开，而是只有被允许的群组才可以让代理参与。
-   `groups`：这里可以对具体群组做更细粒度的控制。
-   `requireMention: false`：决定群里发言时，代理是不是一定要被 @ 才回应。
-   `allowFrom / groupAllowFrom`：限定可以触发代理的用户范围。

![Telegram 群聊](/uploads/2026/03/Openclaw-Group-Chat.png)

## 04.OpenClaw 的配置文件与工作区

OpenClaw 很有意思的一点在于，它的配置并不只存在于 JSON 文件里。

更准确地说，它的行为通常同时受到两类内容影响：

1.  结构化配置
2.  工作区中的文本文件

前者更偏运行参数，例如 Gateway、通道、认证等系统层配置；后者则更偏代理本身，例如身份设定、用户偏好、长期记忆、技能说明等。

这些文件各自承担的职责并不完全相同，但整体上都在做一件事：把代理的行为方式写下来。例如：

-   SOUL.md 记录代理的性格与原则；
-   USER.md 记录用户偏好和称呼；
-   MEMORY.md 承载长期记忆；
-   memory/ 用来记录每日发生的事情；
-   skills/ 用来沉淀某类任务的处理方式。

这种工作方式和“纯面板配置”很不一样。
它的优点主要有三点：

-   更灵活：很多行为不是通过开关控制，而是通过文本和规则逐步塑造。
-   更可追踪：代理的身份、习惯和记忆都可以直接落到文件里。
-   更适合长期演化：随着使用时间增长，代理不会一直停留在初始状态，而是会通过工作区慢慢形成自己的风格与能力边界。

这也是 OpenClaw 区别于很多普通 Bot 系统的重要特征：它不只是一个“接了模型的聊天入口”，而是一个可以逐步养成的代理环境。

## 05.从会聊天到会按时做事

如果说聊天能力让 OpenClaw 看起来像一个 Bot，那么定时任务机制则让它更像一个真正的助手。传统聊天机器人通常是被动响应的：有人发消息，它回复；没人发消息，它就沉默。

OpenClaw 则提供了 cron、reminder、heartbeat 这一类主动机制，使它可以在特定时间或周期下执行任务。这样一来，它就不只是“等你来问”，而是可以主动承担一些轻量工作。

这类机制比较适合的场景包括：

-   定时提醒
-   周期检查
-   定期汇总信息
-   到点触发某个代理任务

例如，一个很典型的用法就是每天固定时间播报天气、提醒待办事项，或者定期检查某项信息是否有更新。

这类能力看似简单，但其实非常关键。因为用户真正想要的，往往不只是“一个能回答问题的 AI”，而是“一个能记得事情、按时出现、主动帮忙的助手”。定时任务恰好就是从“聊天”走向“助手”的关键一步。

比如下面的“天气晨报”：

![“天气晨报”任务配置信息](/uploads/2026/03/Openclaw-Scheduled-Task.png)

![机器人播报天气](/uploads/2026/03/Openclaw-Scheduled-Task-Chat.png)

## 06.给 OpenClaw 添加技能

OpenClaw 另一项很有代表性的能力是 Skills。

如果用最简单的话来说，可以把 Skill 理解成一份“这类任务该怎么做”的说明书。
当代理遇到特定任务时，它不需要每次都从头猜测，而可以按这份说明去处理。

Skill 的作用并不是插件市场式的“UI 功能扩展”，而更像是给代理增加：

-   专项任务处理能力
-   工作流程规范
-   面向特定场景的操作说明

这也是它和普通 prompt 的不同之处。

普通 prompt 更像一次性的临时交代；而 Skill 则更结构化，也更适合复用。它不只是为了这一次回答，而是为了让同类任务在以后也能稳定执行。

例如，我在实际使用中就遇到过一个很典型的场景：让 OpenClaw 修改工作区文件并提交到 Git。第一次这么做时，需要我明确告诉它——修改完文件后，不仅要提交本地变更，还要继续上传到 Git 仓库。这个要求如果只靠一次性的聊天说明，代理当下当然能照做，但下一次再遇到类似任务时，仍然可能需要重新提醒。

而如果把这个经验沉淀成 Skill，情况就不一样了。以 [ClawHub](https://clawhub.ai/) 的`self-improving-agent` 这个技能为例，它的核心作用并不只是“记录错误”或“保存经验”，更重要的是把这些经验转化成后续可复用的行为规则。这样一来，第一次还需要用户亲自指示“修改完后帮我把工作区文件上传到 Git 仓库”，后面再遇到同类任务时，代理就能把这件事当成一个已经学会的工作习惯，而不是每次都重新等用户补充说明。

Self-Improvement技能的结构如下：

```html
# Self-Improvement Skill

Log learnings and errors to markdown files for continuous improvement. Coding agents can later process these into fixes, and important learnings get promoted to project memory.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Command/operation fails | Log to `.learnings/ERRORS.md` |
| User corrects you | Log to `.learnings/LEARNINGS.md` with category `correction` |
| User wants missing feature | Log to `.learnings/FEATURE_REQUESTS.md` |
| API/external tool fails | Log to `.learnings/ERRORS.md` with integration details |
| Knowledge was outdated | Log to `.learnings/LEARNINGS.md` with category `knowledge_gap` |
| Found better approach | Log to `.learnings/LEARNINGS.md` with category `best_practice` |
| Simplify/Harden recurring patterns | Log/update `.learnings/LEARNINGS.md` with `Source: simplify-and-harden` and a stable `Pattern-Key` |
| Similar to existing entry | Link with `**See Also**`, consider priority bump |
| Broadly applicable learning | Promote to `CLAUDE.md`, `AGENTS.md`, and/or `.github/copilot-instructions.md` |
| Workflow improvements | Promote to `AGENTS.md` (OpenClaw workspace) |
| Tool gotchas | Promote to `TOOLS.md` (OpenClaw workspace) |
| Behavioral patterns | Promote to `SOUL.md` (OpenClaw workspace) |
// ...
```

从这个例子可以看出，Skill 真正的价值不在于多了一个命令或者多了一个面板，而在于它把“怎么做这类事”保存了下来。对使用者来说，这有几个非常直接的好处：

-   把常见任务沉淀为可复用能力
-   降低每次重新解释需求的成本
-   让代理的行为更加稳定

随着使用深入，Skills 会逐渐成为 OpenClaw 最有价值的部分之一。因为当你开始不断积累自己的技能时，OpenClaw 就不再只是一个通用代理，而会越来越像“你自己的代理”。

## 07.结语

从安装、配置到 Telegram 接入，再到定时任务与技能机制，OpenClaw 展现出来的并不是一个普通意义上的聊天机器人框架，而是一套更偏向个人智能代理的运行环境。

它当然能聊天，但更重要的是，它试图让 AI 不只是“会回复消息”，而是拥有更丰富的上下文，能够长期运行、保留记忆、执行任务、主动出现，并通过技能不断扩展能力边界。

如果后续继续深入，OpenClaw 还有很多值得展开的话题，例如：

-   记忆机制的组织方式
-   技能设计的实践方法
-   定时任务的更复杂用法
-   多通道接入与安全边界

至少从上手体验来看，OpenClaw 已经不只是“又一个接入大模型的 Bot 项目”了。它更像一个起点——一个把 AI 逐步接入日常工作流和个人生活场景的起点。让我不禁幻想起有一天能拥有一个《钢铁侠》系列电影中的“贾维斯”级别的智能助手了（笑）。

## 引用

-   [OpenClaw 文档](https://docs.openclaw.ai/)
