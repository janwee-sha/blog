---
title: "Java 线程池执行器的饱和策略"
published: 2023-04-24
updated: 2024-02-01
description: "简介 在 Java 程序中，当线程池 ThreadPoolExecutor 中的任务数超过最大线程数的阈值且工作队列已满时，线程池会根据线程池指定的饱和策略来处理新的任务。通过传递一个 RejectedExecutionHandler 类的实例给线程池模型 ThreadPoolExecutor 的构造器，我们可以修改 Java 中线程池执行器的饱和策略。 中"
image: ""
tags: ["Java", "线程池"]
category: "JAVA"
draft: false
lang: "zh_CN"
---
> 瀑布歌道：“我得到自由时便有歌声了。”

## 简介

在 Java 程序中，当线程池 ThreadPoolExecutor 中的任务数超过最大线程数的阈值且工作队列已满时，线程池会根据线程池指定的饱和策略来处理新的任务。通过传递一个 RejectedExecutionHandler 类的实例给线程池模型 ThreadPoolExecutor 的构造器，我们可以修改 Java 中线程池执行器的饱和策略。

## 中止策略（Abort Policy）

中止策略是线程池的默认策略。中止策略使执行器抛出一个 RejectedExecutionException 异常。

JDK 1.8 中的源码如下：

```java
public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
    throw new RejectedExecutionException("Task " + r.toString() +
                                         " rejected from " +
                                         e.toString());
}
```

测试执行器的中止策略：

```java
@Test
public void testAbort() {
    ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, MILLISECONDS,
            new SynchronousQueue<>(),
            new ThreadPoolExecutor.AbortPolicy());

    executor.execute(() -> waitFor(250));

    assertThatThrownBy(() -> executor.execute(() -> System.out.println("Will be " +
            "rejected")))
            .isInstanceOf(RejectedExecutionException.class);
    executor.shutdown();
}

private void waitFor(long milli) {
    try {
        MILLISECONDS.sleep(milli);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
}
```

在上面的测试中，我们创建了一个核心线程数及最大线程数都是 1 的线程池，并指定工作队列为同步式阻塞队列 SynchronousQueue（SynchronousQueue 队列的每一个插入操作都会阻塞至其他线程获取该插入的元素），并指定执行器的饱和策略为中止策略，然后提交两个任务，提交第二个任务时由于第一个任务使线程睡眠 250 毫秒（ waitFor() 方法让线程睡眠给定毫秒数）且由于工作队列中没有其他线程，中止策略将会拒绝第二个任务的执行并返回 RejectedExecutionException 异常。

## 调度者运行策略（Caller-Runs Policy）

该策略使调度者线程自己执行该任务。

JDK 1.8 中的源码如下：

```text
public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
    if (!e.isShutdown()) {
        r.run();
    }
}
```

测试执行器的调度者运行策略：

```java
@Test
public void testCallerRuns() {
    ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, MILLISECONDS,
            new SynchronousQueue<>(),
            new ThreadPoolExecutor.CallerRunsPolicy());

    executor.execute(() -> waitFor(250));

    StringBuilder runningThreadName = new StringBuilder();
    executor.execute(() -> {
        runningThreadName.append(Thread.currentThread().getName());
        waitFor(500);
    });
    assertThat(runningThreadName.toString()).isEqualTo(Thread.currentThread().getName());
    executor.shutdown();
}
```

测试方法和上述中止策略的测试方法一样，创建了一个核心线程数及最大线程数都是 1 的线程池，并指定工作队列为同步式阻塞队列，这一次我们指定线程池饱和策略为调度者运行，和中止策略中的情形类似，提交的两个任务中第二个任务没有对应的线程执行，此时执行器会让调度者线程（即测试方法中的主线程）执行该任务。

## 丢弃策略（Discard Policy）

该策略在新任务提交失败时静默地丢弃新任务。

JDK 1.8 中的源码如下：

```text
public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
}
```

测试丢弃策略：

```java
@Test
public void testDiscard() throws InterruptedException {
    ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, MILLISECONDS,
            new SynchronousQueue<>(),
            new ThreadPoolExecutor.DiscardPolicy());

    executor.execute(() -> waitFor(100));

    BlockingQueue<String> queue = new LinkedBlockingDeque<>();
    executor.execute(() -> queue.offer("Discarded Result"));

    assertThat(queue.poll(200, MILLISECONDS)).isNull();
    executor.shutdown();
}
```

线程池的属性除饱和策略为丢弃策略外其他属性都和前面一样，提交两个任务，第二个任务向一个队列中插入字符串，但由于新任务会被执行器静默地拒绝，队列为空。

## 丢弃最老任务策略（Discard-Oldest Policy）

该策略先删除队列头中的任务，再重新提交新任务。

JDK 1.8 中的源码如下：

```java
public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
    if (!e.isShutdown()) {
        e.getQueue().poll();
        e.execute(r);
    }
}
```

测试丢弃最老任务策略：

```java
@Test
public void testDiscardOldest() throws InterruptedException {
    ThreadPoolExecutor executor = new ThreadPoolExecutor(1, 1, 0, MILLISECONDS,
            new ArrayBlockingQueue<>(2),
            new ThreadPoolExecutor.DiscardOldestPolicy());
    BlockingQueue<Integer> queue = new LinkedBlockingDeque<>();
    executor.execute(() -> queue.offer(1));
    executor.execute(() -> queue.offer(2));
    executor.execute(() -> queue.offer(3));

    assertThat(queue).contains(2, 3);
    executor.shutdown();
}
```

这一次我们创建一个核心线程数和最大线程数都为 1，工作队列为一个初始容量为 2 的阻塞队列，指定线程池饱和策略为丢弃最老任务，然后向线程池提交向本地队列分别插入整数 1、2、3 的任务，提交第三个任务时线程饱和并丢弃最老的任务（即向队列插入 1 的任务）放入新任务，因此队列最终会被插入 2 和 3。
