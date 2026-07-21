---
title: "MySQL 窗口函数"
published: 2024-01-09
updated: 2026-03-17
description: "窗口函数（Window Function）是 MySQL 8.0 才加入的一项重要功能，之前需要很复杂的操作才能实现的分析、汇总等等查询通过窗口函数终于可以很简单地实现了。窗口函数在一组查询行上执行类似于聚合的操作。大多数聚合函数也可以用作窗口函数。不过，有别于聚合操作将查询行分组为单个结果行，窗口函数为每个查询行生成一个结果： 执行函数分析的行被称为当前行。 "
image: ""
tags: ["MySQL", "MySQL 窗口函数"]
category: "MySQL"
draft: false
lang: "zh_CN"
---
> 物有本末，事有终始。知所先后，则近道矣
>
> ——《礼记·大学》

窗口函数（Window Function）是 MySQL 8.0 才加入的一项重要功能，之前需要很复杂的操作才能实现的分析、汇总等等查询通过窗口函数终于可以很简单地实现了。窗口函数在一组查询行上执行类似于聚合的操作。大多数聚合函数也可以用作窗口函数。不过，有别于聚合操作将查询行分组为单个结果行，窗口函数为每个查询行生成一个结果：

-   执行函数分析的行被称为当前行。
-   与当前行相关的查询行构成当前行的窗口。

## 1\. 窗口函数语法

调用窗口函数的语法通常如下：

```sql
window_function_name(expression) OVER (
   [partition_defintion]
   [order_definition]
   [frame_definition]
)
```

我们需要先指定窗口函数名称，然后是表达式。然后指定 OVER 子句，OVER 子句可以包含分区定义、顺序定义和框架定义。不管有没有表达式，OVER 子句后都需要加上括号。

### 1.1. 窗口函数

窗口函数一般可分为聚合窗口函数和分析窗口函数。

聚合窗口函数包括 SUM、COUNT、AVG、MIN 和 MAX 等，通常返回一个标量值。

分析窗口函数又可分为排序函数和值函数，根据当前行建立记录窗口，然后使用该窗口计算结果。输出结果通常是一组记录。例如 RANK、DENSE\_RANK、ROW\_NUMBER、CUME\_DIST、LAG、LEAD 等。

值函数有：

-   FIRST\_VALUE()
-   LAST\_VALUE()
-   NTH\_VALUE()

标准 SQL 规定，对整个分区进行操作的窗口函数不应包含框架子句。MySQL 允许此类函数使用框架子句，但会忽略它。即使指定了框架，这些函数也会使用整个分区，包括：

-   CUME\_DIST()
-   DENSE\_RANK()
-   LAG()
-   LEAD()
-   NTILE()
-   PERCENT\_RANK()
-   RANK() ROW\_NUMBER()

### 1.2. PARTITION BY 子句

PARTITION BY 子句将行分割成块或分区。两个分区之间用分区边界隔开。窗口函数在分区内执行，并在跨越分区边界时重新初始化。语法如下：

```sql
PARTITION BY <expression>[{,<expression>...}]
```

### 1.3. ORDER BY 子句

ORDER BY 子句指定分区内记录的排序方式。可以根据多个键对分区内的数据进行排序，每个键由一个表达式指定。多个表达式之间也用逗号分隔。

与 PARTITION BY 子句类似，所有窗口函数也都支持 ORDER BY 子句。不过，只有对顺序敏感的窗口函数才有必要使用 ORDER BY 子句。

语法如下：

```sql
ORDER BY <expression> [ASC|DESC], [{,<expression>...}]
```

### 1.4. 框架单元子句

框架子句定义了框架，框架是当前分区的子集。框架子句的语法如下：

```sql
frame_unit {<frame_start>|<frame_between>}
```

框架单元用来表示当前行和框架行之间的关系类型。如果框架单元是 ROWS，当前行相对于框架行的偏移量就是行号；如果框架单元是 RANGE，当前行的偏移量就是数据行的值。

框架的边界使用 frame\_start 和 frame\_between 定义。

frame\_start 可以包含下面的值：

-   UNBOUNDED PRECEDING：框架从分区的第一行开始。
-   N PRECEDING：当前行之前的实际 N 行。N 可以是一个字面数字，也可以是一个结果为数字的表达式。
-   CURRENT ROW：当前计算的行。

frame\_between 像下面这样定义：

```sql
BETWEEN frame_boundary_1 AND frame_boundary_2
```

frame\_boundary\_1 和 frame\_boundary\_2 可包含下面的值：

-   frame\_start：如前所述。
-   UNBOUNDED FOLLOWING：帧在分区的最后一行结束。
-   N FOLLOWING：当前行后面 N 行。

## 2\. 实践

下面的例子都会使用一个记录学生考试分数 test\_score 表，表结构和示例数据如下：

```text
+----+-----------+-------+------------+
| id | name      | score | test_time  |
+----+-----------+-------+------------+
|  1 | Liu Bei   |    64 | 2021-01-01 |
|  2 | Guan Yu   |    60 | 2021-01-01 |
|  3 | Zhang Fei |    65 | 2021-01-01 |
|  * | ********  |    ** | ********** |
+----+-----------+-------+------------+
```

### 2.1. SUM 和 AVG

下面的查询演示了怎样使用移动框架行计算每个用户按时间排序的当前总分数，以及根据最近得分的滚动平均值：

```sql
SELECT
    `test_time`, `name`, `score`,
    SUM(`score`) OVER (PARTITION BY `name` ORDER BY `test_time`
                           ROWS UNBOUNDED PRECEDING) `current_total`,
    AVG(`score`) OVER (PARTITION BY `name` ORDER BY `test_time`
                           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
                           `recent_average`
FROM `test_score`;
```

结果如下：

```text
+------------+-------------+-------+---------------+----------------+
| test_time  | name        | score | current_total | recent_average |
+------------+-------------+-------+---------------+----------------+
| 2021-01-01 | Guan Yu     |    60 |            60 |        60.0000 |
| 2021-02-01 | Guan Yu     |    65 |           125 |        62.5000 |
| 2023-01-01 | Guan Yu     |    62 |           187 |        62.3333 |
| 2023-02-01 | Guan Yu     |    62 |           249 |        63.0000 |
| 2024-01-01 | Guan Yu     |    61 |           310 |        61.6667 |
| 2024-02-01 | Guan Yu     |    59 |           369 |        60.6667 |
| 2021-01-01 | Huang Zhong |    65 |            65 |        65.0000 |
+------------+-------------+-------+---------------+----------------+
```

### 2.2. RANK 和 DENSE\_RANK

列出每次考试的分数排名情况（相同分数时排名相同）：

```sql
SELECT
    `test_time`,
    `name`,
    `score`,
    RANK() OVER(PARTITION BY `test_time`
                    ORDER BY `test_time`,`score` DESC) `rank`
FROM
    `test_score`;
```

结果如下：

```text
+------------+-------------+-------+------+
| test_time  | name        | score | rank |
+------------+-------------+-------+------+
| 2021-01-01 | Zhang Fei   |    65 |    1 |
| 2021-01-01 | Huang Zhong |    65 |    1 |
| 2021-01-01 | Pang Tong   |    64 |    3 |
| 2021-01-01 | Liu Bei     |    64 |    3 |
| 2021-01-01 | Zhao Yun    |    63 |    5 |
| 2021-01-01 | Ma Chao     |    61 |    6 |
| 2021-01-01 | Guan Yu     |    60 |    7 |
| 2021-01-01 | Zhuge Liang |    59 |    8 |
+------------+-------------+-------+------+
```

列出每次考试的分数排名情况（相同分数时排名按姓名顺序排序）：

```sql
SELECT
	`test_time`,
    `name`,
    `score`,
    DENSE_RANK() OVER(PARTITION BY `test_time`
                    ORDER BY `test_time`,`score` DESC, `name`) `rank`
FROM
    `test_score`;
```

结果如下：

```text
+------------+-------------+-------+------+
| test_time  | name        | score | rank |
+------------+-------------+-------+------+
| 2021-01-01 | Huang Zhong |    65 |    1 |
| 2021-01-01 | Zhang Fei   |    65 |    2 |
| 2021-01-01 | Liu Bei     |    64 |    3 |
| 2021-01-01 | Pang Tong   |    64 |    4 |
| 2021-01-01 | Zhao Yun    |    63 |    5 |
| 2021-01-01 | Ma Chao     |    61 |    6 |
| 2021-01-01 | Guan Yu     |    60 |    7 |
| 2021-01-01 | Zhuge Liang |    59 |    8 |
+------------+-------------+-------+------+
```

## 引用

1.  MySQL 窗口函数 @ [https://dev.mysql.com/doc/refman/8.3/en/window-functions.html](https://dev.mysql.com/doc/refman/8.3/en/window-functions.html)
