# Compiler SSR

## SSR コンパイラとは

SSR コンパイラ（`@chibivue/compiler-ssr`）は，テンプレートを SSR に最適化されたコードにコンパイルするパッケージです．

通常のクライアントサイドコンパイルでは VNode を生成するコードを出力しますが，SSR コンパイラは直接 HTML 文字列を生成するコードを出力します．これにより，サーバーサイドでのレンダリング効率が向上します．

<KawaikoNote variant="base" title="クライアントと SSR の違い">

クライアントサイドでは:
```js
// VNode を返す
return _createElementVNode("div", { class: "hello" }, "Hello")
```

SSR では:
```js
// 直接 HTML 文字列を push
_push(`<div class="hello">Hello</div>`)
```

SSR では VNode を経由せず直接文字列を生成するので効率的です！

</KawaikoNote>

## パッケージ構成

```
packages/compiler-ssr/src/
├── index.ts                    # メインエントリーポイント
├── runtimeHelpers.ts           # SSR ヘルパー関数の定義
├── ssrCodegenTransform.ts      # SSR コード生成変換
└── transforms/
    ├── ssrTransformElement.ts   # 要素の変換
    ├── ssrTransformComponent.ts # コンポーネントの変換
    ├── ssrVIf.ts               # v-if の変換
    └── ssrVFor.ts              # v-for の変換
```

## コンパイルの流れ

SSR コンパイルは以下の手順で行われます：

1. **パース**: テンプレートを AST に変換（`@chibivue/compiler-dom` の `parse` を使用）
2. **変換**: SSR 用の NodeTransform を適用
3. **SSR Codegen Transform**: AST を SSR 用のコード生成ノードに変換
4. **コード生成**: 最終的な JavaScript コードを生成

```ts
// packages/compiler-ssr/src/index.ts
export function compile(source: string | RootNode, options: CompilerOptions = {}): CodegenResult {
  const ast = typeof source === "string" ? baseParse(source, options) : source;

  transform(ast, {
    ...options,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      transformExpression,
      ssrTransformElement,
      ssrTransformComponent,
      ...(options.nodeTransforms || []),
    ],
  });

  // テンプレート AST を SSR 用のコード生成 AST に変換
  ssrCodegenTransform(ast, options);

  return generate(ast, options);
}
```

## SSR Transform Context

SSR 変換で使用されるコンテキストです．

```ts
// packages/compiler-ssr/src/ssrCodegenTransform.ts
export interface SSRTransformContext {
  root: RootNode;
  options: CompilerOptions;
  body: (JSChildNode | IfStatement)[];
  helpers: Set<symbol>;
  onError: (error: Error) => void;
  helper<T extends symbol>(name: T): T;
  pushStringPart(part: TemplateLiteral["elements"][0]): void;
  pushStatement(statement: IfStatement | CallExpression): void;
}
```

### pushStringPart

文字列パートをバッファに追加します．連続する文字列は自動的に結合されます．

```ts
pushStringPart(part) {
  if (!currentString) {
    const currentCall = createCallExpression(`_push`);
    body.push(currentCall);
    currentString = createTemplateLiteral([]);
    currentCall.arguments.push(currentString);
  }
  const bufferedElements = currentString.elements;
  const lastItem = bufferedElements[bufferedElements.length - 1];
  if (isString(part) && isString(lastItem)) {
    // 連続する文字列は結合
    bufferedElements[bufferedElements.length - 1] += part;
  } else {
    bufferedElements.push(part);
  }
}
```

### pushStatement

制御フロー文（if/for）をバッファに追加します．

```ts
pushStatement(statement) {
  // 現在の文字列バッファを閉じる
  currentString = null;
  body.push(statement);
}
```

## 要素の変換

### ssrTransformElement

HTML 要素を SSR 用のコードに変換します．

```ts
// packages/compiler-ssr/src/transforms/ssrTransformElement.ts
export const ssrTransformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT) {
    return;
  }

  return function ssrPostTransformElement() {
    const openTag: TemplateLiteral["elements"] = [`<${node.tag}`];

    // 属性の処理
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        openTag.push(` ${prop.name}="${escapeHtml(prop.value.content)}"`);
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        // v-bind の処理
        if (prop.name === "bind" && prop.arg && prop.exp) {
          // class, style, その他の属性を処理
        }
      }
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag);
  };
};
```

#### 属性のバインディング

- **静的属性**: 直接文字列として出力
- **v-bind:class**: `ssrRenderClass` ヘルパーを使用
- **v-bind:style**: `ssrRenderStyle` ヘルパーを使用
- **その他の動的属性**: `ssrRenderAttr` または `ssrRenderDynamicAttr` を使用

### ssrProcessElement

変換後の要素を処理してコードを生成します．

```ts
export function ssrProcessElement(node: PlainElementNode, context: SSRTransformContext): void {
  // 開始タグを出力
  for (const element of node.ssrCodegenNode!.elements) {
    context.pushStringPart(element);
  }
  context.pushStringPart(`>`);

  // v-html の処理
  const vHtml = node.props.find(p => p.type === NodeTypes.DIRECTIVE && p.name === "html");
  if (vHtml && vHtml.exp) {
    context.pushStringPart(vHtml.exp);
  } else if (node.children.length) {
    processChildren(node, context);
  }

  // 閉じタグ（void 要素以外）
  if (!isVoidTag(node.tag)) {
    context.pushStringPart(`</${node.tag}>`);
  }
}
```

## コンポーネントの変換

コンポーネントは実行時に `ssrRenderComponent` を通じてレンダリングされます．

```ts
// packages/compiler-ssr/src/transforms/ssrTransformComponent.ts
export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext,
  parent: { children: any[] },
): void {
  const vnodeCall = createCallExpression(context.helper(SSR_RENDER_VNODE), [
    `_push`,
    createCallExpression(context.helper(SSR_RENDER_COMPONENT), [
      createSimpleExpression(`_component_${node.tag}`, false),
      // props
      node.props.length ? /* props オブジェクト */ : createSimpleExpression(`null`, false),
      // slots
      createSimpleExpression(`null`, false),
      // parent component
      `_parent`,
    ]),
    `_parent`,
  ]);

  context.pushStatement(vnodeCall);
}
```

## v-if の変換

v-if は JavaScript の if 文に変換されます．

```ts
// packages/compiler-ssr/src/transforms/ssrVIf.ts
export function ssrProcessIf(node: IfNode, context: SSRTransformContext): void {
  const [rootBranch] = node.branches;
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context),
  );
  context.pushStatement(ifStatement);

  let currentIf = ifStatement;
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i];
    const branchBlockStatement = processIfBranch(branch, context);
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(branch.condition, branchBlockStatement);
    } else {
      // else
      currentIf.alternate = branchBlockStatement;
    }
  }

  // else がない場合は空コメントを出力
  if (!currentIf.alternate) {
    currentIf.alternate = createBlockStatement([createCallExpression(`_push`, ["`<!---->`"])]);
  }
}
```

入力:
```html
<div v-if="show">Visible</div>
<div v-else>Hidden</div>
```

出力:
```js
if (show) {
  _push(`<div>Visible</div>`)
} else {
  _push(`<div>Hidden</div>`)
}
```

## v-for の変換

v-for は `ssrRenderList` ヘルパーを使用して変換されます．

```ts
// packages/compiler-ssr/src/transforms/ssrVFor.ts
export function ssrProcessFor(node: ForNode, context: SSRTransformContext): void {
  const renderLoop = createFunctionExpression(createForLoopParams(node.parseResult));
  renderLoop.body = processChildrenAsStatement(node, context);

  // フラグメントマーカー
  context.pushStringPart(`<!--[-->`);
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [node.source, renderLoop]),
  );
  context.pushStringPart(`<!--]-->`);
}
```

入力:
```html
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

出力:
```js
_push(`<!--[-->`)
_ssrRenderList(items, (item) => {
  _push(`<div>${_ssrInterpolate(item.name)}</div>`)
})
_push(`<!--]-->`)
```

## SSR ヘルパー

SSR コンパイラは以下のランタイムヘルパーを使用します．これらは `@chibivue/server-renderer` から提供されます．

```ts
// packages/compiler-ssr/src/runtimeHelpers.ts
export const SSR_INTERPOLATE: unique symbol = Symbol(`ssrInterpolate`);
export const SSR_RENDER_ATTRS: unique symbol = Symbol(`ssrRenderAttrs`);
export const SSR_RENDER_ATTR: unique symbol = Symbol(`ssrRenderAttr`);
export const SSR_RENDER_CLASS: unique symbol = Symbol(`ssrRenderClass`);
export const SSR_RENDER_STYLE: unique symbol = Symbol(`ssrRenderStyle`);
export const SSR_RENDER_DYNAMIC_ATTR: unique symbol = Symbol(`ssrRenderDynamicAttr`);
export const SSR_RENDER_LIST: unique symbol = Symbol(`ssrRenderList`);
export const SSR_INCLUDE_BOOLEAN_ATTR: unique symbol = Symbol(`ssrIncludeBooleanAttr`);
export const SSR_RENDER_COMPONENT: unique symbol = Symbol(`ssrRenderComponent`);
export const SSR_RENDER_VNODE: unique symbol = Symbol(`ssrRenderVNode`);
```

### ヘルパーの役割

| ヘルパー | 役割 |
|---------|------|
| `ssrInterpolate` | テキスト補間のエスケープ |
| `ssrRenderAttrs` | オブジェクト形式の属性をレンダリング |
| `ssrRenderClass` | class のレンダリング |
| `ssrRenderStyle` | style のレンダリング |
| `ssrRenderList` | v-for のイテレーション |
| `ssrRenderComponent` | コンポーネントの VNode 作成 |
| `ssrRenderVNode` | VNode を HTML 文字列に変換 |

## SFC との統合

compiler-sfc は SSR モードでのコンパイルをサポートしています．

```ts
// packages/compiler-sfc/src/compileTemplate.ts
export function compileTemplate({
  source,
  compiler,
  compilerOptions,
  id,
  scoped,
  ssr = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = (compiler || defaultCompiler).compile(source, {
    ...compilerOptions,
    ssr,
  });
  return { code, ast, source, preamble };
}
```

`ssr: true` を指定すると，自動的に SSR コンパイラが使用されます．

## 生成されるコード例

入力テンプレート:
```html
<div class="container">
  <h1>{{ title }}</h1>
  <ul>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>
  </ul>
</div>
```

生成されるコード:
```js
import { ssrInterpolate as _ssrInterpolate, ssrRenderList as _ssrRenderList } from 'chibivue/server-renderer'

function ssrRender(_ctx, _push, _parent, _attrs) {
  _push(`<div class="container"><h1>${_ssrInterpolate(_ctx.title)}</h1><ul><!--[-->`)
  _ssrRenderList(_ctx.items, (item) => {
    _push(`<li>${_ssrInterpolate(item.name)}</li>`)
  })
  _push(`<!--]--></ul></div>`)
}
```

<KawaikoNote variant="surprise" title="SSR コンパイラの利点">

SSR コンパイラを使うと:
- VNode のオーバーヘッドがない
- テンプレートリテラルで効率的に文字列を生成
- 静的な部分は直接文字列として出力される

これらにより，サーバーサイドでのレンダリングパフォーマンスが向上します！

</KawaikoNote>
