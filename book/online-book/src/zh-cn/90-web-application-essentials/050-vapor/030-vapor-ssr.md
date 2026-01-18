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
2. **单独的 SSR 编译器**：生成直接输出 HTML 字符串的不同代码

chibivue 在 `server-renderer` 中实现了 Mock DOM 方法的简化版本．

## 实现

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

  get firstChild(): SSRElement | SSRText | null {
    return this.children[0] || null;
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

关键点是 `toHTML()` 将内存中的表示转换回 HTML 字符串．

### SSR Document

我们还创建一个模拟的 `document` 对象：

```ts
class SSRDocument {
  createElement(tagName: string): SSRElement {
    return new SSRElement(tagName);
  }

  createTextNode(text: string): SSRText {
    return new SSRText(text);
  }

  createComment(text: string): SSRText {
    return new SSRText(`<!--${text}-->`);
  }
}
```

### 渲染 Vapor 组件

`renderVaporComponentToString` 函数设置 SSR 环境并执行组件：

```ts
export function renderVaporComponentToString(
  vnode: VNode,
  parentInstance: VaporComponentInternalInstance | null = null
): SSRBuffer | Promise<SSRBuffer> {
  const instance = createVaporComponentInstance(vnode, parentInstance);
  return renderVaporComponentSubTree(instance);
}

function renderVaporComponentSubTree(
  instance: VaporComponentInternalInstance
): SSRBuffer {
  const { getBuffer, push } = createBuffer();
  const comp = instance.type as VaporComponent;

  if (isFunction(comp)) {
    try {
      // 设置 SSR 环境
      setupSSRVaporGlobals();

      // 执行 vapor 组件
      comp(instance);

      // 获取渲染的 HTML
      push(ssrContext.getHTML());

      // 恢复全局变量
      restoreVaporGlobals();
    } catch (e) {
      console.warn(`Vapor SSR render failed:`, e);
      push(`<!---->`);
    }
  }

  return getBuffer();
}
```

## SSR 中的事件处理

注意 `addEventListener` 在 SSR 中是空操作：

```ts
addEventListener(): void {
  // SSR 中不做任何操作 - 事件仅在客户端
}
```

事件处理器仅在客户端工作．当页面在浏览器中加载时，水合（hydration）将附加实际的事件监听器．

<KawaikoNote type="warning" title="需要水合">
服务器渲染的 HTML 是静态的．为了获得交互性，你需要在客户端水合 Vapor 组件，这将设置响应式 effect 和事件监听器．
</KawaikoNote>

## SSR 辅助函数

我们还提供用于生成 SSR 输出的辅助函数：

```ts
// 使用占位符支持渲染文本
export function ssrVaporSetText(format: string, ...values: any[]): string {
  let text = format;
  for (let i = 0; i < values.length; i++) {
    text = text.replace("{}", String(values[i]));
  }
  return escapeHtml(text);
}

// 直接传递模板 HTML
export function ssrVaporTemplate(html: string): string {
  return html;
}
```

## 使用示例

以下是如何在服务器上渲染 Vapor 组件：

```ts
import { createVNode } from "chibivue";
import { renderVaporComponentToString } from "@chibivue/server-renderer";

// 一个简单的 vapor 组件
const Counter = (self) => {
  const el = template("<button>Count: 0</button>");
  return el;
};

// 渲染为字符串
const vnode = createVNode(Counter);
const buffer = await renderVaporComponentToString(vnode);
const html = unrollBuffer(buffer);

console.log(html);
// 输出: <button>Count: 0</button>
```

## 与虚拟 DOM SSR 的比较

| 方面 | 虚拟 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| 渲染 | 遍历 VNode 树，生成 HTML | 模拟 DOM，捕获操作 |
| 复杂性 | 简单的递归渲染 | 需要 DOM 模拟层 |
| 输出 | 相同的 HTML 结构 | 相同的 HTML 结构 |
| 水合 | 标准水合 | 需要 Vapor 特定的水合 |

两种方法产生相同的 HTML 输出，但实现不同．虚拟 DOM 方法在概念上更简单，因为它已经使用数据结构（VNodes）而不是实际的 DOM 元素．

## 限制

当前实现是最小的，有一些限制：

1. **不支持流式传输**：整个组件在返回之前被渲染
2. **有限的 DOM API 覆盖**：只模拟了基本的 DOM 操作
3. **不支持异步组件**：异步 vapor 组件可能无法正常工作

<KawaikoNote type="info" title="未来改进">
更完整的实现将包括：
- 完整的 DOM API 模拟
- 对大型页面的流式传输支持
- 与 Vapor 编译器更好地集成以获得优化的 SSR 输出
</KawaikoNote>

## 总结

Vapor SSR 的工作方式：

1. 创建将元素数据存储在内存中的模拟 DOM 类
2. 在渲染期间用我们的模拟替换全局 `document`
3. 执行 Vapor 组件，构建模拟 DOM 树
4. 将模拟 DOM 树转换回 HTML 字符串

这种方法允许 Vapor 组件无需修改即可在服务器上工作，但需要在客户端进行水合步骤以恢复交互性．

Vapor 编译器和 Vapor SSR 的组合让你获得直接 DOM 操作的性能优势，同时保持服务器渲染 Vue 应用程序的能力．
