# 使用位元表示 VNode

## 使用位元表示 VNode 的類型

VNode 有各種類型。例如，目前實現的包括：

- 組件節點
- 元素節點
- 文字節點
- 子元素是否為文字
- 子元素是否為陣列

在未來，將實現更多類型的 VNode。例如，slot、keep-alive、suspense、teleport 等。

目前，分支是使用 `type === Text`、`typeof type === "string"`、`typeof type === "object"` 等條件進行的。

逐一檢查這些條件是低效的，所以讓我們嘗試按照原始實現使用位元來表示它們。在 Vue 中，這些位元被稱為"ShapeFlags"。顧名思義，它們表示 VNode 的形狀。（嚴格來說，在 Vue 中，ShapeFlags 和 Text、Fragment 等符號用於確定 VNode 的類型。）
https://github.com/vuejs/core/blob/main/packages/shared/src/shapeFlags.ts

位元標誌是指將數字的每一位元視為特定標誌。

讓我們以下面的 VNode 為例：

```ts
const vnode = {
  type: 'div',
  children: [
    { type: 'p', children: ['hello'] },
    { type: 'p', children: ['hello'] },
  ],
}
```

首先，標誌的初始值是 0。（為了簡單起見，這個解釋使用 8 位元。）

```ts
let shape = 0b0000_0000
```

現在，這個 VNode 是一個元素並且有一個子元素陣列，所以設置 ELEMENT 標誌和 ARRAY_CHILDREN 標誌。

```ts
shape = shape | ShapeFlags.ELEMENT | ELEMENT.ARRAY_CHILDREN // 0x00010001
```

透過這種方式，我們可以使用一個名為"shape"的數字來表示這個 VNode 是一個元素並且有一個子元素陣列的資訊。我們可以透過在渲染器或程式碼的其他部分的分支中使用它來高效地管理 VNode 的類型。

```ts
if (vnode.shape & ShapeFlags.ELEMENT) {
  // vnode 是元素時的處理
}
```

由於這次我們沒有實現所有的 ShapeFlags，請嘗試實現以下內容作為練習：

```ts
export const enum ShapeFlags {
  ELEMENT = 1,
  COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
}
```

你需要做的是：

- 在 shared/shapeFlags.ts 中定義標誌
- 在 runtime-core/vnode.ts 中定義 shape
  ```ts
  export interface VNode<HostNode = any> {
    shapeFlag: number
  }
  ```
  添加這個並在 createVNode 等函式中計算標誌。
- 在渲染器中基於 shape 實現分支邏輯。

這就是本章的解釋。讓我們開始實現吧！
