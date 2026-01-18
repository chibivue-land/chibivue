# Tree Flattening（Block Tree）

## 什么是 Tree Flattening？

Tree Flattening（Block Tree）是 Vue 3 引入的高级优化技术．它"扁平化"并收集模板内的动态节点，允许在更新时直接更新动态节点，而不是遍历整个树．

<KawaikoNote variant="question" title="为什么叫'扁平化'？">

传统的 Virtual DOM 在更新时需要递归遍历整个树．
Tree Flattening 将动态节点"扁平化"到数组中，
允许直接访问而忽略嵌套结构．

</KawaikoNote>

## 传统 diff 算法的问题

### 模板示例

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
      <p>{{ dynamicText }}</p>  <!-- 唯一的动态部分 -->
    </main>
    <footer>
      <p>Copyright 2024</p>
    </footer>
  </div>
</template>
```

### 传统方法

```
遍历整个树：
div
├── header (静态)
│   ├── h1 (静态)
│   └── nav (静态)
│       ├── a (静态)
│       └── a (静态)
├── main
│   └── p (动态) ← 实际上只有这里需要更新
└── footer (静态)
    └── p (静态)

→ 遍历 9 个节点来更新 1 个
```

### Tree Flattening 方法

```
只收集动态节点：
dynamicChildren = [p]

→ 直接更新 1 个节点
```

<KawaikoNote variant="funny" title="戏剧性的效率提升！">

如果 1000 个节点中只有 10 个是动态的：
传统方法需要 1000 次比较，
但 Tree Flattening 只需要 10 次比较．

</KawaikoNote>

## Block 概念

### 什么是 Block？

Block 是"具有稳定结构的 VNode 子树"．在 Block 内，保证以下几点：

1. 子节点数量不变
2. 子节点顺序不变
3. 没有结构性指令（`v-if`，`v-for`）

### 创建 Block 的元素

以下元素会创建新的 Block：

- 根元素
- `v-if` 的每个分支
- `v-for` 的每个项目
- 组件

```vue
<template>
  <!-- Block 1: 根 -->
  <div>
    <p>{{ text1 }}</p>

    <!-- Block 2: v-if -->
    <div v-if="show">
      <p>{{ text2 }}</p>
    </div>

    <!-- Block 3, 4, ...: 每个 v-for 项目 -->
    <div v-for="item in items" :key="item.id">
      <p>{{ item.text }}</p>
    </div>
  </div>
</template>
```

## VNode 扩展

### dynamicChildren

向 VNode 添加 `dynamicChildren` 属性来收集动态子节点．

```ts
export interface VNode {
  // ... 现有属性

  /**
   * Block 内动态子节点的列表
   * 更新时只需要遍历这些
   */
  dynamicChildren: VNode[] | null;

  /**
   * patch 处理的优化提示
   */
  patchFlag: number;

  /**
   * 动态属性名称列表
   */
  dynamicProps: string[] | null;
}
```

## openBlock 和 createBlock

### Block 追踪

Block 的创建通过 `openBlock` 和 `createBlock` 配对完成．

```ts
// 当前追踪的 Block
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

  // 设置收集的动态节点
  vnode.dynamicChildren = currentBlock;
  currentBlock = null;

  return vnode;
}
```

### 收集动态节点

在 `createVNode` 中，有 patchFlag 的 VNode 会被添加到 currentBlock．

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

  // 有 patchFlag = 动态节点
  // 如果 currentBlock 存在则添加
  if (patchFlag !== undefined && patchFlag > 0 && currentBlock) {
    currentBlock.push(vnode);
  }

  return vnode;
}
```

## 生成的代码

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

### 生成的渲染函数

```js
import { openBlock, createBlock, createVNode, toDisplayString } from 'vue'

// 静态节点提升到外部
const _hoisted_1 = createVNode("h1", null, "Static Title")

function render(_ctx) {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 静态（不包含在 dynamicChildren 中）
      createVNode("p", null, toDisplayString(_ctx.message), 1 /* TEXT */),
      createVNode("span", { class: _ctx.cls }, toDisplayString(_ctx.text), 3 /* TEXT | CLASS */)
    ])
  )
}

// 结果 VNode：
// {
//   type: "div",
//   children: [_hoisted_1, p, span],
//   dynamicChildren: [p, span]  // 只有动态节点
// }
```

## patchBlockChildren 实现

更新 Block 时，只遍历 `dynamicChildren`．

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

    // 只 patch 动态节点
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

  // 使用 patchFlag 的优化 patch
  const { patchFlag, dynamicChildren } = n2;

  if (patchFlag > 0) {
    // 基于 patchFlag 只更新特定属性
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

  // 如果有 dynamicChildren，使用优化路径
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

## 优化效果

考虑 1000 个列表项中只更新 1 个的情况：

- **完整 diff**：遍历 1000 个以上的节点
- **仅 Patch Flags**：遍历 1000 个节点（属性比较被优化）
- **Tree Flattening**：只遍历动态节点（1 个）

动态节点越少，Tree Flattening 的效果就越大．

## Block 失效的情况

在以下情况下，Block 优化会被禁用（BAIL 模式）：

1. **结构性指令**：`v-if`，`v-for` 创建新的 Block
2. **动态组件**：`<component :is="...">`
3. **插槽出口**：`<slot />`

```vue
<template>
  <div>
    <!-- 这里 Block 被分割 -->
    <div v-if="show">
      <p>{{ a }}</p>  <!-- Block A 的 dynamicChildren -->
    </div>
    <div v-else>
      <p>{{ b }}</p>  <!-- Block B 的 dynamicChildren -->
    </div>
  </div>
</template>
```

## 与 Static Hoisting 的集成

Tree Flattening 与 Static Hoisting 结合时效果最佳．

```ts
// 静态节点被提升，不包含在 dynamicChildren 中
const _hoisted_1 = createVNode("header", null, [
  createVNode("h1", null, "Title"),
  createVNode("nav", null, [/* ... */])
]);

function render() {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // 静态：跳过
      createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 动态：追踪
    ])
  )
}
```

1. **Static Hoisting**：将静态节点提升到函数外部（跳过 VNode 生成）
2. **Tree Flattening**：只收集动态节点（限制 diff 目标）
3. **Patch Flags**：只更新动态属性（优化属性比较）

## 处理流程

```
[编译时]
模板解析
  ↓
检测静态节点 → Static Hoisting
  ↓
检测动态节点 → 添加 Patch Flags
  ↓
识别 Block 边界 → 插入 openBlock/createBlock

[运行时]
openBlock() → currentBlock = []
  ↓
createVNode (静态) → 不添加到 currentBlock
  ↓
createVNode (动态) → currentBlock.push(vnode)
  ↓
createBlock() → vnode.dynamicChildren = currentBlock

[更新时]
patchElement(n1, n2)
  ↓
n2.dynamicChildren 存在？
  ↓ 是
patchBlockChildren(n1.dynamicChildren, n2.dynamicChildren)
  ↓
只 patch 动态节点
```

## 总结

Tree Flattening（Block Tree）实现由以下部分组成：

1. **dynamicChildren**：收集动态子节点的数组
2. **openBlock / createBlock**：Block 创建和追踪
3. **patchBlockChildren**：只 patch 动态节点
4. **Block 边界管理**：用 `v-if`，`v-for` 等创建新 Block

这个优化使 Vue 3 即使在大规模应用程序中也能实现快速更新．与 Static Hoisting 和 Patch Flags 结合时，可以实现基于模板的框架特有的优化．
