---
title: "Java 中的并发容器"
published: 2023-10-17
updated: 2024-02-04
description: "介绍 Java 同步容器在复合操作和迭代场景中的局限，并说明 ConcurrentMap、ConcurrentHashMap 等并发容器的线程安全、原子操作与内存一致性语义。"
image: ""
tags: ["Java", "并发容器"]
category: "Java"
draft: false
lang: "zh_CN"
---
> 和则一，一则多力，多力则强
>
> ——《荀子·王制》

## 01. 引言

Java 的同步容器通过串行化访问来保证线程安全，但这既不能自动保证复合操作的原子性，也会限制并发吞吐量。本文从这些问题出发，介绍 Java 并发容器及 `ConcurrentMap`、`ConcurrentHashMap` 的关键语义。

## 02. 同步容器类的问题

在 Java 中，同步容器主要包括两类：

-   `Vector`、`Stack`、`Hashtable`
-   `Collections` 类中的静态工厂方法所创建的类

这些类通过对每个公有方法都进行同步来实现线程安全。同步容器类是线程安全的，但在某些情况下可能需要额外的客户端加锁来保护复合操作（迭代、条件运算等）。

比如下面的两个方法：

```java
public static String getLast(Vector<String> vector) {
    return vector.get(vector.size() - 1);
}

public static void deleteLast(Vector<String> vector) {
    vector.remove(vector.size() - 1);
}
```

这两个方法都包含“获取容器大小”与“获取或删除元素”两个步骤。若其他线程在这两个步骤之间修改容器并使其缩小，方法就可能使用已经失效的索引，从而抛出 `ArrayIndexOutOfBoundsException`。

通过持有容器的锁，可以使 `getLast` 和 `deleteLast` 成为原子操作：

```java
public static String getLast(Vector<String> vector) {
    synchronized (vector) {
        return vector.get(vector.size() - 1);
    }
}

public static void deleteLast(Vector<String> vector) {
    synchronized (vector) {
        vector.remove(vector.size() - 1);
    }
}
```

再比如下面的代码：

```java
List<Integer> list = Collections.synchronizedList(
        new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5))
);
for (Integer num : list) {
    doSomething(num);
}
```

如果其他线程在迭代期间修改列表的结构，这段代码可能抛出 `ConcurrentModificationException`。按照同步集合的约定，要避免这个问题，就必须在整个迭代过程中持有列表的锁。

但这种将所有对容器状态的访问都串行化的方式会严重降低并发性。

## 03. 并发容器

Java 5 在 `java.util.concurrent` 包中引入了多种并发容器，以提高同步容器在高并发场景下的吞吐量。这些容器针对多线程并发访问设计。例如，`ConcurrentHashMap` 是 `ConcurrentMap` 的通用实现，为 `putIfAbsent`、条件删除和条件替换等复合操作提供原子语义。

`ConcurrentHashMap` 与 `HashMap` 一样基于哈希表，但它不会用一把锁串行化对整张表的所有访问。Java 7 及更早版本使用分段锁（lock striping）降低不同散列区域之间的竞争；自 Java 8 起，其内部实现改为节点数组与散列桶，空桶插入主要通过 CAS 完成，发生冲突的更新则通常锁定桶的首节点。读取操作通常不需要加锁，因此可以与更新操作并发执行。

`ConcurrentHashMap` 仍有一些折中之处。例如，当其他线程正在并发更新映射时，`size`、`isEmpty` 和 `containsValue` 等聚合状态方法反映的可能只是瞬时状态，适合监控或估算，不宜作为程序控制的依据。

`ConcurrentHashMap` 继承 `AbstractMap` 并实现 `ConcurrentMap` 接口；`ConcurrentMap` 则扩展了 `Map` 接口，为并发映射定义线程安全性与原子性保证。

从 Java 8 开始，`ConcurrentMap` 重写了多个 `Map` 的默认方法，以便实现类提供适用于并发环境的语义：

-   `getOrDefault`
-   `forEach`
-   `replaceAll`
-   `computeIfAbsent`
-   `computeIfPresent`
-   `compute`
-   `merge`

其中多种复合操作的默认实现假设映射不保存 `null` 值；如果某个 `ConcurrentMap` 实现允许 `null` 值，就必须重写相应方法。`ConcurrentHashMap` 自身则不允许使用 `null` 键或 `null` 值。

`ConcurrentMap` 还声明了以下原子操作，由实现类提供具体实现：

-   `putIfAbsent`
-   `remove(key, value)`
-   `replace(key, oldValue, newValue)`
-   `replace(key, value)`

`ConcurrentMap` 也为键和值的发布提供内存一致性保证：一个线程在将对象作为键或值放入映射之前的操作，`happens-before` 另一个线程随后访问该对象或将其从映射中移除之后的操作。

下面用重复执行的示例观察未同步 `HashMap` 可能出现的丢失更新。示例通过增加执行次数来提高竞态复现概率，但线程调度具有不确定性，因此它只用于观察现象，不把“必须出现错误结果”作为断言：

```java
public void observeHashMapParallelUpdates() throws Exception {
    Map<String, Integer> map = new HashMap<>();
    List<Integer> summed = parallelSum(map, 100);

    long distinctResultCount = summed.stream().distinct().count();
    long nWrongResult = summed.stream().filter(n -> n != 100).count();
    System.out.printf(
            "Distinct results: %d, unexpected results: %d%n",
            distinctResultCount,
            nWrongResult
    );
}

private List<Integer> parallelSum(Map<String, Integer> map, int executionTimes) throws InterruptedException {
    List<Integer> summed = new ArrayList<>(executionTimes);
    for (int i = 0; i < executionTimes; i++) {
        map.put("test", 0);
        ExecutorService executor = Executors.newFixedThreadPool(4);
        for (int j = 0; j < 10; j++) {
            executor.execute(() -> {
                for (int k = 0; k < 10; k++) {
                    map.computeIfPresent(
                            "test",
                            (key, value) -> value + 1
                    );
                }
            });
        }
        executor.shutdown();
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Executor did not terminate in time");
        }
        summed.add(map.get("test"));
    }
    return summed;
}
```

竞态复现时，多个线程会基于过期的当前值更新 `HashMap`，从而丢失部分增量并得到小于预期的结果；某次运行未观察到异常结果，也不能证明 `HashMap` 支持这种并发更新。

如果换成 `ConcurrentHashMap`，`computeIfPresent` 会为同一个键提供原子更新；只要所有任务都按预期完成，每轮结果就应为 100：

```java
@Test
public void givenConcurrentHashMapThenSumParallelShouldReturnExpectedResult() throws Exception {
    Map<String, Integer> map = new ConcurrentHashMap<>();
    List<Integer> summed = parallelSum(map, 100);

    assertThat(summed.stream().distinct().count()).isEqualTo(1);
    long nWrongResult = summed.stream().filter(n -> n != 100).count();
    assertThat(nWrongResult).isEqualTo(0);
}
```

其他并发容器还包括适合读多写少场景的 `CopyOnWriteArrayList`，以及非阻塞的 `ConcurrentLinkedQueue`。Java 6 还引入了 `ConcurrentSkipListMap` 和 `ConcurrentSkipListSet`，为需要排序的并发映射和集合提供实现。

## 引用

1.  《Java 并发编程实战》（Brian Goetz、Tim Peierls、Joshua Bloch、Joseph Bowbeer、David Holmes、Doug Lea 著，机械工业出版社）
2.  [Java Concurrency in Practice](https://jcip.net/)
3.  [ConcurrentHashMap（Java Platform SE 8）](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentHashMap.html)
4.  [ConcurrentMap（Java Platform SE 8）](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ConcurrentMap.html)
5.  [A Guide to ConcurrentMap](https://www.baeldung.com/java-concurrent-map)（Baeldung）
