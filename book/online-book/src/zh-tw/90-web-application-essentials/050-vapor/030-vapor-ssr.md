# Vapor SSR

在本節中，我們將探討如何在伺服器端渲染 Vapor 組件．
由於 Vapor 組件直接操作 DOM，而伺服器上不存在 DOM，因此 Vapor 的 SSR（伺服器端渲染）面臨獨特的挑戰．

## 挑戰

Vapor 組件的工作方式：
1. 使用 `document.createElement` 創建 DOM 元素（通過 `template()`）
2. 使用 `textContent`，`addEventListener` 等直接操作這些元素

在伺服器上，沒有 `document` 對象．我們需要一種不同的方法來從 Vapor 組件生成 HTML 字串．

## 解決方案

Vapor SSR 有兩種主要方法：

1. **Mock DOM**：創建一個捕獲操作並將其轉換為 HTML 的假 DOM 環境
2. **重用 VNode SSR**：在伺服器端使用標準的 VNode 基礎 SSR，在客戶端作為 Vapor 進行水合

Vue.js 的 [PR #13226](https://github.com/vuejs/core/pull/13226) 採用了第二種方法．chibivue 也實現了類似的方法．

<KawaikoNote variant="base" title="Vue.js 的方法">
Vue.js 的 Vapor SSR 在伺服器端使用現有的 VNode 基礎 SSR（compiler-ssr），在客戶端使用 `createVaporSSRApp` 進行水合。這消除了創建單獨 SSR 編譯器的需要。
</KawaikoNote>

## 實現方式

### 伺服器端：使用 VNode SSR

在 Vapor SSR 中，Vapor 組件在伺服器端被編譯為常規的 VNode 基礎組件．這允許直接使用 `@chibivue/compiler-ssr`．

```ts
// compiler-sfc/src/compileTemplate.ts
export function compileTemplate({
  source,
  ssr = false,
  vapor = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  // 即使在 Vapor + SSR 模式下也使用 compiler-ssr
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = defaultCompiler.compile(source, {
    ...compilerOptions,
    ssr,
  });

  // 在 Vapor + SSR 模式下添加 __vapor 標誌
  if (vapor && ssr) {
    code = code.replace(
      /export (function|const) ssrRender/,
      "export const __vapor = true;\nexport $1 ssrRender",
    );
  }

  return { code, ast, source, preamble };
}
```

`__vapor` 標誌表示在水合時應使用 Vapor 模式．

### 客戶端：createVaporSSRApp

在客戶端，使用 `createVaporSSRApp` 來水合 SSR 渲染的 HTML．

```ts
// runtime-vapor/src/apiCreateVaporApp.ts
export function createVaporSSRApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();

  const app: VaporApp = {
    // ... 通用應用配置 ...

    mount(containerOrSelector: Element | string) {
      const container = typeof containerOrSelector === "string"
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;

      if (container?.hasChildNodes()) {
        // 當存在 SSR 內容時進入水合模式
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;
        const instance = hydrateVaporComponent(vnode, container, null);
        app._instance = instance;
      } else {
        // 沒有 SSR 內容時進行正常掛載
        // ...
      }
    },
  };

  return app;
}
```

### 水合

水合過程重用現有的 DOM 元素，同時設置響應性和事件監聽器．

```ts
// runtime-vapor/src/hydration.ts
export function hydrateVaporComponent(
  vnode: VNode,
  container: Element,
  parentInstance: VaporComponentInternalInstance | null = null,
): VaporComponentInternalInstance {
  const instance = createVaporComponentInstance(vnode, parentInstance);

  // 設置水合上下文
  const ctx: VaporHydrationContext = {
    node: container.firstChild,
    parent: container,
  };

  setCurrentInstance(instance as any);
  (instance as any).__hydrationCtx = ctx;

  try {
    const comp = instance.type as VaporComponent;
    // 執行組件 - template() 找到現有的 DOM
    const el = comp(instance);

    // 標記為已掛載
    instance.isMounted = true;

    // 調用 mounted 鉤子
    const { m } = instance as any;
    if (m) invokeArrayFns(m);

    return instance;
  } finally {
    unsetCurrentInstance();
    delete (instance as any).__hydrationCtx;
  }
}
```

## Mock DOM 方法

chibivue 也在 `server-renderer` 中實現了 Mock DOM 方法．當不使用 VNode SSR 時，這可以作為後備方案．

### SSR 元素

我們創建模仿 DOM 元素但將數據存儲在內存中的類：

```ts
class SSRElement {
  tagName: string;
  attributes: Map<string, string> = new Map();
  children: (SSRElement | SSRText)[] = [];
  textContent: string = "";

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(): void {
    // SSR 中不做任何操作 - 事件僅在客戶端
  }

  appendChild(child: SSRElement | SSRText): void {
    this.children.push(child);
  }

  toHTML(): string {
    let html = `<${this.tagName}`;
    for (const [name, value] of this.attributes) {
      html += ` ${name}="${escapeHtml(value)}"`;
    }
    html += ">";

    if (this.textContent) {
      html += escapeHtml(this.textContent);
    } else {
      for (const child of this.children) {
        html += child.toHTML();
      }
    }

    html += `</${this.tagName}>`;
    return html;
  }
}
```

## 使用示例

### 伺服器端

```ts
import { createVNode } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import App from "./App.vue";

// 將組件渲染為 HTML 字串
const html = await renderToString(createVNode(App));

// 發送 HTML 響應
res.send(`
<!DOCTYPE html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/entry-client.ts"></script>
  </body>
</html>
`);
```

### 客戶端

```ts
// entry-client.ts
import { createVaporSSRApp } from "@chibivue/runtime-vapor";
import App from "./App.vue";

// 水合 SSR 渲染的 HTML
createVaporSSRApp(App).mount("#app");
```

## 與虛擬 DOM SSR 的比較

| 方面 | 虛擬 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| 伺服器渲染 | 遍歷 VNode 樹，生成 HTML | 相同（使用 VNode SSR） |
| 客戶端水合 | 使用 VNode diff | 直接引用/操作 DOM |
| 包大小 | 需要虛擬 DOM 運行時 | 輕量級 Vapor 運行時 |
| 更新性能 | 經過 diff 算法 | 直接 DOM 操作 |

## 架構優勢

Vue.js 風格的 Vapor SSR 方法具有以下優勢：

1. **代碼重用**：可以直接使用現有的 `compiler-ssr`
2. **一致的輸出**：伺服器生成的 HTML 與常規 VNode SSR 相同
3. **漸進式遷移**：可以與非 Vapor 組件共存
4. **可維護性**：無需維護單獨的 SSR 編譯器

<KawaikoNote variant="warning" title="需要水合">
伺服器渲染的 HTML 是靜態的。為了獲得交互性，你需要在客戶端水合 Vapor 組件，這將設置響應式 effect 和事件監聽器。
</KawaikoNote>

## 限制

當前實現是最小的，有一些限制：

1. **不支持流式傳輸**：整個組件在返回之前被渲染
2. **不支持 Suspense**：異步組件的 SSR 支持有限
3. **水合不匹配**：客戶端和伺服器輸出不同時的警告功能未實現

<KawaikoNote variant="base" title="未來改進">
更完整的實現將包括：
- 流式 SSR 支持
- 水合不匹配檢測
- Suspense 集成
</KawaikoNote>

## 總結

Vapor SSR 的工作方式如下：

1. **伺服器端**：使用 `compiler-ssr` 生成 HTML 字串（與 VNode SSR 相同）
2. **客戶端**：使用 `createVaporSSRApp` 進行水合
3. **水合**：重用現有的 DOM 元素，同時設置響應性

這種方法允許 Vapor 組件享受 SSR 的好處，同時在客戶端獲得直接 DOM 操作的性能優勢．
