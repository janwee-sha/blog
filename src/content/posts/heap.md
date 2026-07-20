---
title: "堆"
published: 2023-06-08
updated: 2025-03-26
description: "堆是什么？ 一个堆是一个存储在数组中的二叉树，它不使用父/子指针。堆是根据\"堆属性\"对节点的顺序进行排序的。 堆的常见用途包括： 构建优先队列。 支持堆排序。 快速计算集合中的最小（或最大）元素。 堆的属性 堆可以分为最大堆和最小堆。最大堆的父节点的值大于其每个子节点的值，最小堆的父节点的值小于其每个子节点的值。 堆的数组存储结构 将表示堆的二叉树存储在数组"
image: ""
tags: ["堆", "数据结构"]
category: "数据结构和算法"
draft: false
lang: "zh_CN"
---
## 堆是什么？

一个堆是一个存储在数组中的二叉树，它不使用父/子指针。堆是根据"堆属性"对节点的顺序进行排序的。

堆的常见用途包括：

-   构建优先队列。
-   支持堆排序。
-   快速计算集合中的最小（或最大）元素。

## 堆的属性

堆可以分为最大堆和最小堆。最大堆的父节点的值大于其每个子节点的值，最小堆的父节点的值小于其每个子节点的值。

> [!CAUTION]
> **注意**
>
> 堆的根节点始终是最大或最小的元素，但其他元素的排序顺序是不确定的。例如，在最大堆中，最大元素始终在索引0处，但最小元素不一定是最后一个元素。唯一的保证是它是叶子节点之一，但不确定是哪一个。

## 堆的数组存储结构

将表示堆的二叉树存储在数组中可以减少时间复杂度和空间复杂度。

树节点的数组索引与其父节点和子节点的数组索引之间有明确定义的关系。

如果 i 是一个节点的索引，那么以下公式给出了其父节点和子节点的数组索引：

```text
parent(i) = floor((i - 1)/2)
left(i) = 2i +1
right(i) = 2i +2
```

## 堆的操作

在插入或删除元素后，我们使用两个元操作维护堆的属性：

-   shiftUp()：如果元素比其父节点大（在最大堆中）或小（在最小堆中），则需要将其与父节点交换位置，使其上移。
-   shiftDown：如果元素比其子节点小（在最大堆中）或大（在最小堆中），则需要将其下移。这个操作也被称为"堆化"。 上移或下移是一个递归过程，需要 O(log n) 的时间。

以下是构建在元操作之上的其他操作：

-   insert(value)：将新元素添加到堆的末尾，然后使用 shiftUp() 来修复堆。
-   remove()：删除并返回最大值（在最大堆中）或最小值（在最小堆中）。

通过这些操作，我们可以在堆中高效地插入和删除元素，并保持堆的性质。

## 实现一个堆

Java实现：

```java
public class Heap<E extends Comparable> {
    private Object[] elements;
    private int heapSize;

    public Heap(int capacity) {
        this.elements = new Object[capacity];
        heapSize = 0;
    }

    private void shiftUp(int index) {
        int parent = (index - 1) / 2;
        if (parent >= 0
            && compareElements(element(parent), element(index)) < 0) {
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

    @SuppressWarnings("unchecked")
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

Go实现：

```go
import (
	"errors"
)

type Heap struct {
	elements []interface{}
	heapSize int
	compare  func(a, b interface{}) int
}

func NewHeap(capacity int, compare func(a, b interface{}) int) *Heap {
	return &Heap{
		elements: make([]interface{}, capacity),
		heapSize: 0,
		compare:  compare,
	}
}

func (h *Heap) shiftUp(i int) {
	parent := (i - 1) / 2
	if parent >= 0 && h.compare(h.elements[parent], h.elements[i]) < 0 {
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

func (h *Heap) Insert(value interface{}) error {
	if h.heapSize == len(h.elements) {
		return errors.New("heap is full")
	}
	h.elements[h.heapSize] = value
	h.shiftUp(h.heapSize)
	h.heapSize++
	return nil
}

func (h *Heap) Remove() (interface{}, error) {
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
