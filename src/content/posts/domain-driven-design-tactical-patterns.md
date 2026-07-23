---
title: "领域驱动设计杂谈（二）：DDD 大厦的砖瓦"
published: 2026-06-03
description: "介绍领域驱动设计中的实体、值对象、聚合、资源库、领域服务和领域事件，并结合 Java 示例说明其职责与协作方式。"
image: ""
tags: ["领域驱动设计"]
category: "设计模式"
draft: false
lang: "zh_CN"
---
> 合抱之木，生于毫末；九层之台，起于累土
>
> ——《老子·第六十四章》

## 01. 砖瓦如何构成领域模型

战略设计帮助我们识别业务问题和模型边界，战术设计则帮助我们在边界内部构建模型。实体、值对象、聚合、资源库、领域服务和领域事件，是 DDD 中最常见的一组战术设计模式。

如果把一个采用 DDD 的系统比作一座大厦，这些模式就像大厦的一砖一瓦。砖瓦本身不是建筑的目的，但它们的形状、职责和组合方式会决定模型是否稳固。

战术模式也不是一份必须逐项采用的清单。一个简单模型可能只需要少量值对象和实体；只有当业务规则确实要求维护一致性边界时，才需要聚合；只有当领域中发生的事实值得其他参与者感知时，才需要领域事件。

选择这些模式的依据始终应该是业务语义，而不是为了让目录看起来像 DDD。

## 02. 实体

**实体**（Entity）是由身份而非属性定义的领域对象。只要身份没有改变，即使它的状态在生命周期中不断变化，它仍然是同一个对象。

订单是一个典型例子。订单可以从“待支付”变成“已支付”“已发货”或“已取消”，收货地址也可能发生变更，但只要订单 ID 不变，它始终代表同一笔业务交易。

一个设计良好的实体通常包含三类内容：

- 身份标识
- 当前状态
- 能够维护业务规则的领域行为

身份标识可以由系统生成，也可以来自业务中天然稳定的编号。关键不在于 ID 是否包含丰富信息，而在于它能否在实体的整个生命周期中保持稳定。把渠道、日期、状态等易变信息全部编码进 ID，反而可能让标识承担不必要的业务含义。

以图书模型为例：

```java
package com.example.bookstore.book.domain.model;

public class Book {
    private final BookId id;
    private String name;
    private Price price;
    private final LocalDate publishedAt;
    private AuthorId authorId;

    public Book(
            BookId id,
            String name,
            Price price,
            LocalDate publishedAt,
            AuthorId authorId) {
        this.id = Objects.requireNonNull(id);
        renameTo(name);
        changePriceTo(price);
        this.publishedAt = Objects.requireNonNull(publishedAt);
        this.authorId = Objects.requireNonNull(authorId);
    }

    public void renameTo(String newName) {
        if (newName == null || newName.isBlank()) {
            throw new IllegalArgumentException("Book name must not be blank.");
        }
        this.name = newName;
    }

    public void changePriceTo(Price newPrice) {
        this.price = Objects.requireNonNull(newPrice);
    }

    public void changeAuthorTo(AuthorId newAuthorId) {
        this.authorId = Objects.requireNonNull(newAuthorId);
    }

    public AuthorId authorId() {
        return authorId;
    }
}
```

很多面向对象语言的程序员习惯给实体堆砌属性，再生成一组 `getter` 和 `setter`。每当需要变更实体状态时，外部 Service 读取若干字段、执行判断，然后直接写回新值。这样的对象只是数据容器，通常被称为“贫血对象”。

DDD 更鼓励通过实体的行为表达业务意图。`renameTo(newName)` 与 `changePriceTo(newPrice)` 不只是比 `setName` 和 `setPrice` 更好听；它们为业务动作提供了明确入口，也让实体有机会在状态变更前维护自己的规则。

实体行为改变的是内存中的领域状态。至于何时开启事务、如何把状态保存到数据库、是否发送消息，则不应该由实体直接决定。

## 03. 值对象

与实体不同，**值对象**（Value Object）没有独立身份，其意义完全由属性值决定。两个值对象只要各项属性相等，就可以视为等价。

值对象通常具有以下特点：

- 没有需要跟踪的身份。
- 创建后保持不变。
- 通过整体替换而不是逐个修改字段来表达变化。
- 可以在自身内部维护与这个值有关的规则。

如果我们只关心一个对象“是什么”，而不关心它“是哪一个”，通常应优先考虑值对象。因为值对象不需要管理身份和生命周期，往往比实体更容易理解和维护。

在图书模型中，价格由币种和金额共同决定，适合建模为值对象：

```java
package com.example.bookstore.book.domain.model;

public final class Price {
    private final Currency currency;
    private final BigDecimal amount;

    private Price(Currency currency, BigDecimal amount) {
        this.currency = Objects.requireNonNull(currency);
        this.amount = Objects.requireNonNull(amount);
    }

    public static Price of(Currency currency, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Price must not be negative.");
        }
        return new Price(currency, amount);
    }

    public Price add(Price other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "Cannot add prices in different currencies."
            );
        }
        return new Price(currency, amount.add(other.amount));
    }

    public Currency currency() {
        return currency;
    }

    public BigDecimal amount() {
        return amount;
    }

    @Override
    public boolean equals(Object object) {
        if (!(object instanceof Price other)) {
            return false;
        }
        return currency.equals(other.currency)
                && amount.compareTo(other.amount) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(currency, amount.stripTrailingZeros());
    }
}
```

`Price` 没有提供修改金额的方法。价格相加会产生一个新的 `Price`，原对象保持不变。这使它更容易共享和测试，也避免某个调用者的修改意外影响其他对象。

值对象还可以让原本含义模糊的基本类型获得领域语义。与其让多个方法都接收 `Long`，不如分别使用 `BookId`、`AuthorId` 和 `OrderId`。即使它们在底层都包装一个数值，类型系统也能阻止调用者把作者 ID 错当成图书 ID。

## 04. 聚合与聚合根

对象之间必然存在关系，但并不是所有有关联的对象都应该互相持有引用，更不应该在一次事务中被随意修改。**聚合**（Aggregate）用于划定业务规则和一致性的边界。

一个聚合包含一个**聚合根**（Aggregate Root），以及只能通过聚合根访问和修改的内部对象。聚合外部的调用者只引用聚合根，不绕过它直接改变内部成员。

以订单为例，订单和订单项可以组成一个聚合，其中订单是聚合根。订单项的数量会影响订单总额，因此修改订单项必须经过订单：

```java
package com.example.bookstore.book.domain.model;

public class Order {
    private final OrderId id;
    private final List<OrderItem> items = new ArrayList<>();

    public Order(OrderId id) {
        this.id = id;
    }

    public void changeItemQuantity(OrderItemId itemId, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException(
                    "Quantity must be greater than zero."
            );
        }

        OrderItem item = items.stream()
                .filter(candidate -> candidate.id().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new OrderItemNotFoundException(itemId));

        item.changeQuantityTo(quantity);
        recalculateTotalPrice();
    }

    private void recalculateTotalPrice() {
        // 根据所有订单项重新计算订单总额。
    }
}
```

外部对象不能取得可变的订单项集合后自行修改数量，否则订单就无法保证总额、折扣和状态等规则始终一致。

聚合边界通常也是事务一致性边界：一次事务只保证一个聚合内部的强一致性。不同聚合之间的协作更适合使用身份标识、领域服务或领域事件，而不是建立庞大的对象图并试图一次性保存。

例如，`Book` 与 `Author` 即使关系密切，也未必属于同一个聚合。图书只需要保存 `AuthorId`：

```java
package com.example.bookstore.book.domain.model;

public class Book {
    private AuthorId authorId;

    public void changeAuthorTo(AuthorId newAuthorId) {
        if (newAuthorId == null) {
            throw new IllegalArgumentException("Author ID must not be null.");
        }
        this.authorId = newAuthorId;
    }
}
```

这里的身份标识引用恰恰说明 `Book` 和 `Author` 可以独立维护生命周期。判断某位作者是否存在，或者是否允许为图书署名，可以由聚合外部的协作机制完成。

聚合不是越大越完整。过大的聚合会增加并发冲突和事务成本；过小的聚合又可能无法在边界内部维护真正的业务不变量。划分聚合时，首先应该问“哪些规则必须在一次业务操作中保持一致”，而不是“哪些表之间存在外键”。

## 05. 资源库

**资源库**（Repository）是面向领域模型的持久化抽象。它让调用者像操作一个聚合集合那样获取和保存聚合，而不必知道数据库、ORM、SQL 或缓存的实现细节。

资源库通常面向聚合根设计。聚合内部对象的生命周期由聚合根管理，外部不应绕过聚合根为每个内部实体单独设计资源库。

在图书上下文中，可以定义：

```java
package com.example.bookstore.book.domain.repository;

public interface BookRepository {
    Optional<Book> findById(BookId id);

    void save(Book book);
}
```

这个接口表达的是领域模型需要的能力，没有暴露 JPA、数据库主键生成策略或逻辑删除字段等技术细节。依赖 Spring Data JPA 的实现位于基础设施层：

```java
package com.example.bookstore.book.infrastructure.persistence;

public class BookRepositoryJpaAdapter implements BookRepository {
    private final BookJpaRepository jpaRepo;
    private final BookPersistenceMapper mapper;

    public BookRepositoryJpaAdapter(
            BookJpaRepository jpaRepo,
            BookPersistenceMapper mapper
    ) {
        this.jpaRepo = jpaRepo;
        this.mapper = mapper;
    }

    @Override
    public Optional<Book> findById(BookId id) {
        return jpaRepo.findById(id.value())
                .map(mapper::toDomain);
    }

    @Override
    public void save(Book book) {
        jpaRepo.save(mapper.toPersistence(book));
    }
}
```

领域实体与持久化对象也可以分开定义：

```java
package com.example.bookstore.book.infrastructure.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "books")
public class BookPO {
    @Id
    private Long id;

    private String name;
    private String currency;
    private String amount;
    private Long authorId;

    protected BookPO() {
    }
}
```

`BookPersistenceMapper` 负责在 `Book` 和 `BookPO` 之间转换。这样，即使以后调整表结构或持久化技术，领域对象也不必被数据库映射方式牵着走。

并不是所有项目都必须把领域实体与持久化对象分开。如果模型简单、ORM 映射不会干扰领域行为，共用一个对象可能更经济。DDD 关心的是领域模型能否保持清晰，而不是要求每个实体都配套一个 PO 和装配器。

资源库的设计还要避免两个极端：一是把它设计成通用 CRUD 工具，导致领域语义完全消失；二是把复杂业务判断塞进资源库，使它承担本不属于持久化抽象的职责。

资源库回答“如何取得和保存聚合”，不替代领域对象作出业务决策。

## 06. 领域服务

大多数业务行为应该优先放在实体和值对象中，但有些规则天然涉及多个聚合，或者无法合理归属于某一个对象。此时可以使用**领域服务**（Domain Service）表达这项领域能力。

例如，发布图书前需要确认关联作者仍然有效。`Book` 本身无法知道其他聚合是否存在于资源库中，这项规则可以交给领域服务：

```java
package com.example.bookstore.book.domain.service;

import com.example.bookstore.book.domain.model.Book;
import com.example.bookstore.book.domain.repository.AuthorRepository;

public class BookPublicationPolicy {
    private final AuthorRepository authorRepo;

    public BookPublicationPolicy(AuthorRepository authorRepo) {
        this.authorRepo = authorRepo;
    }

    public void check(Book book) {
        if (!authorRepo.existsById(book.authorId())) {
            throw new UnavailableAuthorException(book.authorId());
        }
    }
}
```

领域服务属于领域模型，因此它的命名应该表达业务能力，并尽量避免依赖 Web、消息或 ORM 框架。`BookPublicationPolicy` 比含义宽泛的 `BookService` 更能说明它承担的职责。

领域服务也不同于**应用服务**。领域服务负责作出业务判断，应用服务则负责组织一个完整用例，例如加载聚合、调用领域行为、保存结果和发布事件。应用服务可以管理事务和权限，却不应成为业务规则的主要容器。

如果一项行为明显属于某个实体或值对象，就不应该为了追求“无状态”而把它搬到领域服务中。领域服务是对模型的补充，不是重新制造一个万能 Service 的借口。

## 07. 领域事件

**领域事件**（Domain Event）表示领域中已经发生、并且值得领域参与者关注的事实。

事件使用过去时命名。例如，“创建订单”是一个命令，而“订单已创建”是一个已经发生的事实，可以命名为 `OrderCreated`：

```java
package com.example.bookstore.order.domain.event;

public record OrderCreated(
        OrderId orderId,
        Instant occurredAt) implements DomainEvent {
}
```

领域事件一旦产生，就不应该再被修改。事件中只保留描述该事实所必需的信息，避免把整个可变聚合直接塞进事件。作为不变事实的领域事件可以参考值对象的定义要求，定义为不变类。

聚合可以在执行领域行为时记录事件：

```java
package com.example.bookstore.book.domain.model;

public class Order {
    private final List<DomainEvent> domainEvents = new ArrayList<>();

    public void markAsPaid(Instant paidAt) {
        if (!status.canPay()) {
            throw new IllegalOrderStatusException(status);
        }
        status = OrderStatus.PAID;
        domainEvents.add(new OrderPaid(id, paidAt));
    }
}
```

至于何时把事件交给消息系统，通常由应用层在事务边界附近处理，而不是由实体直接连接 RabbitMQ 或 Kafka。这样，领域模型只负责说明发生了什么，基础设施负责决定如何传递这个事实。

领域事件与集成事件也不必是同一个对象。领域事件服务于上下文内部的模型表达；当事件需要跨越限界上下文时，可以由应用层转换成稳定的集成契约，避免把内部模型直接暴露给外部。

领域事件不是为了把所有方法调用都异步化。只有当一个事实具有独立业务意义，或者多个参与者确实需要对它作出反应时，事件模型才会带来价值。

## 08. 小结

实体通过身份延续生命周期，值对象通过属性表达完整概念，聚合维护业务不变量和一致性边界。资源库让聚合摆脱持久化技术，领域服务承载无法自然归属于单个对象的业务规则，领域事件则表达模型中已经发生的重要事实。

这些模式共同提供了一套表达领域知识的词汇，但它们不是固定配方。真正重要的是让每个模型元素承担清晰职责，让业务规则尽可能靠近它所约束的数据，并让跨边界协作保持明确。

一堆精心命名的类并不会自动构成领域模型。只有当这些砖瓦按照业务规则组合起来，代码才真正开始表达业务。

## 引用

1.  《领域驱动设计——软件核心复杂性应对之道》（Eric Evans 著，人民邮电出版社）
2.  《实现领域驱动设计》（Vaughn Vernon 著，电子工业出版社）
3.  《解构领域驱动设计》（张逸 著，人民邮电出版社）
