# key attribute and patch rendering (Basic Virtual DOM section start)

## Critical bug

Actually, there is a critical bug in the current patch rendering of chibivue.  
When implementing patch rendering,

> Regarding patchChildren, it is necessary to handle dynamically sized child elements by adding attributes such as key.

Do you remember saying that?

Let's see what kind of problem actually occurs.
In the current implementation, patchChildren is implemented as follows:

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

This loops based on the length of c2 (i.e., the next vnode).
In other words, it basically only works when c1 and c2 are the same.

![c1c2map](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/c1c2map.png)

For example, let's consider the case where elements are removed.
Since the patch loop is based on c2, the patch for the fourth element will not be performed.

![c1c2map_deleted](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/c1c2map_deleted.png)

When it becomes like this, the first to third elements are simply updated, and the fourth element remains as the one from c1 that is not removed.

Let's see it in action.

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

When you click the update button, it should look like this:

![patch_bug](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/patch_bug.png)

Although the list should have been updated to `["e", "f", "g"]`, "d" remains.

And actually, the problem is not just this. Let's consider the case where elements are inserted.
Currently, since the loop is based on c2, it becomes like this:

![c1c2map_inserted](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/c1c2map_inserted.png)

However, in reality, "new element" was inserted, and the comparison should be made between each li 1, li 2, li 3, and li 4 of c1 and c2.

![c1c2map_inserted_correct](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/c1c2map_inserted_correct.png)

What these two problems have in common is that "the node that needs to be treated as the same in c1 and c2 cannot be determined".  
To solve this, it is necessary to assign a key to the elements and patch based on that key.  
Now, let's take a look at the explanation of the key attribute in the Vue documentation.

> The special attribute key is primarily used as a hint for Vue's Virtual DOM algorithm to identify VNodes when diffing the new list of nodes against the old list.

https://v3.vuejs.org/guide/migration/key-attribute.html

As expected, right? You may have heard the advice "do not use index as the key for v-for", but at this point, the key is implicitly set to the index, which is why the above problems occur. (The loop is based on the length of c2, and patching is done based on that index)

## Patch based on the key attribute

And the function that implements these is `patchKeyedChildren`. (Let's search for it in the original Vue.)

The approach is to first generate a map of keys and indexes for the new nodes.

```ts
let i = 0
const l2 = c2.length
const e1 = c1.length - 1 // end index of prev node
const e2 = l2 - 1 // end index of next node

const s1 = i // start index of prev node
const s2 = i // start index of next node

const keyToNewIndexMap: Map<string | number | symbol, number> = new Map()
for (i = s2; i <= e2; i++) {
  const nextChild = (c2[i] = normalizeVNode(c2[i]))
  if (nextChild.key != null) {
    keyToNewIndexMap.set(nextChild.key, i)
  }
}
```

In the original Vue, this `patchKeyedChildren` is divided into five parts:

1. sync from start
2. sync from end
3. common sequence + mount
4. common sequence + unmount
5. unknown sequence

However, the last part, `unknown sequence`, is the only one that is functionally necessary, so we will start by reading and implementing that part.

First, forget about moving elements and patch VNodes based on the key.
Using the `keyToNewIndexMap` we created earlier, calculate the pairs of n1 and n2 and patch them.
At this point, if there are new elements to be mounted or if there is a need to unmount, perform those operations as well.

Roughly speaking, it looks like this ↓ (I'm skipping a lot of details. Please read vuejs/core's renderer.ts for more details.)

```ts
const toBePatched = e2 + 1
const newIndexToOldIndexMap = new Array(toBePatched) // map of new index to old index
for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

// Loop based on e1 (old len)
for (i = 0; i <= e1; i++) {
  const prevChild = c1[i]
  newIndex = keyToNewIndexMap.get(prevChild.key)
  if (newIndex === undefined) {
    // If it does not exist in the new one, unmount it
    unmount(prevChild)
  } else {
    newIndexToOldIndexMap[newIndex] = i + 1 // Form the map
    patch(prevChild, c2[newIndex] as VNode, container) // Patch
  }
}

for (i = toBePatched - 1; i >= 0; i--) {
  const nextIndex = i
  const nextChild = c2[nextIndex] as VNode
  if (newIndexToOldIndexMap[i] === 0) {
    // If the map does not exist (remains the initial value), it means it needs to be newly mounted. (In fact, it exists and is not in the old one)
    patch(null, nextChild, container, anchor)
  }
}
```

## Moving Elements

### Method

#### Node.insertBefore

Currently, we only update each element based on key matching, so if an element is moved, we need to write code to move it to the desired position.

First, let's talk about how to move elements. We specify the anchor in the `insert` function of `nodeOps`. The anchor, as the name suggests, is an anchor point, and if you look at the `insert` method implemented in runtime-dom, you can see that it is implemented with the `insertBefore` method.

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

By passing the node as the second argument to this method, the node will be inserted right before that node.  
https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore

We use this method to actually move the DOM.

#### LIS (Longest Increasing Subsequence)

Now, let's talk about how to write the algorithm for moving. This part is a bit more complicated.  
DOM operations are much more costly compared to running JavaScript, so we want to minimize the number of unnecessary moves as much as possible.  
That's where we use the "Longest Increasing Subsequence" (LIS) algorithm.  
This algorithm finds the longest increasing subsequence in an array.  
An increasing subsequence is a subsequence in which the elements are in increasing order.  
For example, given the following array:

```
[2, 4, 1, 7, 5, 6]
```

There are several increasing subsequences:

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

These are the subsequences where the elements are increasing. The longest one is the "Longest Increasing Subsequence".  
In this case, `[2, 4, 5, 6]` is the longest increasing subsequence. And in Vue, the indices corresponding to 2, 4, 5, and 6 are treated as the result array (i.e., `[0, 1, 4, 5]`).

By the way, here's an example function:

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

We will use this function to calculate the longest increasing subsequence from `newIndexToOldIndexMap`, and based on that, we will use `insertBefore` to insert the other nodes.

### Concrete Example

Here's a concrete example to make it easier to understand.

Let's consider two arrays of VNodes, `c1` and `c2`. `c1` represents the state before the update, and `c2` represents the state after the update. Each VNode has a `key` attribute (in reality, it holds more information).

```js
c1 = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }]
c2 = [{ key: 'a' }, { key: 'b' }, { key: 'd' }, { key: 'c' }]
```

First, let's generate `keyToNewIndexMap` based on `c2` (a map of keys to indices in `c2`).
※ This is the code introduced earlier.

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

Next, let's generate `newIndexToOldIndexMap`.
※ This is the code introduced earlier.

```ts
// Initialization

const toBePatched = c2.length
const newIndexToOldIndexMap = new Array(toBePatched) // Map of new indices to old indices
for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

// newIndexToOldIndexMap = [0, 0, 0, 0]
```

```ts
// Perform patch and generate newIndexToOldIndexMap for move

// Loop based on e1 (old len)
for (i = 0; i <= e1; i++) {
  const prevChild = c1[i]
  newIndex = keyToNewIndexMap.get(prevChild.key)
  if (newIndex === undefined) {
    // If it doesn't exist in the new array, unmount it
    unmount(prevChild)
  } else {
    newIndexToOldIndexMap[newIndex] = i + 1 // Form the map
    patch(prevChild, c2[newIndex] as VNode, container) // Perform patch
  }
}

// newIndexToOldIndexMap = [1, 2, 4, 3]
```

Then, obtain the longest increasing subsequence from the obtained `newIndexToOldIndexMap` (new implementation starts here).

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
    nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor // ※ parentAnchor はとりあえず引数で受け取った anchor だと思ってもらえれば。

  if (newIndexToOldIndexMap[i] === 0) {
    // newIndexToOldIndexMap は初期値が 0 なので、0 の場合は古い要素への map が存在しない、つまり新しい要素だというふうに判定している。
    patch(null, nextChild, container, anchor)
  } else {
    // i と increasingNewIndexSequence[j] が一致しなければ move する
    if (j < 0 || i !== increasingNewIndexSequence[j]) {
      move(nextChild, container, anchor)
    } else {
      j--
    }
  }
}
```

### Let's implement it.

Now that we have explained the approach in detail, let's actually implement `patchKeyedChildren`. Here is a summary of the steps:

1. Prepare the `anchor` for bucket relay (used for inserting in `move`).
2. Create a map of keys and indices based on `c2`.
3. Create a map of indices in `c2` and `c1` based on the key map.  
   At this stage, perform the patching process in both `c1`-based and `c2`-based loops (excluding `move`).
4. Find the longest increasing subsequence based on the map obtained in step 3.
5. Perform `move` based on the subsequence obtained in step 4 and `c2`.

You can refer to the original Vue implementation or the chibivue implementation for guidance. (I recommend reading the original Vue implementation while following along.)
