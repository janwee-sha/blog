---
title: "在RabbitMQ中实现延迟消息"
published: 2023-12-08
updated: 2024-01-23
description: "1\\. 在RabbitMQ中实现延迟消息的方式 使用消息中间件实现延迟消息在程序开发中是一个很常见的需求。如果你使用的是RabbitMQ作为消息中间件的话，很不幸，它并没有提供原生的延迟消息机制。好消息是我们可以通过一些技术手段来实现延迟消息的效果。常见的实现方式有如下两种： 使用RabbitMQ的死信队列（Dead Letter Exchange）和TTL"
image: ""
tags: ["RabbitMQ", "延迟消息"]
category: "消息中间件"
draft: false
lang: "zh_CN"
---
## 1\. 在RabbitMQ中实现延迟消息的方式

使用消息中间件实现延迟消息在程序开发中是一个很常见的需求。如果你使用的是RabbitMQ作为消息中间件的话，很不幸，它并没有提供原生的延迟消息机制。好消息是我们可以通过一些技术手段来实现延迟消息的效果。常见的实现方式有如下两种：

-   使用RabbitMQ的死信队列（Dead Letter Exchange）和TTL（Time-To-Live）来模拟延迟队列

-   使用RabbitMQ Delayed Message插件（本质上是RabbitMQ基于前一种方式提供的开箱即用的插件）

## 2\. 结合DLX和TTL模拟延迟队列

死信队列和TTL结合的方案的原理是：消息会先发送到主队列，但是由于设置了TTL，如果消息在指定的时间内没有被消费，则会变成死信，进入死信队列。死信队列再绑定到实际需要接收延迟消息的队列，从而实现了延迟队列的效果。

基于上述原理，我们使用 RabbitMQ 的 Java 客户端来模拟一个消息被发布后经过5秒才能被消费的延迟队列。

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

上述程序中，我们创建了一个主队列、一个Fanout类型的交换机以及绑定到该交换机的队列，主队列用于接收消息生产者发布的消息，Fanout类型的交换机为主队列的死信交换机。然后，我们向主队列发送10次以当前时间戳为消息体、TTL为5000毫秒的消息。

当消息发送到主队列后，由于没有被消费，5秒后消息会变成死信，被发送至队列的死信交换机并被路由至绑定到该死信交换机的队列。

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
            long startBy = System.currentTimeMillis();
            while (System.currentTimeMillis() - startBy < 30000) {
                channel.basicConsume(DELAYED_QUEUE, true, (tag, delivery) -> {
                    System.out.printf("[*] Delayed queue received message %s after %d milliseconds.\n",
                            delivery.getEnvelope().getDeliveryTag(),
                            (System.currentTimeMillis() - Long.parseLong(new String(delivery.getBody()))));
                }, tag -> {
                });
            }
        }
    }
}
```

在消费者类中，我们消费每一条来自延迟队列的消息并输出从消息被生产到消息被接收经过了多少时间。DelayedMessageConsumer类的输出应该和下面的示例类似：

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

可以看到每条消息从生产到消费都经过了至少5000毫秒。

## 引用

1.  [https://blog.rabbitmq.com/posts/2015/04/scheduling-messages-with-rabbitmq/](https://blog.rabbitmq.com/posts/2015/04/scheduling-messages-with-rabbitmq/)
