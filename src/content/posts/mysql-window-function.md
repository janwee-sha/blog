---
title: "MySQL 窗口函数"
published: 2024-01-09
updated: 2026-03-17
description: "介绍 MySQL 8.0 窗口函数的基本语法、分区、排序与窗口框架，并通过 SUM、AVG、RANK 和 DENSE_RANK 示例说明累计、滚动平均和排名查询。"
image: ""
tags: ["MySQL", "MySQL 窗口函数"]
category: "MySQL"
draft: false
lang: "zh_CN"
---
> 物有本末，事有终始，知所先后，则近道矣。
>
> ——《礼记·大学》

## 01. 引言

MySQL 8.0 引入了窗口函数，使许多原本写法复杂的分析与汇总查询更容易实现。窗口函数会基于与当前行相关的一组查询行执行类似聚合的计算，但不会像聚合查询那样把多行折叠为一行；它会为每个查询行返回结果：

-   执行函数分析的行被称为当前行。
-   与当前行相关的查询行构成当前行的窗口。

## 02. 窗口函数语法

调用窗口函数时，需要在函数调用后使用 OVER 子句。OVER 子句有两种形式：

```text
over_clause:
    {OVER (window_spec) | OVER window_name}

window_spec:
    [window_name] [partition_clause] [order_clause] [frame_clause]
```

使用第一种形式时，窗口规范写在 OVER 后的括号内；使用第二种形式时，window_name 引用由 WINDOW 子句定义的命名窗口。窗口规范中的各部分都是可选的；OVER 后的括号为空时，全部查询行会被视为一个分区。

### 2.1. 窗口函数

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
-   RANK()
-   ROW\_NUMBER()

### 2.2. PARTITION BY 子句

PARTITION BY 子句将行分割成块或分区。两个分区之间用分区边界隔开。窗口函数在分区内执行，并在跨越分区边界时重新初始化。语法如下：

```text
partition_clause:
    PARTITION BY expr [, expr] ...
```

### 2.3. ORDER BY 子句

ORDER BY 子句指定分区内记录的排序方式。可以根据多个键对分区内的数据进行排序，每个键由一个表达式指定。多个表达式之间也用逗号分隔。

与 PARTITION BY 子句类似，所有窗口函数也都支持 ORDER BY 子句。不过，只有对顺序敏感的窗口函数才有必要使用 ORDER BY 子句。

语法如下：

```text
order_clause:
    ORDER BY expr [ASC | DESC] [, expr [ASC | DESC]] ...
```

### 2.4. 框架单元子句

框架子句定义当前分区的一个子集。框架子句的语法如下：

```text
frame_clause:
    frame_units frame_extent

frame_units:
    {ROWS | RANGE}

frame_extent:
    {frame_start | frame_between}

frame_between:
    BETWEEN frame_start AND frame_end

frame_start, frame_end: {
    CURRENT ROW
  | UNBOUNDED PRECEDING
  | UNBOUNDED FOLLOWING
  | expr PRECEDING
  | expr FOLLOWING
}
```

框架单元用来表示当前行和框架行之间的关系类型。如果框架单元是 ROWS，当前行相对于框架行的偏移量就是行号；如果框架单元是 RANGE，当前行的偏移量就是数据行的值。

frame_extent 表示框架的起点和终点。只指定 frame_start 时，当前行会被隐式作为终点；也可以使用 BETWEEN ... AND ... 同时指定起点和终点。使用 BETWEEN 语法时，frame_start 不能位于 frame_end 之后。

-   CURRENT ROW：当前行；使用 RANGE 时还包括当前行的同级行。
-   UNBOUNDED PRECEDING：分区的第一行。
-   UNBOUNDED FOLLOWING：分区的最后一行。
-   expr PRECEDING：使用 ROWS 时表示当前行之前的 expr 行；使用 RANGE 时表示当前行的值减去 expr 后确定的范围。
-   expr FOLLOWING：使用 ROWS 时表示当前行之后的 expr 行；使用 RANGE 时表示当前行的值加上 expr 后确定的范围。

## 03. 实践

下面的例子都会使用一个记录学生考试分数的 `test_score` 表，表结构和示例数据如下：

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

### 3.1. SUM 和 AVG

下面的查询演示了怎样使用移动框架行计算每名学生按时间排序的当前总分数，以及根据最近得分的滚动平均值：

```sql
SELECT
    `test_time`, `name`, `score`,
    SUM(`score`) OVER (PARTITION BY `name` ORDER BY `test_time`
                           ROWS UNBOUNDED PRECEDING) `current_total`,
    AVG(`score`) OVER (PARTITION BY `name` ORDER BY `test_time`
                           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
                           `recent_average`
FROM `test_score`
ORDER BY `name`, `test_time`;
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

### 3.2. RANK 和 DENSE\_RANK

列出每次考试的分数排名情况（相同分数时排名相同）：

```sql
SELECT
    `test_time`,
    `name`,
    `score`,
    RANK() OVER(PARTITION BY `test_time`
                    ORDER BY `score` DESC) `rank`
FROM
    `test_score`
ORDER BY `test_time`, `score` DESC, `name`;
```

结果如下：

```text
+------------+-------------+-------+------+
| test_time  | name        | score | rank |
+------------+-------------+-------+------+
| 2021-01-01 | Huang Zhong |    65 |    1 |
| 2021-01-01 | Zhang Fei   |    65 |    1 |
| 2021-01-01 | Liu Bei     |    64 |    3 |
| 2021-01-01 | Pang Tong   |    64 |    3 |
| 2021-01-01 | Zhao Yun    |    63 |    5 |
| 2021-01-01 | Ma Chao     |    61 |    6 |
| 2021-01-01 | Guan Yu     |    60 |    7 |
| 2021-01-01 | Zhuge Liang |    59 |    8 |
+------------+-------------+-------+------+
```

列出每次考试的分数排名情况（相同分数时排名相同，且名次连续）：

```sql
SELECT
    `test_time`,
    `name`,
    `score`,
    DENSE_RANK() OVER(PARTITION BY `test_time`
                    ORDER BY `score` DESC) `rank`
FROM
    `test_score`
ORDER BY `test_time`, `score` DESC, `name`;
```

结果如下：

```text
+------------+-------------+-------+------+
| test_time  | name        | score | rank |
+------------+-------------+-------+------+
| 2021-01-01 | Huang Zhong |    65 |    1 |
| 2021-01-01 | Zhang Fei   |    65 |    1 |
| 2021-01-01 | Liu Bei     |    64 |    2 |
| 2021-01-01 | Pang Tong   |    64 |    2 |
| 2021-01-01 | Zhao Yun    |    63 |    3 |
| 2021-01-01 | Ma Chao     |    61 |    4 |
| 2021-01-01 | Guan Yu     |    60 |    5 |
| 2021-01-01 | Zhuge Liang |    59 |    6 |
+------------+-------------+-------+------+
```

## 引用

1.  [MySQL 8.4 Reference Manual: 14.20 Window Functions](https://dev.mysql.com/doc/refman/8.4/en/window-functions.html)（Oracle）
