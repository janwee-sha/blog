---
title: "在 Java 中实现线程安全的单例模式"
published: 2024-01-06
updated: 2024-02-04
description: "本文探讨 Java 中线程安全单例模式的多种实现方式，包括声明变量时初始化、双重检查锁、静态内部类和枚举，并介绍反射与反序列化对单例约束的影响。"
image: ""
tags: ["单例模式", "并发编程", "设计模式", "Java"]
category: "设计模式"
draft: false
lang: "zh_CN"
---
> 万物得一以生
>
> ——《道德经·第三十九章》

## 01. 引言

Java 单例模式是“Gang of Four”（GoF）提出的设计模式之一，属于创建型设计模式。这种模式限制类的实例化，目标是在同一类加载器所定义的类范围内只提供一个实例。单例模式看起来简单，但在实现时却需要考虑很多因素。

下文将探讨线程安全单例模式的不同实现方式。

## 02. 线程安全的单例模式实现

单例模式有各种实现方式，这些实现方式一般都具有以下共同特点：

1.  使用私有构造函数以限制其他类实例化该类；
2.  使用同一类的私有静态变量表示该类的唯一实例；
3.  使用公有静态方法，返回该类的实例，这是其他类获取单例类实例的全局访问点。

### 2.1. 声明变量时初始化

这种实现方式不支持按首次调用 `getInstance()` 延迟创建；当 JVM 初始化该类时就会创建单例实例。具体代码如下：

```java
public class EagerInitializedSingleton {
    private static final EagerInitializedSingleton INSTANCE = new EagerInitializedSingleton();

    private EagerInitializedSingleton() {
    }

    public static EagerInitializedSingleton getInstance() {
        return INSTANCE;
    }
}
```

另外还可以在静态块中调用构造函数，和声明实例对象时调用构造函数没有太大区别，但好处是可以在初始化过程中处理异常。

```java
public class StaticBlockSingleton {
    private static final StaticBlockSingleton INSTANCE;

    static {
        try {
            INSTANCE = new StaticBlockSingleton();
        } catch (Exception e) {
            throw new RuntimeException("Exception occurred in creating singleton instance", e);
        }
    }

    private StaticBlockSingleton() {
    }

    public static StaticBlockSingleton getInstance() {
        return INSTANCE;
    }
}
```

### 2.2. 对初始化代码加锁

使用锁最简单的方式是使用 `synchronized` 关键字修饰入口方法，但是并发性能较低，进阶的方式是使用双重检查锁的方式。

```java
public class DoubleCheckedLockingSingleton {
    private static volatile DoubleCheckedLockingSingleton INSTANCE;

    public static DoubleCheckedLockingSingleton getInstance() {
        if (INSTANCE == null) {
            synchronized (DoubleCheckedLockingSingleton.class) {
                if (INSTANCE == null) {
                    INSTANCE = new DoubleCheckedLockingSingleton();
                }
            }
        }
        return INSTANCE;
    }

    private DoubleCheckedLockingSingleton() {
    }
}
```

需要注意的是，除了使用锁保证“独占性”，双重检查锁还要求将实例变量声明为 `volatile`，以防止其他线程观察到尚未完成初始化的对象。

在 Java 5 之前的内存模型中，即使将实例变量声明为 `volatile`，双重检查锁也无法可靠工作；从 Java 5 开始，增强后的 `volatile` 语义使上述实现能够安全发布实例。不过，静态内部类实现通常更简洁，也更容易正确实现。

### 2.3. 使用静态内部类延迟初始化

这种方式利用 Java 的类初始化保证：只有首次访问 `SingletonHolder.INSTANCE` 时才初始化静态内部类；因此既能延迟创建实例，又无须显式加锁。

```java
public class StaticInnerClassSingleton {
    private static class SingletonHolder {
        private static final StaticInnerClassSingleton INSTANCE = new StaticInnerClassSingleton();
    }

    public static StaticInnerClassSingleton getInstance() {
        return SingletonHolder.INSTANCE;
    }

    private StaticInnerClassSingleton() {
    }
}
```

在允许深度反射访问私有构造函数的运行环境中，上述三种实现方式都可能被反射破坏。下面是使用 Java 反射机制破坏单例模式的例子：

```java
@Test
public void reflectionShouldCreateANewSingletonInstance() {
    EagerInitializedSingleton instance1 = EagerInitializedSingleton.getInstance();
    EagerInitializedSingleton instance2 = null;
    try {
        Constructor<?>[] constructors = EagerInitializedSingleton.class.getDeclaredConstructors();
        for (Constructor<?> constructor : constructors) {
            constructor.setAccessible(true);
            instance2 = (EagerInitializedSingleton) constructor.newInstance();
            break;
        }
    } catch (Exception e) {
        e.printStackTrace();
    }
    assertThat(instance1).isNotSameAs(instance2);
}
```

### 2.4. 使用枚举类型

为了防止常规反射调用构造函数破坏单例约束，Joshua Bloch 建议使用枚举实现单例。Java 语言与反射 API 都限制创建额外的枚举实例；枚举常量可通过类型名直接访问，并由序列化机制特殊处理。缺点是这种实现方式不够灵活，例如不能延迟初始化。

```java
public enum EnumSingleton {
    INSTANCE
}
```

## 03. 单例模式的序列化

如果单例需要支持 Java 原生序列化，应实现 `Serializable` 接口；默认反序列化会创建新对象，因此还需实现 `readResolve()`，用既有单例替换反序列化得到的对象。若不提供 `readResolve()` 实现，则每次反序列化单例对象都会得到一个新的实例，比如下面的例子：

```java
public class SerializedSingleton implements Serializable {
    @Serial
    private static final long serialVersionUID = -7604766932017737115L;

    private SerializedSingleton() {
    }

    private static class SingletonHolder {
        private static final SerializedSingleton INSTANCE = new SerializedSingleton();
    }

    public static SerializedSingleton getInstance() {
        return SingletonHolder.INSTANCE;
    }
}
```

```java
@Test
public void deserializationShouldCreateANewSingletonInstance() throws IOException, ClassNotFoundException {
    SerializedSingleton instance1 = SerializedSingleton.getInstance();
    SerializedSingleton instance2;
    try (ObjectOutput out = new ObjectOutputStream(new FileOutputStream("SerializedSingleton.ser"))) {
        out.writeObject(instance1);
    }

    try (ObjectInput in = new ObjectInputStream(new FileInputStream("SerializedSingleton.ser"))) {
        instance2 = (SerializedSingleton) in.readObject();
    }
    assertThat(instance1).isNotSameAs(instance2);
}
```

`readResolve()` 不能阻止反序列化过程构造临时对象，但可以在对象返回给调用者前用既有单例替换它：

```java
@Serial
protected Object readResolve() {
    return getInstance();
}
```

## 引用

1.  [Java Singleton Pattern: Best Practices & Examples](https://www.digitalocean.com/community/tutorials/java-singleton-design-pattern-best-practices-examples)
2.  [《Java 并发编程实战》](https://jcip.net/)（Brian Goetz、Tim Peierls、Joshua Bloch、Joseph Bowbeer、David Holmes、Doug Lea 著，机械工业出版社）
3.  [《Effective Java, 3rd Edition》](https://www.informit.com/store/effective-java-9780134686097)（Joshua Bloch 著，Addison-Wesley Professional）
4.  [Java Platform, Standard Edition 21 API Specification: `Class`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Class.html)
5.  [The Java Language Specification, Java SE 21 Edition, §12.4 Initialization of Classes and Interfaces](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.4)
6.  [The Java Language Specification, Java SE 21 Edition, §17.4.5 Happens-before Order](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html#jls-17.4.5)
7.  [Java Platform, Standard Edition 21 API Specification: `Constructor`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/reflect/Constructor.html)
8.  [Java Object Serialization Specification, §3.7 The `readResolve` Method](https://docs.oracle.com/en/java/javase/21/docs/specs/serialization/input.html#the-readresolve-method)
