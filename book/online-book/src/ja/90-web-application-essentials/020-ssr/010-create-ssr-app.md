# Server Side Rendering (SSR)

## SSR とは

Server Side Rendering (SSR) は、Vue.js アプリケーションをサーバー上で HTML 文字列にレンダリングし、クライアントに送信する技術です。これにより以下のメリットがあります：

1. **SEO の向上**: 検索エンジンのクローラーが完全なコンテンツを取得できる
2. **初期表示の高速化**: ブラウザは JavaScript の実行を待たずに HTML を表示できる
3. **パフォーマンスの改善**: 特に低速なデバイスやネットワーク環境で効果的

## パッケージ構成

chibivue の SSR 実装は `@chibivue/server-renderer` パッケージで提供されています。

```
packages/server-renderer/src/
├── index.ts
├── renderToString.ts      # メインエントリーポイント
├── render.ts              # VNode レンダリング
└── helpers/
    ├── ssrRenderAttrs.ts  # 属性のレンダリング
    └── ssrUtils.ts        # ユーティリティ関数
```

## 型定義

### SSRBuffer

SSR では、レンダリング結果を効率的に構築するために `SSRBuffer` というデータ構造を使用します。

```ts
// packages/server-renderer/src/render.ts
export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean };
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
export type PushFn = (item: SSRBufferItem) => void;
```

バッファは以下を含むことができます：
- **文字列**: HTML の一部
- **ネストされたバッファ**: 子コンポーネントの結果
- **Promise**: 非同期コンポーネントの結果

### SSRContext

SSR 時のコンテキスト情報を保持します。

```ts
export type SSRContext = {
  [key: string]: any;
  teleports?: Record<string, string>;
  __teleportBuffers?: Record<string, SSRBuffer>;
  __watcherHandles?: (() => void)[];
};
```

## renderToString の実装

### メインエントリーポイント

```ts
// packages/server-renderer/src/renderToString.ts
export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // VNode を直接渡された場合、ラッパーコンポーネントで包む
    const vnode = input;
    const buffer = await renderComponentVNode(
      createVNode({ render: () => vnode }),
      null,
    );
    return unrollBuffer(buffer as SSRBuffer) as Promise<string>;
  }

  // App インスタンスの場合
  const app = input;
  const vnode = createVNode(app._component, app._props);
  vnode.appContext = app._context;

  const buffer = await renderComponentVNode(vnode);
  const result = await unrollBuffer(buffer as SSRBuffer);

  // watcher のクリーンアップ
  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch();
    }
  }

  return result;
}
```

### バッファの展開

ネストされたバッファと Promise を再帰的に展開します。

```ts
function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  // 非同期要素がなければ同期的に処理
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

    // Promise の場合は解決を待つ
    if (isPromise(item)) {
      return item.then((nestedItem) => {
        buffer[i] = nestedItem;
        return nestedUnrollBuffer(buffer, ret, i);
      });
    }

    // ネストされたバッファは再帰処理
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

## createBuffer の実装

バッファを効率的に構築するためのファクトリ関数です。

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
        // 連続する文字列は結合して最適化
        buffer[buffer.length - 1] += item as string;
        return;
      }
      buffer.push(item);
      appendable = isStringItem;
      // Promise や非同期バッファがあればフラグを立てる
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true;
      }
    },
  };
}
```

ポイント：
1. 連続する文字列は自動的に結合（メモリ効率化）
2. `appendable` フラグで結合可能かを追跡
3. 非同期要素があれば `hasAsync` フラグを設定

## コンポーネントのレンダリング

### renderComponentVNode

```ts
export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  // コンポーネントインスタンスを作成
  const instance = (vnode.component = createComponentInstance(
    vnode,
    parentComponent,
    null,
  ));

  // setup を実行
  const res = setupComponent(instance);
  const hasAsyncSetup = isPromise(res);

  // 非同期 setup の場合は Promise を返す
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
    // 関数コンポーネント
    const root = comp(instance.props, {
      slots: instance.slots,
      emit: instance.emit,
      attrs: instance.attrs,
    });
    if (root) {
      renderVNode(push, normalizeVNode(root), instance);
    }
  } else if (instance.render) {
    // render 関数を持つコンポーネント
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

## VNode のレンダリング

### renderVNode

各種 VNode タイプに応じてレンダリングを行います。

```ts
export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode;

  // ディレクティブの SSR 対応
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

HTML 要素を文字列にレンダリングします。

```ts
function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const tag = vnode.type as string;
  const { props, children, shapeFlag } = vnode;
  let openTag = `<${tag}`;

  // 属性をレンダリング
  if (props) {
    openTag += ssrRenderAttrs(props, tag);
  }

  push(openTag + `>`);

  // void タグは閉じタグなし
  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false;
    if (props) {
      // 特殊プロパティの処理
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

子要素を順番にレンダリングします。

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

Teleport コンポーネントの SSR 対応です。

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

  // disabled の場合はインラインでレンダリング
  if (disabled) {
    renderVNodeChildren(push, vnode.children as VNodeArrayChildren, parentComponent);
  } else {
    // enabled の場合はプレースホルダーコメントを挿入
    push(`<!--teleport start-->`);
    push(`<!--teleport end-->`);
  }
}
```

## 属性のレンダリング

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

動的な属性をレンダリングします。

```ts
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }

  // カスタム要素や SVG ではそのまま、それ以外は変換
  const attrKey =
    tag && (tag.indexOf("-") > 0 || isSVGTag(tag))
      ? key
      : propsToAttrMap[key] || key.toLowerCase();

  // boolean 属性の処理
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

### class と style のレンダリング

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

## ディレクティブの SSR 対応

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

ディレクティブが `getSSRProps` を実装していれば、その結果を props にマージします。

## エスケープ処理

XSS を防ぐための HTML エスケープです。

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

## 使用例

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

// サーバーサイドでレンダリング
const html = await renderToString(app);
console.log(html); // <div>Hello SSR!</div>
```

## 処理フロー

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
          │   ├── children の処理
          │   └── </tag>
          └── Component → renderComponentVNode() (再帰)
  ↓
unrollBuffer(buffer)
  ↓
HTML 文字列
```

## まとめ

chibivue の SSR 実装は以下の要素で構成されています：

1. **SSRBuffer**: 効率的な文字列構築のためのバッファシステム（文字列の自動結合、非同期対応）
2. **renderComponentVNode**: コンポーネントの VNode を HTML に変換（非同期 setup 対応）
3. **renderVNode**: 各種 VNode タイプに応じたレンダリング分岐
4. **renderElementVNode**: HTML 要素の文字列化（void タグ、特殊プロパティ対応）
5. **ssrRenderAttrs**: 属性のレンダリング（class/style 正規化、boolean 属性、安全性チェック）
6. **エスケープ処理**: XSS 対策のための HTML エスケープ
7. **ディレクティブ対応**: `getSSRProps` による SSR 時のプロパティ注入

次のセクションでは、SSR で生成された HTML をクライアントサイドで「復元」する hydration について学びます。
