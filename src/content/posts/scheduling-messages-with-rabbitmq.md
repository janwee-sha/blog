---
title: "在 RabbitMQ 中实现延迟消息"
published: 2023-12-08
updated: 2026-07-22
description: "介绍如何结合 RabbitMQ 的死信交换机（DLX）与消息 TTL 实现延迟消息，并通过 Java 客户端示例演示生产和消费流程。"
image: ""
tags: ["RabbitMQ", "延迟消息"]
category: "消息中间件"
draft: false
lang: "zh_CN"
---
> 君子藏器于身，待时而动
>
> ——《周易·系辞下》

## 01. 引言

在应用开发中，使用消息中间件实现延迟消息是一项常见需求。开源版 RabbitMQ 本身没有通用的原生延迟消息机制，常见做法是结合死信交换机（Dead Letter Exchange，DLX）和 TTL（Time-To-Live）模拟延迟队列。

RabbitMQ Delayed Message 插件曾提供 `x-delayed-message` 交换机，但该项目已于 2026 年停止维护，不再适合新项目。RabbitMQ 团队目前建议根据场景选择 DLX 与 TTL、VMware Tanzu RabbitMQ 的 delayed queues 或外部调度器。

## 02. 结合 DLX 和 TTL 模拟延迟队列

DLX 与 TTL 结合方案的原理是：消息先进入入口队列；消息到期后成为死信，由该队列配置的死信交换机重新发布并路由到实际消费延迟消息的队列，从而实现延迟效果。

基于上述原理，我们使用 RabbitMQ 的 Java 客户端来模拟一个消息被发布后经过 5 秒才能被消费的延迟队列。

首先编写一个消息生产者的程序：

```java
public class DelayedMessageProducer {
    private static final String ENTRANCE_QUEUE = "entrance.queue";
    private static final String DELAYED_EXCHANGE = "delayed.exchange";
    private static final String DELAYED_QUEUE = "delayed.queue";
    private static final long MSG_TTL = 5000;

    public static void main(String[] args) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        try (Connection connection = factory.newConnection();
             Channel channel = connection.createChannel()) {
            // 创建一个交换机并绑定到一个队列，用于接收延迟消息
            channel.exchangeDeclare(DELAYED_EXCHANGE, BuiltinExchangeType.FANOUT);
            channel.queueDeclare(DELAYED_QUEUE, false, false, false, null);
            channel.queueBind(DELAYED_QUEUE, DELAYED_EXCHANGE, "");

            // 创建另一个队列，用于接收生产者发布的消息，并设置该队列的死信交换机为上面定义的用于存放延迟消息的交换机
            Map<String, Object> arguments = new HashMap<>();
            arguments.put("x-dead-letter-exchange", DELAYED_EXCHANGE);
            channel.queueDeclare(ENTRANCE_QUEUE, false, false, false, arguments);

            // 发布带有TTL属性的消息至主队列
            AMQP.BasicProperties properties = new AMQP.BasicProperties.Builder()
                    .expiration(String.valueOf(MSG_TTL))
                    .build();
            for (int i = 0; i < 10; i++) {
                channel.basicPublish("", ENTRANCE_QUEUE, properties,
                        String.valueOf(System.currentTimeMillis()).getBytes());
            }
        }
    }
}
```

上述程序中，我们创建了一个主队列、一个 Fanout 类型的交换机以及绑定到该交换机的队列，主队列用于接收消息生产者发布的消息，Fanout 类型的交换机为主队列的死信交换机。然后，我们向主队列发送 10 条以当前时间戳为消息体、TTL 为 5000 毫秒的消息。

当消息发送到主队列后，由于没有被消费，5 秒后消息会变成死信，被发送至队列的死信交换机并被路由至绑定到该死信交换机的队列。

接着我们写一个消息消费者去消费绑定到死信交换机的队列里的消息：

```java
public class DelayedMessageConsumer {
    private static final String DELAYED_QUEUE = "delayed.queue";

    public static void main(String[] args) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        try (Connection connection = factory.newConnection();
             Channel channel = connection.createChannel()) {
            channel.queueDeclare(DELAYED_QUEUE, false, false, false, null);
            System.out.println("[*] Waiting for messages.");
            channel.basicConsume(DELAYED_QUEUE, true, (tag, delivery) -> {
                System.out.printf("[*] Delayed queue received message %s after %d milliseconds.\n",
                        delivery.getEnvelope().getDeliveryTag(),
                        (System.currentTimeMillis() - Long.parseLong(new String(delivery.getBody()))));
            }, tag -> {
            });
            Thread.sleep(30000);
        }
    }
}
```

在消费者类中，我们消费每一条来自延迟队列的消息并输出从消息被生产到消息被接收经过了多少时间。DelayedMessageConsumer 类的输出应该和下面的示例类似：

```text
[*] Waiting for messages.
[*] Delayed queue received message 1 after 5022 milliseconds.
[*] Delayed queue received message 2 after 5040 milliseconds.
[*] Delayed queue received message 3 after 5040 milliseconds.
[*] Delayed queue received message 4 after 5042 milliseconds.
[*] Delayed queue received message 5 after 5041 milliseconds.
[*] Delayed queue received message 6 after 5041 milliseconds.
[*] Delayed queue received message 7 after 5041 milliseconds.
[*] Delayed queue received message 8 after 5041 milliseconds.
[*] Delayed queue received message 9 after 5041 milliseconds.
[*] Delayed queue received message 10 after 5041 milliseconds.
```

可以看到每条消息从生产到消费都经过了至少 5000 毫秒。

需要注意的是，使用每条消息的 TTL 时，过期消息只有到达队首时才会被丢弃或死信化。因此，同一队列中混用不同 TTL 时，短 TTL 消息可能被前面的长 TTL 消息阻塞；这种方案更适合固定或有限档位的延迟场景。

## 引用

1.  [RabbitMQ：Time-To-Live and Expiration](https://www.rabbitmq.com/docs/ttl)
2.  [RabbitMQ：Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
3.  [Álvaro Videla：Scheduling Messages with RabbitMQ（2015-04-16）](https://www.rabbitmq.com/blog/2015/04/16/scheduling-messages-with-rabbitmq)
4.  [RabbitMQ Delayed Message Plugin（已停止维护）](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
