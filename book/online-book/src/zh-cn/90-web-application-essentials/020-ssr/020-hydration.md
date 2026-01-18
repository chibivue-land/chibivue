# Hydration（水合）

## 什么是 Hydration？

在上一章中，我们学习了如何使用 `renderToString` 将 Vue 组件渲染为 HTML 字符串．但是，SSR 生成的 HTML 只是静态标记——事件处理器和响应式都不起作用．

Hydration（水合）是将服务器生成的 HTML "激活"为客户端 Vue 应用程序的过程．

<KawaikoNote variant="question" title="为什么叫'水合'？">

"Hydration"（水合）这个名字来自于给静态 HTML "注入生命"的形象．
就像干枯的植物浇水后会变得生机勃勃一样，我们向静态 HTML 注入事件处理器和响应式．

</KawaikoNote>

## 与普通挂载的区别

### 普通 `createApp`

```
1. 生成 VNode
2. 创建新的 DOM 元素
3. 将 DOM 插入容器
```

### `createSSRApp`（Hydration）

```
1. 生成 VNode
2. 遍历已存在的 DOM 元素
3. 将 VNode 与 DOM 元素关联
4. 附加事件处理器
```

<KawaikoNote variant="funny" title="Hydration 的本质">

Hydration 可以理解为"不创建 DOM 的渲染"．
由于 DOM 已经存在，我们只需要将它与 VNode 关联起来．

</KawaikoNote>

## 类型定义

### HydrateOptions

定义 Hydration 所需的选项．

```ts
// runtime-core/hydration.ts
export interface HydrateOptions {
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  nextSibling: (node: Node) => Node | null;
}
```

- `patchProp`：将属性（特别是事件处理器）附加到 DOM 元素的函数
- `nextSibling`：遍历 DOM 树的函数

## createHydrationRenderer 实现

### 基本结构

```ts
// runtime-core/hydration.ts
export function createHydrationRenderer(options: HydrateOptions) {
  const { patchProp, nextSibling } = options;

  function hydrate(vnode: VNode, container: Element): void {
    const node = container.firstChild;
    if (node) {
      hydrateNode(node, vnode, null);
    }
  }

  // ... 其他函数

  return { hydrate };
}
```

`hydrate` 函数从容器的第一个子节点开始，并行遍历 VNode 树和 DOM 树．

### hydrateNode - 根据节点类型分支

```ts
function hydrateNode(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  const { type, shapeFlag } = vnode;

  // 重要：将 VNode 与 DOM 元素关联
  vnode.el = node;

  if (type === Text) {
    // 文本节点：返回下一个兄弟节点
    return nextSibling(node);
  } else if (type === Comment) {
    // 注释节点：返回下一个兄弟节点
    return nextSibling(node);
  } else if (type === Fragment) {
    // Fragment：特殊处理
    return hydrateFragment(node, vnode, parentComponent);
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    // HTML 元素：也处理子元素
    return hydrateElement(node as Element, vnode, parentComponent);
  }

  return nextSibling(node);
}
```

要点：
- `vnode.el = node` 是最重要的操作．这使后续更新能够引用正确的 DOM 元素
- 每个函数返回"下一个要处理的 DOM 节点"

### hydrateElement - HTML 元素的水合

```ts
function hydrateElement(
  el: Element,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  vnode.el = el;

  const { props, children, shapeFlag } = vnode;

  // 附加事件处理器
  if (props) {
    for (const key in props) {
      if (key.startsWith("on") && typeof props[key] === "function") {
        patchProp(el, key, null, props[key]);
      }
    }
  }

  // 水合子元素
  if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    hydrateChildren(el.firstChild, children as VNode[], parentComponent);
  }

  return nextSibling(el);
}
```

<KawaikoNote variant="warning" title="只附加事件处理器">

Hydration 时我们只处理事件处理器（以 `on` 开头的 props）．
像 `class` 或 `style` 这样的属性已经包含在 SSR 的 HTML 中，所以不需要附加．

</KawaikoNote>

### hydrateChildren - 处理子元素

```ts
function hydrateChildren(
  node: Node | null,
  children: VNode[],
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  for (let i = 0; i < children.length; i++) {
    const child = normalizeVNode(children[i]);
    if (node) {
      node = hydrateNode(node, child, parentComponent);
    }
  }
  return node;
}
```

按顺序处理 VNode 子元素和 DOM 子节点．每个 `hydrateNode` 返回下一个兄弟节点，用于继续遍历．

### hydrateFragment - Fragment 处理

在 SSR 中，Fragment 被包装在 `<!--[-->` 和 `<!--]-->` 注释节点中渲染．

```ts
function hydrateFragment(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  // 将开始注释（<!--[-->）设置到 el
  vnode.el = node;

  // 子元素从开始注释之后开始
  let current = nextSibling(node);
  const children = vnode.children as VNode[];

  if (children && children.length > 0) {
    current = hydrateChildren(current, children, parentComponent);
  }

  // 将结束注释（<!--]-->）设置到 anchor
  vnode.anchor = current;
  return current ? nextSibling(current) : null;
}
```

```html
<!-- SSR 输出示例 -->
<!--[-->
<p>Item 1</p>
<p>Item 2</p>
<p>Item 3</p>
<!--]-->
```

## createSSRApp 实现

`createSSRApp` 与普通的 `createApp` 几乎相同，但在挂载时执行 Hydration．

```ts
// runtime-dom/index.ts

// 创建 Hydration 渲染器
const { hydrate: hydrateVNode } = createHydrationRenderer({
  patchProp,
  nextSibling: nodeOps.nextSibling,
});

export const createSSRApp = ((...args) => {
  const app = _createApp(...args);
  const { mount } = app;

  app.mount = (selector: string) => {
    const container = document.querySelector(selector);
    if (!container) return;

    // 检查容器是否有 SSR 内容
    if (container.hasChildNodes()) {
      // 执行 Hydration
      const proxy = mount(container, true /* isHydrate */);
      return proxy;
    } else {
      // 如果没有 SSR 内容，普通挂载
      mount(container);
    }
  };

  return app;
}) as CreateAppFunction<Element>;
```

## 处理流程

```
[服务器端]
renderToString(app)
  ↓
<div id="app">
  <button>Count: 0</button>
</div>

[客户端]
createSSRApp(App).mount('#app')
  ↓
container.hasChildNodes() → true
  ↓
hydrate(vnode, container)
  ↓
hydrateNode(button, vnode)
  ├── vnode.el = button  ← 将 VNode 与 DOM 关联
  └── patchProp(button, 'onClick', null, handler)  ← 附加事件
  ↓
点击按钮触发响应式
```

## 使用示例

### 服务器端

```ts
// server.ts
import { createApp } from '@chibivue/runtime-dom'
import { renderToString } from '@chibivue/server-renderer'
import App from './App.vue'

const app = createApp(App)
const html = await renderToString(app)

// 将 HTML 发送给客户端
res.send(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="app">${html}</div>
      <script src="/client.js"></script>
    </body>
  </html>
`)
```

### 客户端

```ts
// client.ts
import { createSSRApp } from '@chibivue/runtime-dom'
import App from './App.vue'

// 使用 createSSRApp（不是 createApp）
const app = createSSRApp(App)
app.mount('#app')
```

### App 组件

```vue
<!-- App.vue -->
<script setup>
import { ref } from '@chibivue/runtime-core'

const count = ref(0)
const increment = () => count.value++
</script>

<template>
  <button @click="increment">Count: {{ count }}</button>
</template>
```

## Hydration 不匹配

在 Hydration 期间，SSR 生成的 HTML 必须与客户端生成的 VNode 匹配．如果不匹配，就会发生"Hydration 不匹配"．

### 常见原因

1. **日期/随机数**：`new Date()` 或 `Math.random()` 在服务器和客户端产生不同的值
2. **浏览器特定的 API**：`window` 或 `localStorage` 在服务器上不存在
3. **条件分支**：服务器和客户端走不同的代码路径

### 解决方案

```vue
<script setup>
import { ref, onMounted } from '@chibivue/runtime-core'

// 服务器和客户端相同的初始值
const clientOnly = ref(false)

// 仅在客户端更新
onMounted(() => {
  clientOnly.value = true
})
</script>

<template>
  <div v-if="clientOnly">
    This content is only shown on client
  </div>
</template>
```

<KawaikoNote variant="warning" title="注意不匹配！">

当 Hydration 不匹配发生时，Vue 会发出警告，最坏的情况下 DOM 可能会损坏．
注意确保服务器和客户端产生相同的输出．

</KawaikoNote>

## 未来扩展

当前实现是最小化的，但 Vue 本身有以下功能：

1. **Hydration 不匹配检测**：在开发模式下检测服务器/客户端不一致
2. **部分 Hydration**：只水合必要的部分（性能优化）
3. **使用 PatchFlags 优化**：跳过静态节点的 Hydration
4. **异步组件 Hydration**：与 `Suspense` 集成

<KawaikoNote variant="surprise" title="Hydration 完成！">

现在我们拥有了 SSR 的所有部分．
通过使用 `renderToString` 进行服务器端渲染和
`createSSRApp` 进行 Hydration，
我们可以实现完整的 SSR 应用程序．

</KawaikoNote>

## 总结

Hydration 实现由以下部分组成：

1. **createHydrationRenderer**：创建用于 Hydration 的渲染器
2. **hydrateNode**：根据 VNode 类型分支处理
3. **hydrateElement**：HTML 元素和事件处理器附加
4. **hydrateChildren**：递归处理子元素
5. **hydrateFragment**：处理 Fragment（被注释节点包围的区域）
6. **createSSRApp**：支持 Hydration 的应用程序工厂

Hydration 的本质是"将 VNode 与已存在的 DOM 关联而不重新创建"．这使得 SSR 的快速初始显示和 SPA 的丰富交互性得以兼顾．
