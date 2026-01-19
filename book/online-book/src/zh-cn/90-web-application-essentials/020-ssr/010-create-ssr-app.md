# 服务端渲染 (SSR)

## 什么是 SSR

服务端渲染（SSR）是一种在服务器上将 Vue.js 应用程序渲染为 HTML 字符串并发送到客户端的技术．这提供了以下优势：

1. **改善 SEO**：搜索引擎爬虫可以获取完整的内容
2. **更快的首次显示**：浏览器无需等待 JavaScript 执行即可显示 HTML
3. **性能改善**：在低速设备或网络环境下特别有效

## 包结构

chibivue 的 SSR 实现在 `@chibivue/server-renderer` 包中提供．

```
packages/server-renderer/src/
├── index.ts
├── renderToString.ts      # 主入口
├── render.ts              # VNode 渲染
└── helpers/
    ├── ssrRenderAttrs.ts  # 属性渲染
    └── ssrUtils.ts        # 工具函数
```

## 类型定义

### SSRBuffer

在 SSR 中，我们使用名为 `SSRBuffer` 的数据结构来高效构建渲染结果．

```ts
// packages/server-renderer/src/render.ts
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean };
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
export type PushFn = (item: SSRBufferItem) => void;
```

缓冲区可以包含：
- **字符串**：HTML 的一部分
- **嵌套缓冲区**：子组件的结果
- **Promise**：异步组件的结果

### SSRContext

保存 SSR 期间的上下文信息．

```ts
export type SSRContext = {
  [key: string]: any;
  teleports?: Record<string, string>;
  __teleportBuffers?: Record<string, SSRBuffer>;
  __watcherHandles?: (() => void)[];
};
```

## renderToString 实现

### 主入口

```ts
// packages/server-renderer/src/renderToString.ts
export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // 直接传入 VNode 时，用包装组件包裹
    const vnode = input;
    const buffer = await renderComponentVNode(
      createVNode({ render: () => vnode }),
      null,
    );
    return unrollBuffer(buffer as SSRBuffer) as Promise<string>;
  }

  // App 实例的情况
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

### 缓冲区展开

递归展开嵌套的缓冲区和 Promise．

```ts
function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  // 如果没有异步元素，同步处理
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

    // Promise 的情况下等待解析
    if (isPromise(item)) {
      return item.then((nestedItem) => {
        buffer[i] = nestedItem;
        return nestedUnrollBuffer(buffer, ret, i);
      });
    }

    // 嵌套缓冲区递归处理
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

## createBuffer 实现

用于高效构建缓冲区的工厂函数．

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
        // 连续字符串自动拼接优化
        buffer[buffer.length - 1] += item as string;
        return;
      }
      buffer.push(item);
      appendable = isStringItem;
      // 如果有 Promise 或异步缓冲区，设置标志
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true;
      }
    },
  };
}
```

要点：
1. 连续字符串自动拼接（内存效率）
2. `appendable` 标志跟踪是否可以拼接
3. 如果有异步元素，设置 `hasAsync` 标志

## 组件渲染

### renderComponentVNode

```ts
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  // 创建组件实例
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent,
    null,
  ));

  // 执行 setup
  const res = setupComponent(instance);
  const hasAsyncSetup = isPromise(res);

  // 异步 setup 的情况下返回 Promise
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
    // 函数式组件
    const root = comp(instance.props, {
      slots: instance.slots,
      emit: instance.emit,
      attrs: instance.attrs,
    });
    if (root) {
      renderVNode(push, normalizeVNode(root), instance);
    }
  } else if (instance.render) {
    // 有 render 函数的组件
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

根据各种 VNode 类型进行渲染．

```ts
export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode;

  // 指令的 SSR 支持
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

将 HTML 元素渲染为字符串．

```ts
function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const tag = vnode.type as string;
  const { props, children, shapeFlag } = vnode;
  let openTag = `<${tag}`;

  // 渲染属性
  if (props) {
    openTag += ssrRenderAttrs(props, tag);
  }

  push(openTag + `>`);

  // void 标签没有闭合标签
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false;
    if (props) {
      // 处理特殊属性
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

按顺序渲染子元素．

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

Teleport 组件的 SSR 支持．

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

  // disabled 的情况下内联渲染
  if (disabled) {
    renderVNodeChildren(push, vnode.children as VNodeArrayChildren, parentComponent);
  } else {
    // enabled 的情况下插入占位符注释
    push(`<!--teleport start-->`);
    push(`<!--teleport end-->`);
  }
}
```

## 属性渲染

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

渲染动态属性．

```ts
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }

  // 自定义元素或 SVG 保持原样，否则转换
  const attrKey =
    tag && (tag.indexOf("-") > 0 || isSVGTag(tag))
      ? key
      : propsToAttrMap[key] || key.toLowerCase();

  // 处理布尔属性
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

## 指令的 SSR 支持

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

如果指令实现了 `getSSRProps`，其结果将合并到 props 中．

## 转义处理

防止 XSS 的 HTML 转义．

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

## 使用示例

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

// 服务端渲染
const html = await renderToString(app);
console.log(html); // <div>Hello SSR!</div>
```

## 处理流程

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
          │   ├── children 处理
          │   └── </tag>
          └── Component → renderComponentVNode()（递归）
  ↓
unrollBuffer(buffer)
  ↓
HTML 字符串
```

## 总结

chibivue 的 SSR 实现由以下元素组成：

1. **SSRBuffer**：用于高效字符串构建的缓冲系统（字符串自动拼接，异步支持）
2. **renderComponentVNode**：将组件 VNode 转换为 HTML（异步 setup 支持）
3. **renderVNode**：根据各种 VNode 类型进行渲染分支
4. **renderElementVNode**：HTML 元素的字符串化（void 标签，特殊属性支持）
5. **ssrRenderAttrs**：属性渲染（class/style 标准化，布尔属性，安全检查）
6. **转义处理**：防止 XSS 的 HTML 转义
7. **指令支持**：通过 `getSSRProps` 在 SSR 时进行属性注入

在下一节中，我们将学习 hydration，它在客户端"恢复"SSR 生成的 HTML．

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/010_ssr)
