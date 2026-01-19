# Server Side Rendering (SSR)

## What is SSR

Server Side Rendering (SSR) is a technique that renders Vue.js applications to HTML strings on the server and sends them to the client. This provides the following benefits:

1. **Improved SEO**: Search engine crawlers can obtain complete content
2. **Faster initial display**: Browsers can display HTML without waiting for JavaScript execution
3. **Better performance**: Especially effective on slow devices or network environments

## Package Structure

The SSR implementation of chibivue is provided in the `@chibivue/server-renderer` package.

```
packages/server-renderer/src/
├── index.ts
├── renderToString.ts      # Main entry point
├── render.ts              # VNode rendering
└── helpers/
    ├── ssrRenderAttrs.ts  # Attribute rendering
    └── ssrUtils.ts        # Utility functions
```

## Type Definitions

### SSRBuffer

In SSR, we use a data structure called `SSRBuffer` to efficiently build rendering results.

```ts
// packages/server-renderer/src/render.ts
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean };
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
export type PushFn = (item: SSRBufferItem) => void;
```

The buffer can contain:
- **Strings**: Parts of HTML
- **Nested buffers**: Results from child components
- **Promises**: Results from async components

### SSRContext

Holds context information during SSR.

```ts
export type SSRContext = {
  [key: string]: any;
  teleports?: Record<string, string>;
  __teleportBuffers?: Record<string, SSRBuffer>;
  __watcherHandles?: (() => void)[];
};
```

## renderToString Implementation

### Main Entry Point

```ts
// packages/server-renderer/src/renderToString.ts
export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // When VNode is passed directly, wrap it in a wrapper component
    const vnode = input;
    const buffer = await renderComponentVNode(
      createVNode({ render: () => vnode }),
      null,
    );
    return unrollBuffer(buffer as SSRBuffer) as Promise<string>;
  }

  // For App instance
  const app = input;
  const vnode = createVNode(app._component, app._props);
  vnode.appContext = app._context;

  const buffer = await renderComponentVNode(vnode);
  const result = await unrollBuffer(buffer as SSRBuffer);

  // Cleanup watchers
  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch();
    }
  }

  return result;
}
```

### Buffer Unrolling

Recursively unrolls nested buffers and Promises.

```ts
function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  // Process synchronously if there are no async elements
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

    // Wait for Promise resolution
    if (isPromise(item)) {
      return item.then((nestedItem) => {
        buffer[i] = nestedItem;
        return nestedUnrollBuffer(buffer, ret, i);
      });
    }

    // Recursively process nested buffers
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

## createBuffer Implementation

A factory function for efficiently building buffers.

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
        // Optimize by concatenating consecutive strings
        buffer[buffer.length - 1] += item as string;
        return;
      }
      buffer.push(item);
      appendable = isStringItem;
      // Set flag if there are Promises or async buffers
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true;
      }
    },
  };
}
```

Key points:
1. Consecutive strings are automatically concatenated (memory efficiency)
2. `appendable` flag tracks whether concatenation is possible
3. `hasAsync` flag is set if there are async elements

## Component Rendering

### renderComponentVNode

```ts
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  // Create component instance
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent,
    null,
  ));

  // Execute setup
  const res = setupComponent(instance);
  const hasAsyncSetup = isPromise(res);

  // Return Promise for async setup
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
    // Functional component
    const root = comp(instance.props, {
      slots: instance.slots,
      emit: instance.emit,
      attrs: instance.attrs,
    });
    if (root) {
      renderVNode(push, normalizeVNode(root), instance);
    }
  } else if (instance.render) {
    // Component with render function
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

## VNode Rendering

### renderVNode

Renders according to each VNode type.

```ts
export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode;

  // SSR support for directives
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

Renders HTML elements to strings.

```ts
function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const tag = vnode.type as string;
  const { props, children, shapeFlag } = vnode;
  let openTag = `<${tag}`;

  // Render attributes
  if (props) {
    openTag += ssrRenderAttrs(props, tag);
  }

  push(openTag + `>`);

  // Void tags have no closing tag
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false;
    if (props) {
      // Handle special properties
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

Renders child elements in order.

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

SSR support for Teleport components.

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

  // Render inline if disabled
  if (disabled) {
    renderVNodeChildren(push, vnode.children as VNodeArrayChildren, parentComponent);
  } else {
    // Insert placeholder comments if enabled
    push(`<!--teleport start-->`);
    push(`<!--teleport end-->`);
  }
}
```

## Attribute Rendering

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

Renders dynamic attributes.

```ts
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }

  // Keep as-is for custom elements or SVG, otherwise convert
  const attrKey =
    tag && (tag.indexOf("-") > 0 || isSVGTag(tag))
      ? key
      : propsToAttrMap[key] || key.toLowerCase();

  // Handle boolean attributes
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

### Rendering class and style

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

## SSR Support for Directives

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

If a directive implements `getSSRProps`, its result is merged into props.

## Escape Processing

HTML escaping to prevent XSS.

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

## Usage Example

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

// Render on server side
const html = await renderToString(app);
console.log(html); // <div>Hello SSR!</div>
```

## Processing Flow

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
      ├── instance.render() or comp()
      └── renderVNode(push, root, instance)
          ├── Text → escapeHtml(children)
          ├── Comment → <!--...-->
          ├── Fragment → <!--[--> ... <!--]-->
          ├── Element → renderElementVNode()
          │   ├── <tag + ssrRenderAttrs(props) + >
          │   ├── children processing
          │   └── </tag>
          └── Component → renderComponentVNode() (recursive)
  ↓
unrollBuffer(buffer)
  ↓
HTML string
```

## Summary

The SSR implementation of chibivue consists of the following elements:

1. **SSRBuffer**: Buffer system for efficient string building (automatic string concatenation, async support)
2. **renderComponentVNode**: Converts component VNodes to HTML (async setup support)
3. **renderVNode**: Rendering branching according to each VNode type
4. **renderElementVNode**: Stringifying HTML elements (void tags, special properties support)
5. **ssrRenderAttrs**: Attribute rendering (class/style normalization, boolean attributes, safety checks)
6. **Escape processing**: HTML escaping for XSS protection
7. **Directive support**: Property injection during SSR via `getSSRProps`

In the next section, we'll learn about hydration, which "restores" the HTML generated by SSR on the client side.

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/010_ssr)
