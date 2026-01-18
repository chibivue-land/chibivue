# Tree Flattening（Block Tree）

## 什麼是 Tree Flattening？

Tree Flattening（Block Tree）是 Vue 3 引入的高級最佳化技術．它「扁平化」並收集模板內的動態節點，允許在更新時直接更新動態節點，而不是遍歷整個樹．

<KawaikoNote variant="question" title="為什麼叫『扁平化』？">

傳統的 Virtual DOM 在更新時需要遞迴遍歷整個樹．
Tree Flattening 將動態節點「扁平化」到陣列中，
允許直接存取而忽略巢狀結構．

</KawaikoNote>

## 傳統 diff 演算法的問題

### 模板範例

```vue
<template>
  <div>
    <header>
      <h1>Static Title</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <p>{{ dynamicText }}</p>  <!-- 唯一的動態部分 -->
    </main>
    <footer>
      <p>Copyright 2024</p>
    </footer>
  </div>
</template>
```

### 傳統方法

```
遍歷整個樹：
div
├── header (靜態)
│   ├── h1 (靜態)
│   └── nav (靜態)
│       ├── a (靜態)
│       └── a (靜態)
├── main
│   └── p (動態) ← 實際上只有這裡需要更新
└── footer (靜態)
    └── p (靜態)

→ 遍歷 9 個節點來更新 1 個
```

### Tree Flattening 方法

```
只收集動態節點：
dynamicChildren = [p]

→ 直接更新 1 個節點
```

<KawaikoNote variant="funny" title="戲劇性的效率提升！">

如果 1000 個節點中只有 10 個是動態的：
傳統方法：1000 次比較
Tree Flattening：10 次比較
可能實現 100 倍的效率提升．

</KawaikoNote>

## Block 概念

### 什麼是 Block？

Block 是「具有穩定結構的 VNode 子樹」．在 Block 內，保證以下幾點：

1. 子節點數量不變
2. 子節點順序不變
3. 沒有結構性指令（`v-if`，`v-for`）

### 建立 Block 的元素

以下元素會建立新的 Block：

- 根元素
- `v-if` 的每個分支
- `v-for` 的每個項目
- 組件

```vue
<template>
  <!-- Block 1: 根 -->
  <div>
    <p>{{ text1 }}</p>

    <!-- Block 2: v-if -->
    <div v-if="show">
      <p>{{ text2 }}</p>
    </div>

    <!-- Block 3, 4, ...: 每個 v-for 項目 -->
    <div v-for="item in items" :key="item.id">
      <p>{{ item.text }}</p>
    </div>
  </div>
</template>
```

## VNode 擴展

### dynamicChildren

向 VNode 添加 `dynamicChildren` 屬性來收集動態子節點．

```ts
export interface VNode {
  // ... 現有屬性

  /**
   * Block 內動態子節點的列表
   * 更新時只需要遍歷這些
   */
  dynamicChildren: VNode[] | null;

  /**
   * patch 處理的最佳化提示
   */
  patchFlag: number;

  /**
   * 動態屬性名稱列表
   */
  dynamicProps: string[] | null;
}
```

## openBlock 和 createBlock

### Block 追蹤

Block 的建立通過 `openBlock` 和 `createBlock` 配對完成．

```ts
// 當前追蹤的 Block
let currentBlock: VNode[] | null = null;

export function openBlock(): void {
  currentBlock = [];
}

export function createBlock(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(type, props, children, patchFlag, dynamicProps);

  // 設定收集的動態節點
  vnode.dynamicChildren = currentBlock;
  currentBlock = null;

  return vnode;
}
```

### 收集動態節點

在 `createVNode` 中，有 patchFlag 的 VNode 會被添加到 currentBlock．

```ts
export function createVNode(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode: VNode = {
    type,
    props,
    children,
    patchFlag: patchFlag || 0,
    dynamicProps: dynamicProps || null,
    dynamicChildren: null,
    // ...
  };

  // 有 patchFlag = 動態節點
  // 如果 currentBlock 存在則添加
  if (patchFlag !== undefined && patchFlag > 0 && currentBlock) {
    currentBlock.push(vnode);
  }

  return vnode;
}
```

## 生成的程式碼

### 模板

```vue
<template>
  <div>
    <h1>Static Title</h1>
    <p>{{ message }}</p>
    <span :class="cls">{{ text }}</span>
  </div>
</template>
```

### 生成的渲染函數

```js
import { openBlock, createBlock, createVNode, toDisplayString } from 'vue'

// 靜態節點提升到外部
const _hoisted_1 = createVNode("h1", null, "Static Title")

function render(_ctx) {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 靜態（不包含在 dynamicChildren 中）
      createVNode("p", null, toDisplayString(_ctx.message), 1 /* TEXT */),
      createVNode("span", { class: _ctx.cls }, toDisplayString(_ctx.text), 3 /* TEXT | CLASS */)
    ])
  )
}

// 結果 VNode：
// {
//   type: "div",
//   children: [_hoisted_1, p, span],
//   dynamicChildren: [p, span]  // 只有動態節點
// }
```

## patchBlockChildren 實現

更新 Block 時，只遍歷 `dynamicChildren`．

```ts
function patchBlockChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: RendererElement,
  parentComponent: ComponentInternalInstance | null
): void {
  for (let i = 0; i < newChildren.length; i++) {
    const oldVNode = oldChildren[i];
    const newVNode = newChildren[i];

    // 只 patch 動態節點
    patch(oldVNode, newVNode, container, null, parentComponent);
  }
}
```

### 在 patchElement 中的使用

```ts
function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInternalInstance | null
): void {
  const el = (n2.el = n1.el!);
  const oldProps = n1.props || {};
  const newProps = n2.props || {};

  // 使用 patchFlag 的最佳化 patch
  const { patchFlag, dynamicChildren } = n2;

  if (patchFlag > 0) {
    // 基於 patchFlag 只更新特定屬性
    if (patchFlag & PatchFlags.CLASS) {
      patchClass(el, newProps.class);
    }
    if (patchFlag & PatchFlags.STYLE) {
      patchStyle(el, oldProps.style, newProps.style);
    }
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        el.textContent = n2.children as string;
      }
    }
    // ...
  }

  // 如果有 dynamicChildren，使用最佳化路徑
  if (dynamicChildren) {
    patchBlockChildren(
      n1.dynamicChildren!,
      dynamicChildren,
      el,
      parentComponent
    );
  } else {
    // 回退：普通子元素 patch
    patchChildren(n1, n2, el, parentComponent);
  }
}
```

## 最佳化效果

### 基準測試範例

1000 個列表項中只更新 1 個的情況：

| 方法 | 遍歷節點數 | 相對效能 |
|------|-----------|---------|
| 完整 diff | 1000+ | 1x |
| 僅 Patch Flags | 1000 | 2-3x |
| Tree Flattening | 1 | 50-100x |

<KawaikoNote variant="surprise" title="驚人的效率！">

在大規模應用程式中，Tree Flattening 可以將更新效能提升數十倍．
這是 Vue 3 被稱為快速的原因之一．

</KawaikoNote>

## Block 失效的情況

在以下情況下，Block 最佳化會被禁用（BAIL 模式）：

1. **結構性指令**：`v-if`，`v-for` 建立新的 Block
2. **動態組件**：`<component :is="...">`
3. **插槽出口**：`<slot />`

```vue
<template>
  <div>
    <!-- 這裡 Block 被分割 -->
    <div v-if="show">
      <p>{{ a }}</p>  <!-- Block A 的 dynamicChildren -->
    </div>
    <div v-else>
      <p>{{ b }}</p>  <!-- Block B 的 dynamicChildren -->
    </div>
  </div>
</template>
```

## 與 Static Hoisting 的整合

Tree Flattening 與 Static Hoisting 結合時效果最佳．

```ts
// 靜態節點被提升，不包含在 dynamicChildren 中
const _hoisted_1 = createVNode("header", null, [
  createVNode("h1", null, "Title"),
  createVNode("nav", null, [/* ... */])
]);

function render() {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 靜態：跳過
      createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 動態：追蹤
    ])
  )
}
```

1. **Static Hoisting**：將靜態節點提升到函數外部（跳過 VNode 生成）
2. **Tree Flattening**：只收集動態節點（限制 diff 目標）
3. **Patch Flags**：只更新動態屬性（最佳化屬性比較）

## 處理流程

```
[編譯時]
模板解析
  ↓
偵測靜態節點 → Static Hoisting
  ↓
偵測動態節點 → 添加 Patch Flags
  ↓
識別 Block 邊界 → 插入 openBlock/createBlock

[執行時]
openBlock() → currentBlock = []
  ↓
createVNode (靜態) → 不添加到 currentBlock
  ↓
createVNode (動態) → currentBlock.push(vnode)
  ↓
createBlock() → vnode.dynamicChildren = currentBlock

[更新時]
patchElement(n1, n2)
  ↓
n2.dynamicChildren 存在？
  ↓ 是
patchBlockChildren(n1.dynamicChildren, n2.dynamicChildren)
  ↓
只 patch 動態節點
```

## 總結

Tree Flattening（Block Tree）實現由以下部分組成：

1. **dynamicChildren**：收集動態子節點的陣列
2. **openBlock / createBlock**：Block 建立和追蹤
3. **patchBlockChildren**：只 patch 動態節點
4. **Block 邊界管理**：用 `v-if`，`v-for` 等建立新 Block

這個最佳化使 Vue 3 即使在大規模應用程式中也能實現快速更新．與 Static Hoisting 和 Patch Flags 結合時，可以實現基於模板的框架特有的最佳化．
