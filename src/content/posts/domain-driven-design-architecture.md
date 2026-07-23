---
title: "领域驱动设计杂谈（三）：DDD 大厦的梁柱"
published: 2026-07-19
description: "介绍领域驱动设计在分层架构和六边形架构中的落地方式，以及依赖倒置、端口与适配器如何保护领域模型。"
image: ""
tags: ["领域驱动设计"]
category: "设计模式"
draft: false
lang: "zh_CN"
---
> 形而上者谓之道，形而下者谓之器
>
> ——《周易·系辞上》

## 01. 只有砖瓦还不够

实体、值对象、聚合、资源库、领域服务和领域事件，为我们提供了构建领域模型的砖瓦。但只有砖瓦还不足以建成一座大厦：系统还需要明确哪些组件承担用例编排，哪些组件实现业务规则，哪些组件处理数据库、消息和网络等技术细节，以及依赖应该朝什么方向流动。

架构就像大厦的梁柱。它不直接决定每一块砖瓦的内容，却通过承重结构和连接方式，保护最重要的部分不被外界变化轻易破坏。

DDD 并不强制绑定某一种架构。分层架构、六边形架构、洋葱架构和整洁架构的表现形式各不相同，但它们与 DDD 结合时通常追求同一个目标：

**让领域模型处于系统核心，并隔离外部技术细节。**

如果只是创建几个名为 `domain`、`application` 和 `infrastructure` 的目录，却依然让领域对象依赖 ORM、HTTP 请求或消息客户端，那么系统得到的只是 DDD 风格的外观，而不是受架构保护的领域模型。

## 02. DDD 与架构的关系

DDD 关注的是业务知识如何被发现、建模和表达；架构关注的是系统各部分如何组织、依赖和协作。两者解决的问题不同，却会相互影响。

领域模型需要调用资源库、时钟、事件发布器或外部服务，但这些能力往往依赖数据库、消息中间件和网络。若领域层直接依赖具体技术，它就会被实现细节牵制。更换数据库或测试业务规则时，原本稳定的业务代码也不得不随之变化。

解决这个问题的关键，不是让领域层与外部世界彻底断绝联系，而是在核心模型和外部技术之间建立稳定的抽象：

- 核心模型声明自己需要什么能力。
- 外围组件负责实现这些能力。
- 组装代码在系统边界完成具体实现的注入。
- 依赖从易变的技术细节指向相对稳定的业务抽象。

这样，业务代码仍然可以使用持久化、消息和外部服务，却不必知道这些能力由 JPA、RabbitMQ 还是 HTTP 客户端提供。

## 03. 分层架构下的 DDD

分层架构下的 DDD 可以视为对传统 Web 三层架构的一种扩展。它不再把所有业务逻辑都放进 Service 层，而是进一步区分应用用例与领域规则。

常见的四层划分如下：

| 层次 | 职责 |
| --- | --- |
| 用户界面层 | 接收来自用户或其他系统的请求，转换输入并呈现结果 |
| 应用层 | 定义系统提供的用例，协调领域对象和外部能力，不保存核心业务规则 |
| 领域层 | 表达业务概念、状态、行为和规则，是业务软件的核心 |
| 基础设施层 | 实现持久化、消息、网络、文件等技术能力，并完成系统组装 |

一次典型请求可能沿着下面的路径流动：

1. 用户界面层把 HTTP 请求转换成应用命令。
2. 应用服务加载聚合并调用领域行为。
3. 领域对象执行判断并改变状态，必要时产生领域事件。
4. 应用服务通过资源库保存聚合，并协调事件发布。
5. 基础设施适配器把抽象操作转换成数据库语句或消息。
6. 用户界面层把用例结果转换成响应。

这种分工的重点不是“上层调用下层”这么简单，而是让每一层只承担与其抽象层次相匹配的职责。

例如，Controller 不应该决定订单能否取消；应用服务不应该用一串 `if` 拼装核心计价规则；领域实体也不应该自己开启事务或发送 RabbitMQ 消息。

一个采用分层架构的图书模块可以组织为：

```text
book
  ├── interfaces                          # 用户界面层
  │   ├── rest                            # REST 资源与请求转换
  │   └── subscriber                      # 入站消息订阅者
  │
  ├── application                         # 应用层
  │   ├── command                         # 用例输入
  │   ├── service                         # 应用服务
  │   └── view                            # 用例输出
  │
  ├── domain                              # 领域层
  │   ├── event                           # 领域事件
  │   ├── model                           # 实体、值对象与聚合
  │   ├── repository                      # 资源库抽象
  │   └── service                         # 领域服务
  │
  └── infrastructure                      # 基础设施层
      ├── messaging                       # 消息实现
      ├── persistence                     # 持久化实现
      └── security                        # 安全与系统配置
```

目录可以帮助团队理解职责，却不能替代依赖规则。即使文件放在 `domain` 目录下，只要它导入了 Web 框架请求对象，它仍然泄漏了外部技术。

## 04. 依赖倒置：让领域层远离技术细节

分层结构经常被画成自顶向下的调用关系，但调用方向并不等于源码依赖方向。

根据依赖倒置原则（Dependency Inversion Principle，DIP），高层策略不应该依赖低层实现，二者都应该依赖抽象。对 DDD 来说，领域模型和应用用例属于更高层的策略，数据库、消息系统和第三方接口则属于更容易变化的实现细节。

以发布领域事件为例，应用层可以声明一个出口：

```java
package com.example.bookstore.order.application.port.out;

import com.example.bookstore.shared.domain.DomainEvent;

public interface DomainEventPublisher {
    void publish(DomainEvent event);
}
```

应用服务依赖这个接口，而不是依赖某个消息中间件：

```java
package com.example.bookstore.order.application.service;

import com.example.bookstore.order.application.command.PlaceOrderCommand;
import com.example.bookstore.order.application.port.out.DomainEventPublisher;
import com.example.bookstore.order.domain.model.Order;
import com.example.bookstore.order.domain.model.OrderId;
import com.example.bookstore.order.domain.repository.OrderRepository;

public class PlaceOrderService {
    private final OrderRepository orderRepository;
    private final DomainEventPublisher eventPublisher;

    public PlaceOrderService(
            OrderRepository orderRepository,
            DomainEventPublisher eventPublisher
    ) {
        this.orderRepository = orderRepository;
        this.eventPublisher = eventPublisher;
    }

    public OrderId place(PlaceOrderCommand command) {
        Order order = Order.place(command.buyerId(), command.items());
        orderRepository.save(order);
        order.domainEvents().forEach(eventPublisher::publish);
        return order.id();
    }
}
```

基础设施层提供基于 RabbitMQ 的实现：

```java
package com.example.bookstore.order.infrastructure.messaging;

import com.example.bookstore.order.application.port.out.DomainEventPublisher;
import com.example.bookstore.shared.domain.DomainEvent;

public class RabbitDomainEventPublisher implements DomainEventPublisher {
    private final MessageClient messageClient;
    private final DomainEventMessageMapper mapper;

    public RabbitDomainEventPublisher(
            MessageClient messageClient,
            DomainEventMessageMapper mapper
    ) {
        this.messageClient = messageClient;
        this.mapper = mapper;
    }

    @Override
    public void publish(DomainEvent event) {
        messageClient.publish(mapper.toMessage(event));
    }
}
```

源码依赖由 `RabbitDomainEventPublisher` 指向应用层定义的 `DomainEventPublisher`，而不是相反。以后改用 Kafka 或进程内事件总线，只需要提供另一个实现，应用用例和领域模型无需知道替换过程。

上面的示例省略了事务与消息一致性问题。生产系统通常还需要事务发件箱等机制，避免数据库提交成功而消息发布失败。架构隔离并不会自动解决分布式一致性，但它能让这些技术策略留在适当的边界中。

## 05. 六边形架构：端口与适配器

分层架构强调不同抽象层次的职责，**六边形架构**（Hexagonal Architecture）则更突出系统内部与外部之间的边界。它也被称为**端口与适配器架构**（Ports and Adapters Architecture）。

这里的“六边形”并不代表系统必须拥有六个面。这个图形只是为了避免人们继续把系统理解成固定的上下层调用栈，并强调应用可以通过多个方向与外部交互。

六边形内部包含应用用例和领域模型，外部则是 Web、命令行、定时任务、数据库、消息系统和第三方服务。内外双方不直接耦合，而是通过端口和适配器通信。

```mermaid
flowchart LR
    A[客户端] --> B[入站适配器]
    B --> C[入站端口]
    subgraph 应用内部
        C --> D[应用服务与领域模型]
        D --> E[出站端口]
    end
    E --> F[出站适配器]
    F --> G[(数据库或外部服务)]
```

端口可以按交互方向分为两类：

- **入站端口**描述应用向外提供的用例，例如“创建订单”或“取消订单”。Web Controller、消息订阅者和测试代码都可以作为入站适配器驱动这些用例。
- **出站端口**描述应用为了完成用例而需要的外部能力，例如保存订单、查询库存或发布事件。数据库资源库、HTTP 客户端和消息发布器是这些端口的适配器。

入站和出站描述的是谁驱动谁，而不是网络流量从哪个方向进入。一个消息订阅者会驱动应用，因此它是入站适配器；应用主动发布消息到 RabbitMQ，因此对应的是出站适配器。

同一个订单模块可以组织为：

```text
order
  ├── domain
  │   ├── event
  │   ├── model
  │   └── service
  │
  ├── application
  │   ├── port
  │   │   ├── in                         # 应用提供的用例
  │   │   └── out                        # 应用需要的外部能力
  │   └── service                        # 用例实现与编排
  │
  └── adapter
      ├── in
      │   ├── messaging                  # 入站消息
      │   └── web                        # HTTP API
      └── out
          ├── messaging                  # 事件发布
          ├── persistence                # 数据库访问
          └── service                    # 外部服务调用
```

这种目录结构只是端口与适配器思想的一种表达。项目也可以使用 `northbound` 与 `southbound`、`primary` 与 `secondary`，或者继续采用传统分层命名。真正需要保持的是内部模型不依赖外部适配器。

六边形架构的一个直接收益是可替换性。同一个入站端口既可以由真实 Controller 调用，也可以由自动化测试直接驱动；同一个出站端口既可以连接生产数据库，也可以在测试中换成内存实现。核心用例因此能够脱离 UI 和数据库独立运行。

## 06. 从目录结构回到依赖方向

分层架构与六边形架构并不是互斥方案。前者有助于区分用户界面、应用、领域和基础设施的抽象层次；后者有助于识别驱动应用的一侧和被应用驱动的一侧。一个系统完全可以同时使用两种视角。

判断架构是否真正保护了领域模型，可以检查几个问题：

- 领域对象能否在不启动 Web 框架和数据库的情况下执行核心规则？
- 应用服务表达的是业务用例，还是堆积了实体本应承担的规则？
- 资源库接口是否面向聚合和业务需求，而不是照搬 ORM API？
- 外部系统的 DTO 是否直接渗入领域模型？
- 更换数据库、消息中间件或远程客户端时，核心业务代码是否需要同步修改？
- 目录之间的源码依赖是否与团队宣称的架构一致？

当外部系统拥有一套与本地模型不兼容的语言时，可以引入**防腐层**（Anticorruption Layer，ACL）完成转换。防腐层可能由适配器、转换器和门面共同组成，用本地语言封装外部模型，避免外部概念污染内部上下文。

防腐层不是基础设施层的同义词。基础设施层还包含数据库、消息和系统配置等大量技术实现；防腐层特指两个模型边界之间的翻译与隔离机制。它通常位于外部集成相关的适配器中，但其设计依据来自上下文之间的模型关系。

架构也不是层数越多越好。对于业务规则很少的应用，过度拆分接口、DTO、装配器和适配器，只会增加理解和维护成本。架构的价值在于约束变化，而不在于制造文件。

## 07. 小结

DDD 提供领域建模的方法，架构则为模型建立保护结构。

分层架构通过职责层次区分用例、业务规则和技术实现；六边形架构通过端口与适配器区分应用内部与外部世界；依赖倒置让核心代码声明所需抽象，并由外围实现这些抽象。

目录名称、框架注解和六边形图都只是结构的外在表现。真正的梁柱是清晰的职责、稳定的边界和朝向核心的依赖方向。只有这些约束真实存在，领域模型才不会在一次次技术更换和需求迭代中逐渐被侵蚀。

## 引用

1.  《领域驱动设计——软件核心复杂性应对之道》（Eric Evans 著，人民邮电出版社）
2.  《实现领域驱动设计》（Vaughn Vernon 著，电子工业出版社）
3.  《解构领域驱动设计》（张逸 著，人民邮电出版社）
4.  [《Hexagonal Architecture》](https://alistair.cockburn.us/hexagonal-architecture/)（Alistair Cockburn）
