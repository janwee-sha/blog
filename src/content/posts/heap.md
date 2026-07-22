---
title: "堆"
published: 2023-06-08
updated: 2025-03-26
description: "介绍二叉堆的性质、数组存储方式与常见操作，并给出 Java 和 Go 实现。"
image: ""
tags: ["堆", "数据结构"]
category: "数据结构和算法"
draft: false
lang: "zh_CN"
---
> 合抱之木，生于毫末；九层之台，起于累土
>
> ——《道德经·第六十四章》

## 01. 堆是什么？

堆（Heap）是计算机科学中的一种特别的完全二叉树。若是满足以下特性，即可称为堆：“给定堆中任意节点P和C，若P是C的父节点，那么P的值会小于等于（或大于等于）C的值”。若父节点的值恒小于等于子节点的值，此堆称为最小堆（min heap）；反之，若父节点的值恒大于等于子节点的值，此堆称为最大堆（max heap）。在堆中把根节点（root node）称为堆顶（top），而底层最靠右的节点称为堆底（bottom）。

堆的常见用途包括：

1) 堆排序
    
    堆（通常是二叉堆）常用于排序。这种算法称作堆排序。

2) 事件模拟

    主要运用堆的排序以选择优先。

3) 优先权队列

    在队列中，调度程序反复提取队列中第一个作业并运行，因为实际情况中某些时间较短的任务将等待很长时间才能结束，或者某些不短小，但具有重要性的作业，同样应当具有优先权。堆即为解决此类问题设计的最佳数据结构。

4) 戴克斯特拉算法

    在戴克斯特拉算法中使用斐波那契堆或二元堆可使得队列的操作更为快速。

## 02. 堆的属性

堆可以分为最大堆和最小堆。在最大堆中，每个父节点的值都大于或等于其子节点的值；在最小堆中，每个父节点的值都小于或等于其子节点的值。

> [!CAUTION]
> **注意**
>
> 堆的根节点始终保存最大值或最小值，但其他元素没有确定的全局顺序。以最大堆为例，最大值始终位于索引 0 处。若所有值互异，最小值必位于某个叶子节点；允许重复值时，内部节点也可能具有最小值。

## 03. 堆的数组存储结构

使用数组存储二叉堆，可以省去显式父/子指针，并通过下标关系在 `O(1)` 时间内定位父节点和子节点。数组表示和基于指针的表示都需要 `O(n)` 的总空间，但数组通常具有更低的额外空间开销。

树节点的数组索引与其父节点和子节点的数组索引之间有明确定义的关系。

如果 `i` 是一个节点的索引，那么以下公式给出了其父节点和子节点的数组索引。父节点公式仅适用于 `i > 0`，因为根节点没有父节点；只有当子节点索引小于堆的元素数量时，相应的子节点才存在。

```text
parent(i) = floor((i - 1) / 2), i > 0
left(i) = 2i + 1
right(i) = 2i + 2
```

## 04. 堆的操作

在插入或删除元素后，我们使用两种基本调整操作维护堆序性质：

-   `shiftUp()`：如果元素的优先级高于其父节点，则将二者交换，使该元素上移。
-   `shiftDown()`：如果元素的优先级低于其子节点，则与优先级最高的子节点交换，使该元素下移。

这两个操作也称为上滤（sift up）和下滤（sift down），可以递归或迭代实现，最坏时间复杂度均为 `O(log n)`。

以下是构建在基本调整操作之上的其他操作：

-   `insert(value)`：将新元素添加到堆的末尾，然后使用 `shiftUp()` 修复堆。
-   `remove()`：删除并返回最大值（在最大堆中）或最小值（在最小堆中），然后使用 `shiftDown()` 修复堆。

通过这些操作，我们可以在堆中高效地插入和删除元素，并保持堆的性质。

| 操作 | 时间复杂度 |
| --- | --- |
| 获取堆顶元素 | `O(1)` |
| 插入元素 | `O(log n)` |
| 删除堆顶元素 | `O(log n)` |

以最大堆为例，依次插入 `4`、`7`、`1`、`9` 后，堆顶元素是 `9`。执行一次 `remove()` 会返回 `9`，调整后的堆顶元素是 `7`。

## 05. 实现一个堆

下面给出固定容量最大堆的 Java 实现，以及由比较函数决定堆序的 Go 实现。

### 5.1. Java 实现

```java
public class Heap<E extends Comparable<? super E>> {
    private Object[] elements;
    private int heapSize;

    public Heap(int capacity) {
        this.elements = new Object[capacity];
        heapSize = 0;
    }

    private void shiftUp(int index) {
        if (index <= 0) return;
        int parent = (index - 1) / 2;
        if (compareElements(element(parent), element(index)) < 0) {
            swapElements(parent, index);
            shiftUp(parent);
        }
    }

    private void shiftDown(int index) {
        int left = 2 * index + 1, right = 2 * index + 2;
        if ((left < heapSize && right >= heapSize)
                || (left < heapSize
                && right < heapSize
                && compareElements(element(left), element(right)) > 0)) {
            if (compareElements(element(index), element(left)) < 0) {
                swapElements(left, index);
                shiftDown(left);
            }
        } else if (right < heapSize) {
            if (compareElements(element(index), element(right)) < 0) {
                swapElements(right, index);
                shiftDown(right);
            }
        }
    }

    private void swapElements(int first, int next) {
        E swap = element(first);
        elements[first] = elements[next];
        elements[next] = swap;

    }

    @SuppressWarnings("unchecked")
    private E element(int index) {
        return (E) elements[index];
    }

    private int compareElements(E origin, E target) {
        return origin.compareTo(target);
    }

    public boolean insert(E value) {
        if (heapSize == elements.length) return false;
        elements[heapSize] = value;
        shiftUp(heapSize++);
        return true;
    }

    public E remove() {
        if (heapSize == 0) return null;
        E removed = element(0);
        elements[0] = elements[heapSize - 1];
        elements[heapSize - 1] = null;
        heapSize--;
        shiftDown(0);
        return removed;
    }

    public int size() {
        return heapSize;
    }
}
```

### 5.2. Go 实现

```go
import (
	"errors"
)

type Heap struct {
	elements []any
	heapSize int
	compare  func(a, b any) int
}

func NewHeap(capacity int, compare func(a, b any) int) *Heap {
	return &Heap{
		elements: make([]any, capacity),
		heapSize: 0,
		compare:  compare,
	}
}

func (h *Heap) shiftUp(i int) {
	if i <= 0 {
		return
	}
	parent := (i - 1) / 2
	if h.compare(h.elements[parent], h.elements[i]) < 0 {
		h.swap(parent, i)
		h.shiftUp(parent)
	}
}

func (h *Heap) shiftDown(i int) {
	left := 2*i + 1
	right := 2*i + 2

	if (left < h.heapSize && right >= h.heapSize) || (left < h.heapSize && right < h.heapSize && h.compare(h.elements[left], h.elements[right]) > 0) {
		if h.compare(h.elements[i], h.elements[left]) < 0 {
			h.swap(left, i)
			h.shiftDown(left)
		}
	} else if right < h.heapSize {
		if h.compare(h.elements[i], h.elements[right]) < 0 {
			h.swap(right, i)
			h.shiftDown(right)
		}
	}
}

func (h *Heap) swap(first, next int) {
	h.elements[first], h.elements[next] = h.elements[next], h.elements[first]
}

func (h *Heap) Insert(value any) error {
	if h.heapSize == len(h.elements) {
		return errors.New("heap is full")
	}
	h.elements[h.heapSize] = value
	h.shiftUp(h.heapSize)
	h.heapSize++
	return nil
}

func (h *Heap) Remove() (any, error) {
	if h.heapSize == 0 {
		return nil, errors.New("heap is empty")
	}
	removed := h.elements[0]
	h.elements[0] = h.elements[h.heapSize-1]
	h.elements[h.heapSize-1] = nil
	h.heapSize--
	h.shiftDown(0)
	return removed, nil
}

func (h *Heap) Size() int {
	return h.heapSize
}
```
