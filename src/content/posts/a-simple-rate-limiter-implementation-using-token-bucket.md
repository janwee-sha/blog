---
title: "使用令牌桶模式实现一个简单的流量控制器"
published: 2023-04-26
updated: 2024-01-27
description: "简介 建立面对超额流量自我保护的机制，这个机制就是流量控制。令牌桶模式与漏桶一样都是基于缓冲区的限流算法。令牌代表流量是否允许通过的凭据，以固定的速率添加到桶中。当一个流量是否符合定义的限制时，会先检查桶中是否包含足够的令牌。如果是，就消费特定数量的令牌，流量被传递；否则就对流量进行降级处理。 Java 实现 每次请求时（这里使用 Java 中的线程执行一个任务表"
image: ""
tags: ["令牌桶", "流量控制"]
category: "系统架构"
draft: false
lang: "zh_CN"
---
> 樵夫的斧头，问树要斧柄。
> 树便给了他。

## 简介

建立面对超额流量自我保护的机制，这个机制就是流量控制。令牌桶模式与漏桶一样都是基于缓冲区的限流算法。令牌代表流量是否允许通过的凭据，以固定的速率添加到桶中。当一个流量是否符合定义的限制时，会先检查桶中是否包含足够的令牌。如果是，就消费特定数量的令牌，流量被传递；否则就对流量进行降级处理。

## Java 实现

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

每次请求时（这里使用 Java 中的线程执行一个任务表示）调用 tryConsume 确定是否符合流量控制的规则。

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

测试代码中我们将流量控制速率设置为了 2QPS，从方法输出结果可以看出每秒打印 num 的 2 个连续的递增结果。
