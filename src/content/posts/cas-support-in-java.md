---
title: "Java的CAS机制"
published: 2023-04-24
updated: 2024-01-09
description: "参考 Brain Goetz 《Java并发编程实战》 Baeldung 社区 CAS是什么？ CAS是避免使用锁的基本机制之一。 CAS的原理是变量只在线程内的与从主存中获取的值相等时更新，且获取与更新是一个原子操作。整个操作不需要使用锁。 其中最重要的事是硬件必须支持CAS，以使其是一个真正的原子操作而且不需要使用锁。 Java 5.0引入了对CAS的底"
image: ""
tags: ["CAS", "Java"]
category: "JAVA"
draft: false
lang: "zh_CN"
---
## 参考

-   [Brain Goetz 《Java并发编程实战》](https://www.amazon.com/Java-Concurrency-Practice-Brian-Goetz/dp/0321349601)
-   [Baeldung 社区](https://www.baeldung.com/lock-free-programming)

## CAS是什么？

CAS是避免使用锁的基本机制之一。

CAS的原理是变量只在线程内的与从主存中获取的值相等时更新，且获取与更新是一个原子操作。整个操作不需要使用锁。

其中最重要的事是硬件必须支持CAS，以使其是一个真正的原子操作而且不需要使用锁。

Java 5.0引入了对CAS的底层支持，在 int、long 和对象的引用等类型上都公开了CAS操作，并且JVM把他们编译为底层硬件提供的最有效的方法。在支持CAS的平台上，运行时把它们编译为相应的指令。在不支持的平台上，那么JVM将使用自旋锁。在原子变量类中使用了这些底层的JVM支持为数字类型和引用类型提供一种高效的CAS操作.

原子变量将发生竞争的范围缩小到单个变量上，这是粒度最细的情况。更新原子变量的在非竞争的情况下不会比获取锁的非竞争情况慢，而它的竞争情况肯定比锁的竞争情况快，因为它不需要挂起和重新调度线程。

原子变量相当于一种泛化的 volatile 变量。

常用的原子变量有 AtomicInteger、AtomicLong、AtomicBoolean 以及 AtomicRefernce。

所有原子变量都支持CAS，此外 AtomicInteger和 AtomicLong 还支持算术运算。

## 应用场景

下面的代码是一个基于支持CAS操作的 AtomicInteger 实现的计数器：

```java
public class SafeCounterWithoutLock {
    private final AtomicInteger counter = new AtomicInteger(0);
    public int count() {
        return counter.get();
    }
    public void increment() {
        counter.incrementAndGet();
    }
}
```

测试：

```java
private static final int N_TASKS = 1000;
private static final ExecutorService EXEC = Executors.newFixedThreadPool(9);
@Test
public void test() throws InterruptedException {
    SafeCounterWithoutLock counter = new SafeCounterWithoutLock();
    CountDownLatch latch = new CountDownLatch(N_TASKS);
    Runnable runnable = () -> {
        counter.increment();
        latch.countDown();
    };
    for (int i = 0; i < N_TASKS; i++) {
        EXEC.submit(runnable);
    }
    latch.await();
    assertEquals(N_TASKS, counter.count());
    EXEC.shutdown();
}
```
