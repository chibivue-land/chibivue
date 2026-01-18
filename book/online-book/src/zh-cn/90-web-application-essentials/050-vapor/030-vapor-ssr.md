# Vapor SSR

在本节中，我们将探讨如何在服务器端渲染 Vapor 组件．
由于 Vapor 组件直接操作 DOM，而服务器上不存在 DOM，因此 Vapor 的 SSR（服务器端渲染）面临独特的挑战．

## 挑战

Vapor 组件的工作方式：
1. 使用 `document.createElement` 创建 DOM 元素（通过 `template()`）
2. 使用 `textContent`，`addEventListener` 等直接操作这些元素

在服务器上，没有 `document` 对象．我们需要一种不同的方法来从 Vapor 组件生成 HTML 字符串．

## 解决方案

Vapor SSR 有两种主要方法：

1. **Mock DOM**：创建一个捕获操作并将其转换为 HTML 的假 DOM 环境
2. **重用 VNode SSR**：在服务器端使用标准的 VNode 基础 SSR，在客户端作为 Vapor 进行水合

Vue.js 的 [PR #13226](https://github.com/vuejs/core/pull/13226) 采用了第二种方法．chibivue 也实现了类似的方法．

<KawaikoNote variant="base" title="Vue.js 的方法">
Vue.js 的 Vapor SSR 在服务器端使用现有的 VNode 基础 SSR（compiler-ssr），在客户端使用 `createVaporSSRApp` 进行水合。这消除了创建单独 SSR 编译器的需要。
</KawaikoNote>

## 实现方式

### 服务器端：使用 VNode SSR

在 Vapor SSR 中，Vapor 组件在服务器端被编译为常规的 VNode 基础组件．这允许直接使用 `@chibivue/compiler-ssr`．

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

  // 在 Vapor + SSR 模式下添加 __vapor 标志
  if (vapor && ssr) {
    code = code.replace(
      /export (function|const) ssrRender/,
      "export const __vapor = true;\nexport $1 ssrRender",
    );
  }

  return { code, ast, source, preamble };
}
```

`__vapor` 标志表示在水合时应使用 Vapor 模式．

### 客户端：createVaporSSRApp

在客户端，使用 `createVaporSSRApp` 来水合 SSR 渲染的 HTML．

```ts
// runtime-vapor/src/apiCreateVaporApp.ts
export function createVaporSSRApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();

  const app: VaporApp = {
    // ... 通用应用配置 ...

    mount(containerOrSelector: Element | string) {
      const container = typeof containerOrSelector === "string"
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;

      if (container?.hasChildNodes()) {
        // 当存在 SSR 内容时进入水合模式
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;
        const instance = hydrateVaporComponent(vnode, container, null);
        app._instance = instance;
      } else {
        // 没有 SSR 内容时进行正常挂载
        // ...
      }
    },
  };

  return app;
}
```

### 水合

水合过程重用现有的 DOM 元素，同时设置响应性和事件监听器．

```ts
// runtime-vapor/src/hydration.ts
export function hydrateVaporComponent(
  vnode: VNode,
  container: Element,
  parentInstance: VaporComponentInternalInstance | null = null,
): VaporComponentInternalInstance {
  const instance = createVaporComponentInstance(vnode, parentInstance);

  // 设置水合上下文
  const ctx: VaporHydrationContext = {
    node: container.firstChild,
    parent: container,
  };

  setCurrentInstance(instance as any);
  (instance as any).__hydrationCtx = ctx;

  try {
    const comp = instance.type as VaporComponent;
    // 执行组件 - template() 找到现有的 DOM
    const el = comp(instance);

    // 标记为已挂载
    instance.isMounted = true;

    // 调用 mounted 钩子
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

chibivue 也在 `server-renderer` 中实现了 Mock DOM 方法．当不使用 VNode SSR 时，这可以作为后备方案．

### SSR 元素

我们创建模仿 DOM 元素但将数据存储在内存中的类：

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
    // SSR 中不做任何操作 - 事件仅在客户端
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

### 服务器端

```ts
import { createVNode } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import App from "./App.vue";

// 将组件渲染为 HTML 字符串
const html = await renderToString(createVNode(App));

// 发送 HTML 响应
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

### 客户端

```ts
// entry-client.ts
import { createVaporSSRApp } from "@chibivue/runtime-vapor";
import App from "./App.vue";

// 水合 SSR 渲染的 HTML
createVaporSSRApp(App).mount("#app");
```

## 与虚拟 DOM SSR 的比较

| 方面 | 虚拟 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| 服务器渲染 | 遍历 VNode 树，生成 HTML | 相同（使用 VNode SSR） |
| 客户端水合 | 使用 VNode diff | 直接引用/操作 DOM |
| 包大小 | 需要虚拟 DOM 运行时 | 轻量级 Vapor 运行时 |
| 更新性能 | 经过 diff 算法 | 直接 DOM 操作 |

## 架构优势

Vue.js 风格的 Vapor SSR 方法具有以下优势：

1. **代码重用**：可以直接使用现有的 `compiler-ssr`
2. **一致的输出**：服务器生成的 HTML 与常规 VNode SSR 相同
3. **渐进式迁移**：可以与非 Vapor 组件共存
4. **可维护性**：无需维护单独的 SSR 编译器

<KawaikoNote variant="warning" title="需要水合">
服务器渲染的 HTML 是静态的。为了获得交互性，你需要在客户端水合 Vapor 组件，这将设置响应式 effect 和事件监听器。
</KawaikoNote>

## 限制

当前实现是最小的，有一些限制：

1. **不支持流式传输**：整个组件在返回之前被渲染
2. **不支持 Suspense**：异步组件的 SSR 支持有限
3. **水合不匹配**：客户端和服务器输出不同时的警告功能未实现

<KawaikoNote variant="base" title="未来改进">
更完整的实现将包括：
- 流式 SSR 支持
- 水合不匹配检测
- Suspense 集成
</KawaikoNote>

## 总结

Vapor SSR 的工作方式如下：

1. **服务器端**：使用 `compiler-ssr` 生成 HTML 字符串（与 VNode SSR 相同）
2. **客户端**：使用 `createVaporSSRApp` 进行水合
3. **水合**：重用现有的 DOM 元素，同时设置响应性

这种方法允许 Vapor 组件享受 SSR 的好处，同时在客户端获得直接 DOM 操作的性能优势．
