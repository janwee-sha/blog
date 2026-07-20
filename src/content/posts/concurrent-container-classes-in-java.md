---
title: "Java中的并发容器"
published: 2023-10-17
updated: 2024-02-04
description: "1\\. 同步容器类的问题 在Java中，同步容器主要包括2类： Vector、Stack、HashTable Collections类中提供的静态工厂方法创建的类 这些类通过对每个公有方法都进行同步来实现线程安全。同步容器类是线程安全的，但在某些情况下可能需要额外的客户端加锁来保护复合操作（迭代、条件运算等）。 比如下面的两个方法： 两个方法都包含了获取容器"
image: ""
tags: ["Java", "并发容器"]
category: "JAVA"
draft: false
lang: "zh_CN"
---
## 1\. 同步容器类的问题

在Java中，同步容器主要包括2类：

-   Vector、Stack、HashTable
-   Collections类中提供的静态工厂方法创建的类

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

两个方法都包含了获取容器大小和获取/删除元素的复合操作。若在执行两个方法时在获取容器大小和获取/删除元素的操作之间其他线程对容器进行操作缩小了容器的大小，则两个方法将抛出 ArrayIndexOutOfBoundException 异常。

通过持有容器类的锁，可以使getLast和deleteLast成为原子操作：

```java
public static String getLast(Vector<String> vector) {
    synchronized (vector){
        return vector.get(vector.size() - 1);
    }
}

public static void deleteLast(Vector<String> vector) {
    synchronized (vector){
        vector.remove(vector.size() - 1);
    }
}
```

再比如下面的代码：

```java
List<Integer> list = Collections.synchronizedList(Arrays.asList(1, 2, 3, 4, 5));
for (Integer num : list) {
    doSomething(num);
}
```

这段代码中迭代的操作可能会出现ConcurrentModificationException异常，要想避免，就必须在迭代过程中持有容器的锁。

但这种将所有对容器状态的访问都串行化的方式会严重降低并发性。

## 2\. 并发容器

Java 5.0提供了多种并发容器来改进同步容器的性能。并发容器是针对多个线程并发访问设计的。如ConcurrentHashMap，用来替代同步且基于散列的Map，ConcurrentHashMap增加了对一些常见复合操作的支持，如“若没有则添加”、替换以及有条件删除等。

ConcurrentHashMap与HashMap一样是一个基于散列的Map，但它适用了一种粒度更细的加锁机制来实现更大程度的共享，这种机制被称为分段锁（Lock Striping）。一个ConcurrentHashMap中适用了一个包含16个锁的数组，每个锁保护所有散列桶的1/16，其中第N个桶由第（N mod 16）个锁来保护。ConcurrentHashMap在并发环境下将实现更高的吞吐量，而在单线程环境中只损失非常小的性能。

但ConcurrentHashMap仍然有一些折衷的地方。如削弱了size和isEmpty等方法的语义，这些方法返回的不再是精确值而是一个估计值。

ConcurrentHashMap直接继承自ConcurrentMap，后者是Map接口的扩展。它旨在为解决吞吐量与线程安全性之间的协调问题提供结构和指导。

通过重写几个接口的默认方法，ConcurrentMap 为有效的实现提供了指导，以提供线程安全和内存一致的原子操作。

多个默认实现被重写，禁用了空键/值支持：

-   getOrDefault
-   forEach
-   replaceAll
-   computeIfAbsent
-   computeIfPresent
-   compute
-   merge

以下 API 也被重写以支持原子性，但没有默认接口实现：

-   putIfAbsent
-   remove
-   replace(key, oldValue, newValue)
-   replace(key, value)

ConcurrentMap 保证了多线程环境中键/值操作的内存一致性。

在将一个对象作为键或值放入 ConcurrentMap 之前，一个线程中的操作会先于另一个线程中访问或删除该对象的操作发生。

为了证实这一点，让我们来看看内存不一致的情况：

```java
@Test
public void givenHashMapThenSumParallelShouldReturnUnexpectedResult() throws Exception {
    Map<String, Integer> map = new HashMap<>();
    List<Integer> summed = parallelSum(map, 100);

    assertThat(summed.stream().distinct().count()).isNotEqualTo(1);
    long nWrongResult = summed.stream().filter(n -> n != 100).count();
    assertThat(nWrongResult).isGreaterThan(0);
}

private List<Integer> parallelSum(Map<String, Integer> map, int executionTimes) throws InterruptedException {
    List<Integer> summed = new ArrayList<>(1000);
    for (int i = 0; i < executionTimes; i++) {//*executionTimes
        map.put("test", 0);
        ExecutorService executor = Executors.newFixedThreadPool(4);
        for (int j = 0; j < 10; j++) {//*10
            executor.execute(() -> {
                for (int k = 0; k < 10; k++)//*10
                    map.computeIfPresent(
                            "test",
                            (key, value) -> value + 1
                    );
            });
        }
        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);
            summed.add(map.get("test"));
        }
    return summed;
}
```

上面的测试中，对于并行执行的每个 map.computeIfPresent 操作，HashMap 无法提供关于当前整数值的一致观点，从而导致不一致和不理想的结果。

如果我们换成ConcurrentHashMap，就可以得到预期的结果：

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

其他并发容器还包括CopyOnWriteArrayList（用以替代同步List）、ConcurrentLinkedQueue（用以替代同步的Queue）。Java 6还引入了ConcurrentSkipListMap和ConcurrentSkipListSet，分别作为同步的SortedMap和SortedSet的并发替代品。

## 引用 & 资源

1.  基础构建模块 @ [Brain Goetz 《Java并发编程实战》](https://jcip.net/)
