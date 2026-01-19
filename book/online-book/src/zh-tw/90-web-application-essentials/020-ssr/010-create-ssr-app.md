# 伺服器端渲染 (SSR)

## 什麼是 SSR

伺服器端渲染（SSR）是一種在伺服器上將 Vue.js 應用程式渲染為 HTML 字串並發送到客戶端的技術．這提供了以下優勢：

1. **改善 SEO**：搜尋引擎爬蟲可以獲取完整的內容
2. **更快的首次顯示**：瀏覽器無需等待 JavaScript 執行即可顯示 HTML
3. **效能改善**：在低速裝置或網路環境下特別有效

## 套件結構

chibivue 的 SSR 實作在 `@chibivue/server-renderer` 套件中提供．

```
packages/server-renderer/src/
├── index.ts
├── renderToString.ts      # 主入口
├── render.ts              # VNode 渲染
└── helpers/
    ├── ssrRenderAttrs.ts  # 屬性渲染
    └── ssrUtils.ts        # 工具函式
```

## 型別定義

### SSRBuffer

在 SSR 中，我們使用名為 `SSRBuffer` 的資料結構來高效構建渲染結果．

```ts
// packages/server-renderer/src/render.ts
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean };
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
export type PushFn = (item: SSRBufferItem) => void;
```

緩衝區可以包含：
- **字串**：HTML 的一部分
- **巢狀緩衝區**：子元件的結果
- **Promise**：非同步元件的結果

### SSRContext

保存 SSR 期間的上下文資訊．

```ts
export type SSRContext = {
  [key: string]: any;
  teleports?: Record<string, string>;
  __teleportBuffers?: Record<string, SSRBuffer>;
  __watcherHandles?: (() => void)[];
};
```

## renderToString 實作

### 主入口

```ts
// packages/server-renderer/src/renderToString.ts
export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // 直接傳入 VNode 時，用包裝元件包裹
    const vnode = input;
    const buffer = await renderComponentVNode(
      createVNode({ render: () => vnode }),
      null,
    );
    return unrollBuffer(buffer as SSRBuffer) as Promise<string>;
  }

  // App 實例的情況
  const app = input;
  const vnode = createVNode(app._component, app._props);
  vnode.appContext = app._context;

  const buffer = await renderComponentVNode(vnode);
  const result = await unrollBuffer(buffer as SSRBuffer);

  // 清理 watcher
  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch();
    }
  }

  return result;
}
```

### 緩衝區展開

遞迴展開巢狀的緩衝區和 Promise．

```ts
function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  // 如果沒有非同步元素，同步處理
  if (!buffer.hasAsync) {
    return parentRet + unrollBufferSync(buffer);
  }

  let ret = parentRet;
  for (let i = startIndex; i < buffer.length; i += 1) {
    const item = buffer[i];
    if (isString(item)) {
      ret += item;
      continue;
    }

    // Promise 的情況下等待解析
    if (isPromise(item)) {
      return item.then((nestedItem) => {
        buffer[i] = nestedItem;
        return nestedUnrollBuffer(buffer, ret, i);
      });
    }

    // 巢狀緩衝區遞迴處理
    const result = nestedUnrollBuffer(item, ret, 0);
    if (isPromise(result)) {
      return result.then((nestedItem) => {
        buffer[i] = nestedItem as any;
        return nestedUnrollBuffer(buffer, "", i);
      });
    }

    ret = result;
  }

  return ret;
}

export function unrollBuffer(buffer: SSRBuffer): Promise<string> | string {
  return nestedUnrollBuffer(buffer, "", 0);
}

function unrollBufferSync(buffer: SSRBuffer): string {
  let ret = "";
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i];
    if (isString(item)) {
      ret += item;
    } else {
      ret += unrollBufferSync(item as SSRBuffer);
    }
  }
  return ret;
}
```

## createBuffer 實作

用於高效構建緩衝區的工廠函式．

```ts
// packages/server-renderer/src/render.ts
export function createBuffer(): { getBuffer: () => SSRBuffer; push: PushFn } {
  let appendable = false;
  const buffer: SSRBuffer = [];
  return {
    getBuffer(): SSRBuffer {
      return buffer;
    },
    push(item: SSRBufferItem): void {
      const isStringItem = isString(item);
      if (appendable && isStringItem) {
        // 連續字串自動拼接優化
        buffer[buffer.length - 1] += item as string;
        return;
      }
      buffer.push(item);
      appendable = isStringItem;
      // 如果有 Promise 或非同步緩衝區，設定標誌
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true;
      }
    },
  };
}
```

要點：
1. 連續字串自動拼接（記憶體效率）
2. `appendable` 標誌追蹤是否可以拼接
3. 如果有非同步元素，設定 `hasAsync` 標誌

## 元件渲染

### renderComponentVNode

```ts
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  // 建立元件實例
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent,
    null,
  ));

  // 執行 setup
  const res = setupComponent(instance);
  const hasAsyncSetup = isPromise(res);

  // 非同步 setup 的情況下回傳 Promise
  if (hasAsyncSetup) {
    return (res as Promise<void>).then(() =>
      renderComponentSubTree(instance),
    );
  } else {
    return renderComponentSubTree(instance);
  }
}
```

### renderComponentSubTree

```ts
function renderComponentSubTree(
  instance: ComponentInternalInstance,
): SSRBuffer | Promise<SSRBuffer> {
  const comp = instance.type as Component;
  const { getBuffer, push } = createBuffer();

  if (isFunction(comp)) {
    // 函式式元件
    const root = comp(instance.props, {
      slots: instance.slots,
      emit: instance.emit,
      attrs: instance.attrs,
    });
    if (root) {
      renderVNode(push, normalizeVNode(root), instance);
    }
  } else if (instance.render) {
    // 有 render 函式的元件
    const prev = setCurrentInstance(instance);
    try {
      const root = instance.render(instance.proxy!);
      if (root) {
        instance.subTree = normalizeVNode(root);
        renderVNode(push, instance.subTree, instance);
      }
    } finally {
      unsetCurrentInstance(prev);
    }
  } else {
    console.warn(`Component is missing render function.`);
    push(`<!---->`);
  }

  return getBuffer();
}
```

## VNode 渲染

### renderVNode

根據各種 VNode 型別進行渲染．

```ts
export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode;

  // 指令的 SSR 支援
  if (dirs) {
    vnode.props = applySSRDirectives(vnode, props, dirs);
  }

  switch (type) {
    case Text:
      push(escapeHtml(children as string));
      break;
    case Comment:
      push(
        children
          ? `<!--${escapeHtmlComment(children as string)}-->`
          : `<!---->`,
      );
      break;
    case Fragment:
      push(`<!--[-->`);
      renderVNodeChildren(push, children as VNodeArrayChildren, parentComponent);
      push(`<!--]-->`);
      break;
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        renderElementVNode(push, vnode, parentComponent);
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        push(renderComponentVNode(vnode, parentComponent));
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        renderTeleportVNode(push, vnode, parentComponent);
      }
  }
}
```

### renderElementVNode

將 HTML 元素渲染為字串．

```ts
function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const tag = vnode.type as string;
  const { props, children, shapeFlag } = vnode;
  let openTag = `<${tag}`;

  // 渲染屬性
  if (props) {
    openTag += ssrRenderAttrs(props, tag);
  }

  push(openTag + `>`);

  // void 標籤沒有閉合標籤
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false;
    if (props) {
      // 處理特殊屬性
      if (props.innerHTML) {
        hasChildrenOverride = true;
        push(props.innerHTML as string);
      } else if (props.textContent) {
        hasChildrenOverride = true;
        push(escapeHtml(props.textContent as string));
      } else if (tag === "textarea" && props.value) {
        hasChildrenOverride = true;
        push(escapeHtml(props.value as string));
      }
    }
    if (!hasChildrenOverride) {
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        push(escapeHtml(children as string));
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        renderVNodeChildren(push, children as VNodeArrayChildren, parentComponent);
      }
    }
    push(`</${tag}>`);
  }
}
```

### renderVNodeChildren

按順序渲染子元素．

```ts
export function renderVNodeChildren(
  push: PushFn,
  children: VNodeArrayChildren,
  parentComponent: ComponentInternalInstance,
): void {
  for (let i = 0; i < children.length; i++) {
    renderVNode(push, normalizeVNode(children[i]), parentComponent);
  }
}
```

### renderTeleportVNode

Teleport 元件的 SSR 支援．

```ts
function renderTeleportVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const target = vnode.props && vnode.props.to;
  const disabled = vnode.props && vnode.props.disabled;

  if (!target) {
    if (!disabled) {
      console.warn(`Teleport is missing target prop.`);
    }
    return;
  }

  if (!isString(target)) {
    console.warn(`Teleport target must be a query selector string.`);
    return;
  }

  // disabled 的情況下內聯渲染
  if (disabled) {
    renderVNodeChildren(push, vnode.children as VNodeArrayChildren, parentComponent);
  } else {
    // enabled 的情況下插入佔位符註解
    push(`<!--teleport start-->`);
    push(`<!--teleport end-->`);
  }
}
```

## 屬性渲染

### ssrRenderAttrs

```ts
// packages/server-renderer/src/helpers/ssrRenderAttrs.ts
export function ssrRenderAttrs(
  props: Record<string, unknown>,
  tag?: string,
): string {
  let ret = "";
  for (const key in props) {
    if (
      ssrIsIgnoredKey(key) ||
      isOn(key) ||
      (tag === "textarea" && key === "value")
    ) {
      continue;
    }
    const value = props[key];
    if (key === "class") {
      ret += ` class="${ssrRenderClass(value)}"`;
    } else if (key === "style") {
      ret += ` style="${ssrRenderStyle(value)}"`;
    } else {
      ret += ssrRenderDynamicAttr(key, value, tag);
    }
  }
  return ret;
}

function ssrIsIgnoredKey(key: string): boolean {
  return (
    key === "key" ||
    key === "ref" ||
    key === "innerHTML" ||
    key === "textContent"
  );
}
```

### ssrRenderDynamicAttr

渲染動態屬性．

```ts
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }

  // 自訂元素或 SVG 保持原樣，否則轉換
  const attrKey =
    tag && (tag.indexOf("-") > 0 || isSVGTag(tag))
      ? key
      : propsToAttrMap[key] || key.toLowerCase();

  // 處理布林屬性
  if (isBooleanAttr(attrKey)) {
    return value === false ? "" : ` ${attrKey}`;
  } else if (isSSRSafeAttrName(attrKey)) {
    return value === ""
      ? ` ${attrKey}`
      : ` ${attrKey}="${escapeHtml(value)}"`;
  } else {
    console.warn(
      `[@chibivue/server-renderer] Skipped rendering unsafe attribute name: ${attrKey}`,
    );
    return "";
  }
}
```

### 渲染 class 和 style

```ts
export function ssrRenderClass(raw: unknown): string {
  return escapeHtml(normalizeClass(raw));
}

export function ssrRenderStyle(raw: unknown): string {
  if (!raw) {
    return "";
  }
  if (isString(raw)) {
    return escapeHtml(raw);
  }
  const styles = normalizeStyle(raw);
  return escapeHtml(stringifyStyle(styles));
}

function stringifyStyle(
  styles: Record<string, string | number> | null,
): string {
  let ret = "";
  if (!styles || isString(styles)) {
    return ret;
  }
  for (const key in styles) {
    const value = styles[key];
    const normalizedKey = key.startsWith("--") ? key : hyphenate(key);
    if (isString(value) || typeof value === "number") {
      ret += `${normalizedKey}:${value};`;
    }
  }
  return ret;
}
```

## 指令的 SSR 支援

```ts
function applySSRDirectives(
  vnode: VNode,
  rawProps: VNodeProps | null,
  dirs: DirectiveBinding[],
): VNodeProps {
  const toMerge: VNodeProps[] = [];
  for (let i = 0; i < dirs.length; i++) {
    const binding = dirs[i];
    const { dir: { getSSRProps } } = binding as any;
    if (getSSRProps) {
      const props = getSSRProps(binding, vnode);
      if (props) toMerge.push(props);
    }
  }
  return mergeProps(rawProps || {}, ...toMerge);
}
```

如果指令實作了 `getSSRProps`，其結果將合併到 props 中．

## 跳脫處理

防止 XSS 的 HTML 跳脫．

```ts
// packages/server-renderer/src/helpers/ssrUtils.ts
const escapeRE = /["'&<>]/;

export function escapeHtml(string: unknown): string {
  const str = "" + string;
  const match = escapeRE.exec(str);

  if (!match) {
    return str;
  }

  let html = "";
  let escaped: string;
  let index: number;
  let lastIndex = 0;
  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escaped = "&quot;";
        break;
      case 38: // &
        escaped = "&amp;";
        break;
      case 39: // '
        escaped = "&#39;";
        break;
      case 60: // <
        escaped = "&lt;";
        break;
      case 62: // >
        escaped = "&gt;";
        break;
      default:
        continue;
    }
    if (lastIndex !== index) {
      html += str.slice(lastIndex, index);
    }
    lastIndex = index + 1;
    html += escaped;
  }
  return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
}
```

## 使用範例

```ts
import { createApp } from "@chibivue/runtime-dom";
import { renderToString } from "@chibivue/server-renderer";

const App = {
  setup() {
    return { message: "Hello SSR!" };
  },
  template: `<div>{{ message }}</div>`,
};

const app = createApp(App);

// 伺服器端渲染
const html = await renderToString(app);
console.log(html); // <div>Hello SSR!</div>
```

## 處理流程

```
renderToString(app)
  ↓
createVNode(app._component, app._props)
  ↓
renderComponentVNode(vnode)
  ├── createComponentInstance()
  ├── setupComponent()
  └── renderComponentSubTree()
      ├── createBuffer()
      ├── instance.render() 或 comp()
      └── renderVNode(push, root, instance)
          ├── Text → escapeHtml(children)
          ├── Comment → <!--...-->
          ├── Fragment → <!--[--> ... <!--]-->
          ├── Element → renderElementVNode()
          │   ├── <tag + ssrRenderAttrs(props) + >
          │   ├── children 處理
          │   └── </tag>
          └── Component → renderComponentVNode()（遞迴）
  ↓
unrollBuffer(buffer)
  ↓
HTML 字串
```

## 總結

chibivue 的 SSR 實作由以下元素組成：

1. **SSRBuffer**：用於高效字串構建的緩衝系統（字串自動拼接，非同步支援）
2. **renderComponentVNode**：將元件 VNode 轉換為 HTML（非同步 setup 支援）
3. **renderVNode**：根據各種 VNode 型別進行渲染分支
4. **renderElementVNode**：HTML 元素的字串化（void 標籤，特殊屬性支援）
5. **ssrRenderAttrs**：屬性渲染（class/style 標準化，布林屬性，安全檢查）
6. **跳脫處理**：防止 XSS 的 HTML 跳脫
7. **指令支援**：透過 `getSSRProps` 在 SSR 時進行屬性注入

在下一節中，我們將學習 hydration，它在客戶端「恢復」SSR 生成的 HTML．

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/010_ssr)
