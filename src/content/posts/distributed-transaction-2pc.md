---
title: "分布式事务之二阶段提交"
published: 2025-11-30
updated: 2026-03-17
description: "01.什么是分布式事务？ 在单体系统中，一次业务操作通常只涉及一个数据库节点，本地事务即可通过 ACID（原子性、一致性、隔离性、持久性）确保数据正确性。但随着系统拆分为微服务、数据分片、读写分离、多数据库架构等分布式模式，同一个业务操作往往涉及多个节点的资源操作。这时，本地事务不再能够保证全局一致性，就需要“分布式事务”。 分布式事务（Distribute"
image: ""
tags: ["distributed transaction", "分布式事务"]
category: "分布式事务"
draft: false
lang: "zh_CN"
---
> 二人同心，其利断金
>
> — ——《易传·系辞传上》

## 01.什么是分布式事务？

在单体系统中，一次业务操作通常只涉及一个数据库节点，本地事务即可通过 ACID（原子性、一致性、隔离性、持久性）确保数据正确性。但随着系统拆分为微服务、数据分片、读写分离、多数据库架构等分布式模式，同一个业务操作往往涉及多个节点的资源操作。这时，本地事务不再能够保证全局一致性，就需要“分布式事务”。

分布式事务（Distributed Transaction）是指：

一个逻辑事务涉及多个分布在不同节点上的资源，这些资源由各自的资源管理器（RM）管理，但需要在事务协调器（TM）的统一协调下，整体满足事务的原子性和一致性。

**典型例子：跨银行转账**

假设账户 A 在银行 X，账户 B 在银行 Y，需要完成转账：

-   银行 X 扣款 A - 100

-   银行 Y 加款 B + 100


两个操作不在同一数据库中，不能使用单节点本地事务保证一致性。一旦任意一方成功而另一方失败，数据就不一致。

为解决这种问题，就需要分布式事务协议。

常见的分布式事务有2PC、TCC和SAGA。下文先只讨论2PC。

## 02.2PC/XA规范

**2PC/XA（Two-Phase Commit）** 是最典型、也是最经典的强一致性分布式事务协议。
它通过一个**中心化的协调器（Coordinator / TM）**，统一控制多个参与者（Participants / RM）的提交过程。

-   **准备阶段**：又叫作投票阶段，在这一阶段，协调者询问事务的所有参与者是否准备好提交，参与者如果已经准备好提交则回复 Prepared，否则回复 Non-Prepared。
-   **提交阶段**：又叫作执行阶段，协调者如果在上一阶段收到所有事务参与者回复的 Prepared 消息，则先自己在本地持久化事务状态为 Commit，在此操作完成后向所有参与者发送 Commit 指令，所有参与者立即执行提交操作；否则，任意一个参与者回复了 Non-Prepared 消息，或任意一个参与者超时未回复，协调者将自己的事务状态持久化为 Abort 之后，向所有参与者发送 Abort 指令，参与者立即执行回滚操作。

以上这两个过程被称为“[两段式提交](https://zh.wikipedia.org/wiki/%E4%BA%8C%E9%98%B6%E6%AE%B5%E6%8F%90%E4%BA%A4)”（2 Phase Commit，2PC）协议，而它能够成功保证一致性还需要一些其他前提条件。

-   必须假设网络在提交阶段的短时间内是可靠的，即提交阶段不会丢失消息。同时也假设网络通信在全过程都不会出现误差，即可以丢失消息，但不会传递错误的消息，XA 的设计目标并不是解决诸如[拜占庭将军](https://en.wikipedia.org/wiki/Byzantine_fault)一类的问题。两段式提交中投票阶段失败了可以补救（回滚），而提交阶段失败了无法补救。
-   必须假设因为网络分区、机器崩溃或者其他原因而导致失联的节点最终能够恢复，不会永久性地处于失联状态。由于在准备阶段已经写入了完整的重做日志，所以当失联机器一旦恢复，就能够从日志中找出已准备妥当但并未提交的事务数据，并向协调者查询该事务的状态，确定下一步应该进行提交还是回滚操作。

两段式提交原理简单，但有几个非常显著的缺点：

-   **单点问题**：一旦协调者出现问题，会影响到所有参与者。
-   **性能问题**：两段提交过程中，所有参与者相当于被绑定成为一个统一调度的整体，期间要经过两次远程服务调用，三次数据持久化（准备阶段写重做日志，协调者做状态持久化，提交阶段在日志写入 Commit Record），整个过程将持续到参与者集群中最慢的那一个处理操作结束为止，这决定了两段式提交的性能通常都较差。
-   **一致性风险**：前面已经提到，两段式提交的成立是有前提条件的，当网络稳定性和宕机恢复能力的假设不成立时，仍可能出现一致性问题。

## 03.使用2PC实现一个简单的分布式事务

下面是一个基于2PC模型使用 PostgreSQL 原生 `PREPARE TRANSACTION` 模拟上面的转账场景的Java代码示例：

```java
import java.sql.*;
import java.util.UUID;

public class Postgres2PCDemo {

    public static void main(String[] args) throws Exception {

        String url1 = "jdbc:postgresql://localhost:5432/db1";
        String url2 = "jdbc:postgresql://localhost:5432/db2";

        Connection c1 = DriverManager.getConnection(url1, "user1", "pass1");
        Connection c2 = DriverManager.getConnection(url2, "user2", "pass2");

        c1.setAutoCommit(false);
        c2.setAutoCommit(false);

        String xid = UUID.randomUUID().toString();

        try {
            // 参与者1：扣款
            c1.createStatement().executeUpdate(
                "UPDATE account SET balance = balance - 100 WHERE id = 1"
            );

            // 参与者2：加款
            c2.createStatement().executeUpdate(
                "UPDATE account SET balance = balance + 100 WHERE id = 2"
            );

            // 阶段1：Prepare
            c1.createStatement().execute("PREPARE TRANSACTION '" + xid + "-p1'");
            c2.createStatement().execute("PREPARE TRANSACTION '" + xid + "-p2'");

            // 阶段2：Commit（协调器决策成功）
            c1.createStatement().execute("COMMIT PREPARED '" + xid + "-p1'");
            c2.createStatement().execute("COMMIT PREPARED '" + xid + "-p2'");

            System.out.println("Global 2PC commit success!");

        } catch (Exception e) {
            System.out.println("Error, global rollback");

            // 回滚已 prepare 的事务
            try {
                c1.createStatement().execute("ROLLBACK PREPARED '" + xid + "-p1'");
            } catch (Exception ignore) {}
            try {
                c2.createStatement().execute("ROLLBACK PREPARED '" + xid + "-p2'");
            } catch (Exception ignore) {}

            throw e;
        }
    }
}
```

## 04.2PC的适用场景

从 XA 规范的定义来看，分布式事务的核心要素只有三个：事务协调器（TM）、资源管理器（RM）以及它们之间的标准交互接口。只要多个资源能够被同一个事务协调器统一调度，并且各自实现了 XA 接口，它们就具备参与同一个全局事务的技术前提。至于这些资源是否属于同一个服务、是否运行在同一个进程，规范本身并不关心。

也正因为如此，从理论上讲，XA / 2PC 可以覆盖的范围非常宽：它既可以用于单个服务内部协调多个数据库实例，也可以用于跨进程、跨机器，甚至跨系统的资源一致性控制。

然而，当我们从规范走向工程实践时，问题的重心就发生了变化。

在实际系统中，2PC 的核心代价并不在于协议本身的复杂度，而在于它对**同步性和可靠性的极端依赖**。在 2PC 的执行过程中，所有参与者在完成 Prepare 之后，必须持有本地事务锁并等待协调器的最终决策。这种“先锁定、再统一决策”的模式，在网络稳定、节点可靠的前提下是可控的，但一旦引入更多的网络边界和独立故障域，风险就会被迅速放大。

正是基于这一现实，XA / 2PC 在工程中最常见、也最成熟的使用方式，逐渐收敛到了**单服务（单进程）内的多数据源事务**场景中。在这种模式下，事务协调器通常与业务代码运行在同一个 JVM 进程中，参与事务的数据库实例位于相对稳定的网络环境中。事务的生命周期短、失败模型清晰，即使出现异常，也更容易通过日志和人工介入进行恢复。

而一旦将 XA / 2PC 扩展到多个服务之间，情况就会明显复杂化。跨服务意味着更多的网络调用、更长的事务链路，也意味着更高概率的超时、重试和部分失败。在这种情况下，任何一个服务节点的性能抖动，都可能导致整个全局事务长时间处于 Prepare 状态，资源被持续锁定，最终影响系统整体吞吐能力。

更重要的是，这种做法在架构层面会弱化服务边界的意义。多个服务为了完成一次事务，被迫在同一个全局事务上下文中协同工作，服务之间不再是松耦合的调用关系，而是被绑定在一个强一致性的执行链路上。这与微服务架构追求的“独立部署、独立扩展、局部失败可隔离”的目标是明显冲突的。

因此，在现代系统设计中，尽管 XA / 2PC 在技术上仍然可以用于跨服务场景，但在工程上已经很少被视为一个合理的选择。对于跨服务的一致性问题，业界更倾向于通过 Saga、TCC 或基于消息的最终一致性方案来解决，以换取更好的可用性和扩展性。

综合来看，可以将 XA / 2PC 的适用边界理解为：**它是一种非常可靠、但也非常“重”的一致性工具**。当事务参与方数量有限、网络环境可控、并且业务对强一致性有明确要求时，它依然是一个合理且成熟的选择；而一旦事务跨越了服务边界，协调成本和风险往往会迅速超过它所带来的收益。

## 引用

1.  周志明[《凤凰架构》](https://icyfenix.cn/architect-perspective/general-architecture/transaction/global.html)
