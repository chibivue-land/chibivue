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
2. **單獨的 SSR 編譯器**：生成直接輸出 HTML 字串的不同代碼

chibivue 在 `server-renderer` 中實現了 Mock DOM 方法的簡化版本．

## 實現

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

  get firstChild(): SSRElement | SSRText | null {
    return this.children[0] || null;
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

關鍵點是 `toHTML()` 將內存中的表示轉換回 HTML 字串．

### SSR Document

我們還創建一個模擬的 `document` 對象：

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

### 渲染 Vapor 組件

`renderVaporComponentToString` 函數設置 SSR 環境並執行組件：

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
      // 設置 SSR 環境
      setupSSRVaporGlobals();

      // 執行 vapor 組件
      comp(instance);

      // 獲取渲染的 HTML
      push(ssrContext.getHTML());

      // 恢復全局變量
      restoreVaporGlobals();
    } catch (e) {
      console.warn(`Vapor SSR render failed:`, e);
      push(`<!---->`);
    }
  }

  return getBuffer();
}
```

## SSR 中的事件處理

注意 `addEventListener` 在 SSR 中是空操作：

```ts
addEventListener(): void {
  // SSR 中不做任何操作 - 事件僅在客戶端
}
```

事件處理器僅在客戶端工作．當頁面在瀏覽器中載入時，水合（hydration）將附加實際的事件監聽器．

<KawaikoNote type="warning" title="需要水合">
伺服器渲染的 HTML 是靜態的．為了獲得交互性，你需要在客戶端水合 Vapor 組件，這將設置響應式 effect 和事件監聽器．
</KawaikoNote>

## SSR 輔助函數

我們還提供用於生成 SSR 輸出的輔助函數：

```ts
// 使用佔位符支持渲染文本
export function ssrVaporSetText(format: string, ...values: any[]): string {
  let text = format;
  for (let i = 0; i < values.length; i++) {
    text = text.replace("{}", String(values[i]));
  }
  return escapeHtml(text);
}

// 直接傳遞模板 HTML
export function ssrVaporTemplate(html: string): string {
  return html;
}
```

## 使用示例

以下是如何在伺服器上渲染 Vapor 組件：

```ts
import { createVNode } from "chibivue";
import { renderVaporComponentToString } from "@chibivue/server-renderer";

// 一個簡單的 vapor 組件
const Counter = (self) => {
  const el = template("<button>Count: 0</button>");
  return el;
};

// 渲染為字串
const vnode = createVNode(Counter);
const buffer = await renderVaporComponentToString(vnode);
const html = unrollBuffer(buffer);

console.log(html);
// 輸出: <button>Count: 0</button>
```

## 與虛擬 DOM SSR 的比較

| 方面 | 虛擬 DOM SSR | Vapor SSR |
|--------|-----------------|-----------|
| 渲染 | 遍歷 VNode 樹，生成 HTML | 模擬 DOM，捕獲操作 |
| 複雜性 | 簡單的遞歸渲染 | 需要 DOM 模擬層 |
| 輸出 | 相同的 HTML 結構 | 相同的 HTML 結構 |
| 水合 | 標準水合 | 需要 Vapor 特定的水合 |

兩種方法產生相同的 HTML 輸出，但實現不同．虛擬 DOM 方法在概念上更簡單，因為它已經使用數據結構（VNodes）而不是實際的 DOM 元素．

## 限制

當前實現是最小的，有一些限制：

1. **不支持流式傳輸**：整個組件在返回之前被渲染
2. **有限的 DOM API 覆蓋**：只模擬了基本的 DOM 操作
3. **不支持異步組件**：異步 vapor 組件可能無法正常工作

<KawaikoNote type="info" title="未來改進">
更完整的實現將包括：
- 完整的 DOM API 模擬
- 對大型頁面的流式傳輸支持
- 與 Vapor 編譯器更好地集成以獲得優化的 SSR 輸出
</KawaikoNote>

## 總結

Vapor SSR 的工作方式：

1. 創建將元素數據存儲在內存中的模擬 DOM 類
2. 在渲染期間用我們的模擬替換全局 `document`
3. 執行 Vapor 組件，構建模擬 DOM 樹
4. 將模擬 DOM 樹轉換回 HTML 字串

這種方法允許 Vapor 組件無需修改即可在伺服器上工作，但需要在客戶端進行水合步驟以恢復交互性．

Vapor 編譯器和 Vapor SSR 的組合讓你獲得直接 DOM 操作的性能優勢，同時保持伺服器渲染 Vue 應用程序的能力．
