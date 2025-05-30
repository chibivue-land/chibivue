# key 属性和补丁渲染（基础虚拟DOM章节开始）

## 关键错误

实际上，当前 chibivue 的补丁渲染中存在一个关键错误。  
在实现补丁渲染时，

> 关于 patchChildren，需要通过添加 key 等属性来处理动态大小的子元素。

你还记得说过这句话吗？

让我们看看实际会发生什么样的问题。
在当前的实现中，patchChildren 是这样实现的：

```ts
const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
  const c1 = n1.children as VNode[]
  const c2 = n2.children as VNode[]

  for (let i = 0; i < c2.length; i++) {
    const child = (c2[i] = normalizeVNode(c2[i]))
    patch(c1[i], child, container)
  }
}
```

这是基于 c2（即下一个 vnode）的长度进行循环的。
换句话说，它基本上只在 c1 和 c2 相同时才能正常工作。

![c1c2map](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/c1c2map.png)

例如，让我们考虑元素被删除的情况。
由于补丁循环基于 c2，第四个元素的补丁将不会被执行。

![c1c2map_deleted](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/c1c2map_deleted.png)

当变成这样时，第一到第三个元素只是简单地更新，而第四个元素仍然是来自 c1 的未被删除的元素。

让我们看看实际效果。

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ list: ['a', 'b', 'c', 'd'] })
    const updateList = () => {
      state.list = ['e', 'f', 'g']
    }

    return () =>
      h('div', { id: 'app' }, [
        h(
          'ul',
          {},
          state.list.map(item => h('li', {}, [item])),
        ),
        h('button', { onClick: updateList }, ['update']),
      ])
  },
})

app.mount('#app')
```

当你点击更新按钮时，应该是这样的：

![patch_bug](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/patch_bug.png)

虽然列表应该已经更新为 `["e", "f", "g"]`，但 "d" 仍然存在。

实际上，问题不仅仅是这个。让我们考虑元素被插入的情况。
目前，由于循环基于 c2，它变成这样：

![c1c2map_inserted](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/c1c2map_inserted.png)

然而，实际上，"新元素"被插入了，比较应该在 c1 和 c2 的每个 li 1、li 2、li 3 和 li 4 之间进行。

![c1c2map_inserted_correct](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/c1c2map_inserted_correct.png)

这两个问题的共同点是"无法确定 c1 和 c2 中需要被视为相同的节点"。  
为了解决这个问题，需要为元素分配一个 key，并基于该 key 进行补丁。  
现在，让我们看看 Vue 文档中对 key 属性的解释。

> 特殊属性 key 主要用作 Vue 虚拟DOM算法的提示，在比较新旧节点列表时识别 VNode。

https://v3.vuejs.org/guide/migration/key-attribute.html

正如预期的那样，对吧？你可能听过"不要使用索引作为 v-for 的 key"的建议，但在这一点上，key 被隐式设置为索引，这就是为什么会出现上述问题。（循环基于 c2 的长度，并基于该索引进行补丁）

## 基于 key 属性的补丁

实现这些功能的函数是 `patchKeyedChildren`。（让我们在原始 Vue 中搜索它。）

方法是首先为新节点生成 key 和索引的映射。

```ts
let i = 0
const l2 = c2.length
const e1 = c1.length - 1 // prev node 的结束索引
const e2 = l2 - 1 // next node 的结束索引

const s1 = i // prev node 的开始索引
const s2 = i // next node 的开始索引

const keyToNewIndexMap: Map<string | number | symbol, number> = new Map()
for (i = s2; i <= e2; i++) {
  const nextChild = (c2[i] = normalizeVNode(c2[i]))
  if (nextChild.key != null) {
    keyToNewIndexMap.set(nextChild.key, i)
  }
}
```

在原始 Vue 中，这个 `patchKeyedChildren` 分为五个部分：

1. sync from start
2. sync from end
3. common sequence + mount
4. common sequence + unmount
5. unknown sequence

然而，最后一部分 `unknown sequence` 是唯一在功能上必需的，所以我们将从阅读和实现该部分开始。

首先，忘记移动元素，基于 key 对 VNode 进行补丁。
使用我们之前创建的 `keyToNewIndexMap`，计算 n1 和 n2 的配对并对它们进行补丁。
此时，如果有新元素需要挂载或需要卸载，也要执行这些操作。

大致来说，它看起来像这样 ↓（我跳过了很多细节。请阅读 vuejs/core 的 renderer.ts 了解更多详细信息。）

```ts
const toBePatched = e2 + 1
const newIndexToOldIndexMap = new Array(toBePatched) // 新索引到旧索引的映射
for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

// 基于 e1（旧长度）的循环
for (i = 0; i <= e1; i++) {
  const prevChild = c1[i]
  newIndex = keyToNewIndexMap.get(prevChild.key)
  if (newIndex === undefined) {
    // 如果在新的中不存在，卸载它
    unmount(prevChild)
  } else {
    newIndexToOldIndexMap[newIndex] = i + 1 // 形成映射
    patch(prevChild, c2[newIndex] as VNode, container) // 补丁
  }
}

for (i = toBePatched - 1; i >= 0; i--) {
  const nextIndex = i
  const nextChild = c2[nextIndex] as VNode
  if (newIndexToOldIndexMap[i] === 0) {
    // 如果映射不存在（保持初始值），意味着它需要新挂载。（实际上，它存在但不在旧的中）
    patch(null, nextChild, container, anchor)
  }
}
```

## 移动元素

### 方法

#### Node.insertBefore

目前，我们只基于 key 匹配更新每个元素，所以如果元素被移动，我们需要编写代码将其移动到所需位置。

首先，让我们谈谈如何移动元素。我们在 `nodeOps` 的 `insert` 函数中指定锚点。锚点，顾名思义，是一个锚点，如果你查看在 runtime-dom 中实现的 `insert` 方法，你可以看到它是用 `insertBefore` 方法实现的。

```ts
export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  // .
  // .
  // .
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
}
```

通过将节点作为第二个参数传递给此方法，节点将被插入到该节点之前。  
https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore

我们使用这个方法来实际移动 DOM。

#### LIS（最长递增子序列）

现在，让我们谈谈如何编写移动算法。这部分稍微复杂一些。  
与运行 JavaScript 相比，DOM 操作的成本要高得多，所以我们希望尽可能减少不必要的移动次数。  
这就是我们使用"最长递增子序列"（LIS）算法的地方。  
这个算法在数组中找到最长的递增子序列。  
递增子序列是元素按递增顺序排列的子序列。  
例如，给定以下数组：

```
[2, 4, 1, 7, 5, 6]
```

有几个递增子序列：

```
[2, 4]
[2, 5]
.
.
[2, 4, 7]
[2, 4, 5]
.
.
[2, 4, 5, 6]
.
.
[1, 7]
.
.
[1, 5, 6]
```

这些是元素递增的子序列。最长的一个是"最长递增子序列"。  
在这种情况下，`[2, 4, 5, 6]` 是最长递增子序列。在 Vue 中，对应于 2、4、5 和 6 的索引被视为结果数组（即 `[0, 1, 4, 5]`）。

顺便说一下，这里是一个示例函数：

```ts
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
```

我们将使用这个函数从 `newIndexToOldIndexMap` 计算最长递增子序列，并基于此，我们将使用 `insertBefore` 插入其他节点。

### 具体示例

这里有一个具体的示例来让它更容易理解。

让我们考虑两个 VNode 数组，`c1` 和 `c2`。`c1` 表示更新前的状态，`c2` 表示更新后的状态。每个 VNode 都有一个 `key` 属性（实际上，它包含更多信息）。

```js
c1 = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }]
c2 = [{ key: 'a' }, { key: 'b' }, { key: 'd' }, { key: 'c' }]
```

首先，让我们基于 `c2` 生成 `keyToNewIndexMap`（key 到 `c2` 中索引的映射）。
※ 这是之前介绍的代码。

```ts
const keyToNewIndexMap: Map<string | number | symbol, number> = new Map()
for (i = 0; i <= e2; i++) {
  const nextChild = (c2[i] = normalizeVNode(c2[i]))
  if (nextChild.key != null) {
    keyToNewIndexMap.set(nextChild.key, i)
  }
}

// keyToNewIndexMap = { a: 0, b: 1, d: 2, c: 3 }
```

接下来，让我们生成 `newIndexToOldIndexMap`。
※ 这是之前介绍的代码。

```ts
// 初始化

const toBePatched = c2.length
const newIndexToOldIndexMap = new Array(toBePatched) // 新索引到旧索引的映射
for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

// newIndexToOldIndexMap = [0, 0, 0, 0]
```

```ts
// 执行补丁并生成用于移动的 newIndexToOldIndexMap

// 基于 e1（旧长度）的循环
for (i = 0; i <= e1; i++) {
  const prevChild = c1[i]
  newIndex = keyToNewIndexMap.get(prevChild.key)
  if (newIndex === undefined) {
    // 如果在新数组中不存在，卸载它
    unmount(prevChild)
  } else {
    newIndexToOldIndexMap[newIndex] = i + 1 // 形成映射
    patch(prevChild, c2[newIndex] as VNode, container) // 执行补丁
  }
}

// newIndexToOldIndexMap = [1, 2, 4, 3]
```

然后，从获得的 `newIndexToOldIndexMap` 中获取最长递增子序列（新实现从这里开始）。

```ts
const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)
// increasingNewIndexSequence  = [0, 1, 3]
```

```ts
j = increasingNewIndexSequence.length - 1
for (i = toBePatched - 1; i >= 0; i--) {
  const nextIndex = i
  const nextChild = c2[nextIndex] as VNode
  const anchor =
    nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor // ※ parentAnchor 暂时可以认为是参数中接收到的 anchor。

  if (newIndexToOldIndexMap[i] === 0) {
    // newIndexToOldIndexMap 的初始值是 0，所以如果是 0，则判断为不存在到旧元素的映射，即是新元素。
    patch(null, nextChild, container, anchor)
  } else {
    // 如果 i 和 increasingNewIndexSequence[j] 不匹配，则进行移动
    if (j < 0 || i !== increasingNewIndexSequence[j]) {
      move(nextChild, container, anchor)
    } else {
      j--
    }
  }
}
```

### 让我们实现它。

现在我们已经详细解释了方法，让我们实际实现 `patchKeyedChildren`。以下是步骤总结：

1. 准备用于桶接力的 `anchor`（用于在 `move` 中插入）。
2. 基于 `c2` 创建 key 和索引的映射。
3. 基于 key 映射创建 `c2` 和 `c1` 中索引的映射。
   在这个阶段，在基于 `c1` 和基于 `c2` 的循环中执行补丁过程（不包括 `move`）。
4. 基于步骤 3 中获得的映射找到最长递增子序列。
5. 基于步骤 4 中获得的子序列和 `c2` 执行 `move`。

你可以参考原始 Vue 实现或 chibivue 实现作为指导。（我建议在跟随的同时阅读原始 Vue 实现。）
