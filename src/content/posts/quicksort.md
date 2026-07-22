---
title: "快速排序"
published: 2023-05-22
updated: 2024-01-18
description: "介绍快速排序的分治思路、分区过程与 Java 实现，并说明其在查找第 k 大元素等场景中的应用。"
image: ""
tags: ["快速排序", "排序算法"]
category: "数据结构和算法"
draft: false
lang: "zh_CN"
---
> 天下难事，必作于易；天下大事，必作于细
>
> ——《道德经·第六十三章》

## 01. 什么是快速排序？

[**快速排序**](https://zh.wikipedia.org/wiki/%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F)，又称分区交换排序，是一种排序算法。在平均状况下，排序 n 个项目要 O（n×log n）次比较。在最坏情况下则需要 O(n²) 次比较，这种状况并不常见。

快速排序使用分治法策略把一个序列分为 2 个子序列，然后递归地排序两个子序列。步骤为：

1.  挑选基准值：从数列中挑出一个元素，称为“基准”（pivot），
2.  分割：重新排序数列，所有比基准值小的元素摆放在基准前面，所有比基准值大的元素摆在基准后面（与基准值相等的数可以到任何一边）。在这个分割结束之后，对基准值的排序就已经完成，
3.  递归排序子序列：[递归](https://zh.wikipedia.org/wiki/%E9%80%92%E5%BD%92)地将小于基准值元素的子序列和大于基准值元素的子序列排序。

## 02. 实现快速排序

为了实现快速排序，我们需要考虑如何管理分区，并将元素放到正确的位置。我们可以使用 4 个变量，它们可以被称为 p、i、j、r。p 和 r 总是标记当前子阵列的开始和结束位置。而 i 标志着包含小元素的左边分区的结束位置。每次我们在左边的位置增加一个元素时，我们只需要将元素 j 和元素 i+1 交换，然后使 i 加 1。这可以帮助我们实现扩大左边分区和向前移动右边分区的目标。而当我们想在右边的分区中加入一个元素时，我们只需让 j 加 1。

以下是使用 Java 代码实现的快速排序算法：

```java
public class QuickSort {
    public int[] sort(int[] arr) {
        quickSort(arr, 0, arr.length - 1);
        return arr;
    }

    private void quickSort(int[] arr, int p, int r) {
        if (p < r) {
            int q = partition(arr, p, r);
            quickSort(arr, p, q - 1);
            quickSort(arr, q, r);
        }
    }
    private int partition(int[] arr, int p, int r) {
        int pivot = arr[r];
        int i = p;
        for (int j = p; j < r; j++) {//n
            if (arr[j] <= pivot) {
                swap(arr, i++, j);
            }
        }
        swap(arr, i, r);
        return i;
    }

    private void swap(int[] arr, int i, int j) {
        int swap = arr[i];
        arr[i] = arr[j];
        arr[j] = swap;
    }
}
```

## 03. 快速排序的应用场景

-   在 O(n) 时间复杂度内找出一个序列中第 k 大的元素
    由于快速排序时每次经过「划分」操作后，我们一定可以确定一个元素的最终位置，即 x 的最终位置为 q，并且保证 a\[l⋯q−1\] 中的每个元素小于等于 a\[q\]，且 a\[q\] 小于等于 a\[q+1⋯r\] 中的每个元素。所以只要某次划分的 q 为倒数第 k 个下标的时候，我们就已经找到了答案。参考力扣题库。

## 引用

1.  [快速排序](https://zh.wikipedia.org/wiki/%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F)（维基百科）
2.  [数组中的第 K 个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/solutions/307351/shu-zu-zhong-de-di-kge-zui-da-yuan-su-by-leetcode-/)（LeetCode）
