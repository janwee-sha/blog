---
title: "使用令牌桶模式实现一个简单的流量控制器"
published: 2023-04-26
updated: 2024-01-27
description: "介绍令牌桶限流的基本思路，并通过 Java 示例演示一个简单流量控制器的实现与测试方式。"
image: ""
tags: ["令牌桶", "流量控制"]
category: "系统架构"
draft: true
lang: "zh_CN"
---
> 知止而后有定
>
> ——《礼记·大学》

## 01. 简介

流量控制是一种在流量超出系统承载能力时保护系统的机制。令牌桶模式与漏桶一样，都是基于缓冲区的限流算法。令牌以固定速率加入桶中，代表流量可以通过的凭据。当请求到达时，系统会先检查桶中是否有足够的令牌；如果有，就消费相应数量的令牌并放行请求，否则执行降级处理。

## 02. Java 实现

```java
public class TokenBucketRateLimiter {
    private final long capacity;

    private final long ratesPerSecond;

    private long availableTokens;
    private long lastRefilledTime;

    public TokenBucketRateLimiter(long ratesPerSecond) {
        this(100, ratesPerSecond);
    }

    public TokenBucketRateLimiter(long capacity, long ratesPerSecond) {
        this.capacity = capacity;
        this.ratesPerSecond = ratesPerSecond;
    }

    public synchronized boolean tryConsume() {
        refillTokens();
        if (availableTokens > 0) {
            availableTokens--;
            return true;
        } else return false;
    }

    private void refillTokens() {
        long now = System.currentTimeMillis();
        if (lastRefilledTime == 0) {
            availableTokens = ratesPerSecond;
            lastRefilledTime = now;
        } else if (now > lastRefilledTime) {
            long elapsedMillis = now - lastRefilledTime;
            long tokensToFill = elapsedMillis / 1000 * ratesPerSecond;
            availableTokens = Math.min(capacity, availableTokens + tokensToFill);
            lastRefilledTime = now;
        }
    }
}
```

每次请求时（这里使用 Java 中的线程执行任务来表示请求）调用 `tryConsume`，确定是否符合流量控制的规则。

测试代码如下：

```java
static final ThreadPoolExecutor exec = new ThreadPoolExecutor(16, 16, 0,
            TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>(84),
            new ThreadPoolExecutor.AbortPolicy());
static int num = 0;
public static void main(String[] args) throws InterruptedException {
    TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(100, 2);
    while (true){
        for (int i = 0; i < 100; i++) {
            if (limiter.tryConsume()) {
                exec.execute(() -> System.out.println(++num));
            }
        }
        TimeUnit.SECONDS.sleep(1);
    }
}
```

测试代码中我们将流量控制速率设置为 2 QPS，从方法输出结果可以看出，每秒会打印两个连续递增的 `num` 值。
