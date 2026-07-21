---
title: "在 Java 中实现线程安全的单例模式"
published: 2024-01-06
updated: 2024-02-04
description: "单例模式是“Gangs of Four”提出的设计模式之一，属于创建型设计模式。这种模式限制类的实例化，确保在 Java 虚拟机中只存在一个类的实例。单例模式看起来简单，但在实现时却需要考虑很多因素。 下文是对线程安全的单例设计模式的不同实现的探讨。 线程安全的单例模式实现 单例模式有各种实现方式，这些实现方式一般都具有以下共同特点： 使用私有构造函数以"
image: ""
tags: ["单例模式", "并发编程", "设计模式", "Java"]
category: "设计模式"
draft: false
lang: "zh_CN"
---
> 我愿我的生命是一辆牛车
>
> 清晨嘎吱作响地走在路上
>
> 当它到达它要去的地方，傍晚
>
> 开始沿着同一条路返回

Java 单例模式是“Gangs of Four”提出的设计模式之一，属于创建型设计模式。这种模式限制类的实例化，确保在 Java 虚拟机中只存在一个类的实例。单例模式看起来简单，但在实现时却需要考虑很多因素。

下文是对线程安全的单例设计模式的不同实现的探讨。

## 线程安全的单例模式实现

单例模式有各种实现方式，这些实现方式一般都具有以下共同特点：

1.  使用私有构造函数以限制其他类实例化该类；
2.  使用同一类的私有静态变量表示该类的唯一实例；
3.  使用公有静态方法，返回该类的实例，这是其他类获取单例类实例的全局访问点。

### A. 声明变量时初始化

这种实现方式不支持懒加载，在 JVM 虚拟机加载类后就会创建单例类的实例，即使获取实例的入口方法没有被调用。具体代码如下：

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

### B. 对初始化代码加锁

使用锁最简单的方式是使用 synchronized 关键字修饰入口方法，但是并发性能较低，进阶的方式是使用双重检查锁的方式。

```java
public class DoubleCheckedLockingSingleton {
    private volatile static DoubleCheckedLockingSingleton INSTANCE;

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

需要注意的是，除了使用锁保证“独占性”，使用这种方式需要将实例变量声明为 volatile 类型以保证“可见性”，因为其他线程可能看到一个仅被部分构造的单例对象。

双检锁方式在 JMM 早期版本不支持 volatile 变量时无法保证构造的对象的“可见性”，所以属于糟糕的一类实现方式。后面虽然使用 volatile 变量保证单例对象的“可见性”了，但促使它出现的驱动力（无竞争同步的执行速度很慢，以及 JVM 启动时很慢）也几乎不存在了，所以这种方式已经不推荐了。

### C. 使用静态内部类延迟初始化

这种方式利用了 JVM 的延迟加载机制，同时避免了加锁方式带来的同步开销，是比前一种方式更优化的一种实现方式。

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

另外，上述三种实现方式都可以被 Java 反射机制破坏。下面是使用 Java 反射机制破坏单例模式的例子：

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
    assertThat(instance1 == instance2).isFalse();
}
```

### D. 使用枚举类型

为了防止反射机制对单例模式实现的破坏，Joshua Bloch 建议使用枚举来实现单例设计模式，因为 Java 确保在 Java 程序中任何枚举值只被实例化一次。由于 Java 枚举值具有全局访问权限，单例模式也同样如此。此外使用枚举类型不需要额外处理就可以支持序列化。缺点是枚举类型有些不灵活，比如不能使用延迟初始化。

```java
public enum EnumSingleton {
    INSTANCE
}
```

## 单例模式的序列化

如果涉及到反序列化创建单例对象，我们需要在单例类中实现 Serializable 接口并在单例里面实现 readResolve() 方法。若不提供 readResolve() 实现，则每次反序列化单例对象都会创建一个新的类实例，比如下面的例子：

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
    assertThat(instance1.hashCode() == instance2.hashCode()).isFalse();
}
```

实现 readResolve() 方法可以防止每次反序列化创建新的实例：

```java
@Serial
protected Object readResolve() {
    return getInstance();
}
```

## 引用

1.  Java Singleton Design Pattern Best Practices with Examples @ [https://www.digitalocean.com/community/tutorials/java-singleton-design-pattern-best-practices-examples#singleton-pattern-principles](https://www.digitalocean.com/community/tutorials/java-singleton-design-pattern-best-practices-examples#singleton-pattern-principles)

2.  Java 内存模型 @ [Brian Goetz《Java 并发编程实战》](https://jcip.net/)
