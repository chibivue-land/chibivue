# 使用位表示 VNode

## 使用位表示 VNode 的类型

VNode 有各种类型。例如，目前实现的包括：

- 组件节点
- 元素节点
- 文本节点
- 子元素是否为文本
- 子元素是否为数组

在未来，将实现更多类型的 VNode。例如，slot、keep-alive、suspense、teleport 等。

目前，分支是使用 `type === Text`、`typeof type === "string"`、`typeof type === "object"` 等条件进行的。

逐一检查这些条件是低效的，所以让我们尝试按照原始实现使用位来表示它们。在 Vue 中，这些位被称为"ShapeFlags"。顾名思义，它们表示 VNode 的形状。（严格来说，在 Vue 中，ShapeFlags 和 Text、Fragment 等符号用于确定 VNode 的类型。）
https://github.com/vuejs/core/blob/main/packages/shared/src/shapeFlags.ts

位标志是指将数字的每一位视为特定标志。

让我们以下面的 VNode 为例：

```ts
const vnode = {
  type: 'div',
  children: [
    { type: 'p', children: ['hello'] },
    { type: 'p', children: ['hello'] },
  ],
}
```

首先，标志的初始值是 0。（为了简单起见，这个解释使用 8 位。）

```ts
let shape = 0b0000_0000
```

现在，这个 VNode 是一个元素并且有一个子元素数组，所以设置 ELEMENT 标志和 ARRAY_CHILDREN 标志。

```ts
shape = shape | ShapeFlags.ELEMENT | ELEMENT.ARRAY_CHILDREN // 0x00010001
```

通过这种方式，我们可以使用一个名为"shape"的数字来表示这个 VNode 是一个元素并且有一个子元素数组的信息。我们可以通过在渲染器或代码的其他部分的分支中使用它来高效地管理 VNode 的类型。

```ts
if (vnode.shape & ShapeFlags.ELEMENT) {
  // vnode 是元素时的处理
}
```

由于这次我们没有实现所有的 ShapeFlags，请尝试实现以下内容作为练习：

```ts
export const enum ShapeFlags {
  ELEMENT = 1,
  COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
}
```

你需要做的是：

- 在 shared/shapeFlags.ts 中定义标志
- 在 runtime-core/vnode.ts 中定义 shape
  ```ts
  export interface VNode<HostNode = any> {
    shapeFlag: number
  }
  ```
  添加这个并在 createVNode 等函数中计算标志。
- 在渲染器中基于 shape 实现分支逻辑。

这就是本章的解释。让我们开始实现吧！
