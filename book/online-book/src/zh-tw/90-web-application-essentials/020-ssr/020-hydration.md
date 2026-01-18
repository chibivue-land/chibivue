# Hydration（水合）

## 什麼是 Hydration？

在上一章中，我們學習了如何使用 `renderToString` 將 Vue 組件渲染為 HTML 字串．但是，SSR 生成的 HTML 只是靜態標記——事件處理器和響應式都不起作用．

Hydration（水合）是將伺服器生成的 HTML「激活」為客戶端 Vue 應用程式的過程．

<KawaikoNote variant="question" title="為什麼叫『水合』？">

「Hydration」（水合）這個名字來自於給靜態 HTML「注入生命」的形象．
就像乾枯的植物澆水後會變得生機勃勃一樣，我們向靜態 HTML 注入事件處理器和響應式．

</KawaikoNote>

## 與普通掛載的區別

### 普通 `createApp`

```
1. 生成 VNode
2. 建立新的 DOM 元素
3. 將 DOM 插入容器
```

### `createSSRApp`（Hydration）

```
1. 生成 VNode
2. 遍歷已存在的 DOM 元素
3. 將 VNode 與 DOM 元素關聯
4. 附加事件處理器
```

<KawaikoNote variant="funny" title="Hydration 的本質">

Hydration 可以理解為「不建立 DOM 的渲染」．
由於 DOM 已經存在，我們只需要將它與 VNode 關聯起來．

</KawaikoNote>

## 類型定義

### HydrateOptions

定義 Hydration 所需的選項．

```ts
// runtime-core/hydration.ts
export interface HydrateOptions {
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  nextSibling: (node: Node) => Node | null;
}
```

- `patchProp`：將屬性（特別是事件處理器）附加到 DOM 元素的函數
- `nextSibling`：遍歷 DOM 樹的函數

## createHydrationRenderer 實現

### 基本結構

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

  // ... 其他函數

  return { hydrate };
}
```

`hydrate` 函數從容器的第一個子節點開始，並行遍歷 VNode 樹和 DOM 樹．

### hydrateNode - 根據節點類型分支

```ts
function hydrateNode(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  const { type, shapeFlag } = vnode;

  // 重要：將 VNode 與 DOM 元素關聯
  vnode.el = node;

  if (type === Text) {
    // 文字節點：返回下一個兄弟節點
    return nextSibling(node);
  } else if (type === Comment) {
    // 註解節點：返回下一個兄弟節點
    return nextSibling(node);
  } else if (type === Fragment) {
    // Fragment：特殊處理
    return hydrateFragment(node, vnode, parentComponent);
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    // HTML 元素：也處理子元素
    return hydrateElement(node as Element, vnode, parentComponent);
  }

  return nextSibling(node);
}
```

要點：
- `vnode.el = node` 是最重要的操作．這使後續更新能夠引用正確的 DOM 元素
- 每個函數返回「下一個要處理的 DOM 節點」

### hydrateElement - HTML 元素的水合

```ts
function hydrateElement(
  el: Element,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  vnode.el = el;

  const { props, children, shapeFlag } = vnode;

  // 附加事件處理器
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

<KawaikoNote variant="warning" title="只附加事件處理器">

Hydration 時我們只處理事件處理器（以 `on` 開頭的 props）．
像 `class` 或 `style` 這樣的屬性已經包含在 SSR 的 HTML 中，所以不需要附加．

</KawaikoNote>

### hydrateChildren - 處理子元素

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

按順序處理 VNode 子元素和 DOM 子節點．每個 `hydrateNode` 返回下一個兄弟節點，用於繼續遍歷．

### hydrateFragment - Fragment 處理

在 SSR 中，Fragment 被包裝在 `<!--[-->` 和 `<!--]-->` 註解節點中渲染．

```ts
function hydrateFragment(
  node: Node,
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null,
): Node | null {
  // 將開始註解（<!--[-->）設定到 el
  vnode.el = node;

  // 子元素從開始註解之後開始
  let current = nextSibling(node);
  const children = vnode.children as VNode[];

  if (children && children.length > 0) {
    current = hydrateChildren(current, children, parentComponent);
  }

  // 將結束註解（<!--]-->）設定到 anchor
  vnode.anchor = current;
  return current ? nextSibling(current) : null;
}
```

```html
<!-- SSR 輸出範例 -->
<!--[-->
<p>Item 1</p>
<p>Item 2</p>
<p>Item 3</p>
<!--]-->
```

## createSSRApp 實現

`createSSRApp` 與普通的 `createApp` 幾乎相同，但在掛載時執行 Hydration．

```ts
// runtime-dom/index.ts

// 建立 Hydration 渲染器
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

    // 檢查容器是否有 SSR 內容
    if (container.hasChildNodes()) {
      // 執行 Hydration
      const proxy = mount(container, true /* isHydrate */);
      return proxy;
    } else {
      // 如果沒有 SSR 內容，普通掛載
      mount(container);
    }
  };

  return app;
}) as CreateAppFunction<Element>;
```

## 處理流程

```
[伺服器端]
renderToString(app)
  ↓
<div id="app">
  <button>Count: 0</button>
</div>

[客戶端]
createSSRApp(App).mount('#app')
  ↓
container.hasChildNodes() → true
  ↓
hydrate(vnode, container)
  ↓
hydrateNode(button, vnode)
  ├── vnode.el = button  ← 將 VNode 與 DOM 關聯
  └── patchProp(button, 'onClick', null, handler)  ← 附加事件
  ↓
點擊按鈕觸發響應式
```

## 使用範例

### 伺服器端

```ts
// server.ts
import { createApp } from '@chibivue/runtime-dom'
import { renderToString } from '@chibivue/server-renderer'
import App from './App.vue'

const app = createApp(App)
const html = await renderToString(app)

// 將 HTML 傳送給客戶端
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

### 客戶端

```ts
// client.ts
import { createSSRApp } from '@chibivue/runtime-dom'
import App from './App.vue'

// 使用 createSSRApp（不是 createApp）
const app = createSSRApp(App)
app.mount('#app')
```

### App 組件

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

在 Hydration 期間，SSR 生成的 HTML 必須與客戶端生成的 VNode 匹配．如果不匹配，就會發生「Hydration 不匹配」．

### 常見原因

1. **日期/亂數**：`new Date()` 或 `Math.random()` 在伺服器和客戶端產生不同的值
2. **瀏覽器特定的 API**：`window` 或 `localStorage` 在伺服器上不存在
3. **條件分支**：伺服器和客戶端走不同的程式碼路徑

### 解決方案

```vue
<script setup>
import { ref, onMounted } from '@chibivue/runtime-core'

// 伺服器和客戶端相同的初始值
const clientOnly = ref(false)

// 僅在客戶端更新
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

當 Hydration 不匹配發生時，Vue 會發出警告，最壞的情況下 DOM 可能會損壞．
注意確保伺服器和客戶端產生相同的輸出．

</KawaikoNote>

## 未來擴展

當前實現是最小化的，但 Vue 本身有以下功能：

1. **Hydration 不匹配偵測**：在開發模式下偵測伺服器/客戶端不一致
2. **部分 Hydration**：只水合必要的部分（效能最佳化）
3. **使用 PatchFlags 最佳化**：跳過靜態節點的 Hydration
4. **非同步組件 Hydration**：與 `Suspense` 整合

<KawaikoNote variant="surprise" title="Hydration 完成！">

現在我們擁有了 SSR 的所有部分．
通過使用 `renderToString` 進行伺服器端渲染和
`createSSRApp` 進行 Hydration，
我們可以實現完整的 SSR 應用程式．

</KawaikoNote>

## 總結

Hydration 實現由以下部分組成：

1. **createHydrationRenderer**：建立用於 Hydration 的渲染器
2. **hydrateNode**：根據 VNode 類型分支處理
3. **hydrateElement**：HTML 元素和事件處理器附加
4. **hydrateChildren**：遞迴處理子元素
5. **hydrateFragment**：處理 Fragment（被註解節點包圍的區域）
6. **createSSRApp**：支援 Hydration 的應用程式工廠

Hydration 的本質是「將 VNode 與已存在的 DOM 關聯而不重新建立」．這使得 SSR 的快速初始顯示和 SPA 的豐富互動性得以兼顧．
