# その他のディレクティブ

ここまでで v-bind, v-on, v-if, v-for, v-model といった主要なディレクティブを実装してきました．\
このチャプターでは，残りのビルトインディレクティブを実装していきます．

実装するディレクティブは以下の通りです．

- v-text
- v-html
- v-cloak
- v-pre

v-show については，ランタイムディレクティブの仕組みが必要になるため，カスタムディレクティブの章で扱います．\
また，v-once と v-memo については最適化に関連する内容なので，Web Application Essentials の Optimizations の章で扱う予定です．

## v-text

### 目指したい開発者インターフェース

v-text は要素の textContent を更新するディレクティブです．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello!')
    return { msg }
  },
}
</script>

<template>
  <span v-text="msg"></span>
  <!-- 以下と同等 -->
  <span>{{ msg }}</span>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-text

### 実装方針

v-text の実装はとてもシンプルです．\
コンパイル時に v-text ディレクティブを `textContent` プロパティへのバインディングに変換するだけです．

```html
<span v-text="msg"></span>
```

↓

```ts
h('span', { textContent: msg })
```

### compiler-dom に transformer を実装

v-text は DOM 固有のディレクティブなので，compiler-dom に実装します．

`packages/compiler-dom/src/transforms/vText.ts` を作成します．

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-text is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-text will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

ポイントは以下の通りです．

- exp が存在しない場合はエラーを出力
- 子要素が存在する場合は警告を出力し，子要素をクリア（v-text は子要素を上書きするため）
- `textContent` プロパティとして exp をバインド

あとは `packages/compiler-dom/src/index.ts` で transformer を登録します．

```ts
import { transformVText } from './transforms/vText'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText, // [!code ++]
}
```

これで v-text の実装は完了です！

## v-html

### 目指したい開発者インターフェース

v-html は要素の innerHTML を更新するディレクティブです．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const rawHtml = ref('<span style="color: red">This should be red.</span>')
    return { rawHtml }
  },
}
</script>

<template>
  <p>Using v-html directive: <span v-html="rawHtml"></span></p>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-html

::: warning
v-html は innerHTML を直接操作するため，XSS 脆弱性の原因になる可能性があります．\
信頼できないユーザー入力を v-html で表示することは避けてください．
:::

### 実装方針

v-html も v-text と同様に，コンパイル時に `innerHTML` プロパティへのバインディングに変換します．

```html
<span v-html="rawHtml"></span>
```

↓

```ts
h('span', { innerHTML: rawHtml })
```

### compiler-dom に transformer を実装

`packages/compiler-dom/src/transforms/vHtml.ts` を作成します．

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-html is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-html will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

v-text とほぼ同じ構造ですね．違いは `textContent` の代わりに `innerHTML` を使うことだけです．

`packages/compiler-dom/src/index.ts` で transformer を登録します．

```ts
import { transformVHtml } from './transforms/vHtml'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText,
  html: transformVHtml, // [!code ++]
}
```

これで v-html の実装も完了です！

## v-cloak

### 目指したい開発者インターフェース

v-cloak はコンポーネントがマウントされるまで要素を隠すためのディレクティブです．\
CSS と組み合わせて使用し，コンパイル前のテンプレート構文（マスタッシュなど）がユーザーに見えてしまうのを防ぎます．

```css
[v-cloak] {
  display: none;
}
```

```text
<div v-cloak>
  ｛｛ message ｝｝
</div>
```

マウント後，v-cloak 属性は自動的に削除されます．

https://vuejs.org/api/built-in-directives.html#v-cloak

### 実装方針

v-cloak の実装は非常にシンプルです．\
マウント時に v-cloak 属性を要素から削除するだけです．

これはコンパイラではなく，ランタイム側で処理します．\
具体的には，`renderer.ts` の `mountElement` 内で処理を追加します．

### ランタイムに実装

`packages/runtime-core/src/renderer.ts` の `mountElement` 関数に以下の処理を追加します．

```ts
const mountElement = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  let el: RendererElement
  const { type, props, children, shapeFlag } = vnode

  el = vnode.el = hostCreateElement(type as string)

  // ... 既存の処理 ...

  // v-cloak の削除 // [!code ++]
  if (props && 'v-cloak' in props) { // [!code ++]
    delete (el as any)['v-cloak'] // [!code ++]
    hostRemoveAttribute(el, 'v-cloak') // [!code ++]
  } // [!code ++]

  hostInsert(el, container, anchor)

  // ... 既存の処理 ...
}
```

`hostRemoveAttribute` は既存の `hostPatchProp` を利用して実装することもできますが，シンプルに `nodeOps` に追加しましょう．

`packages/runtime-dom/src/nodeOps.ts` に追加します．

```ts
export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  // ... 既存の処理 ...
  removeAttribute: (el, key) => {
    el.removeAttribute(key)
  },
}
```

`packages/runtime-core/src/renderer.ts` の `RendererOptions` 型にも追加します．

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  // ... 既存の処理 ...
  removeAttribute(el: HostElement, key: string): void
}
```

これで v-cloak の実装は完了です！

## v-pre

### 目指したい開発者インターフェース

v-pre はこの要素とすべての子要素のコンパイルをスキップするためのディレクティブです．\
マスタッシュ構文などをそのまま表示したい場合に使用します．

```text
<template>
  <span v-pre>｛｛ this will not be compiled ｝｝</span>
</template>
```

上記のテンプレートは `｛｛ this will not be compiled ｝｝` というテキストをそのまま表示します．

https://vuejs.org/api/built-in-directives.html#v-pre

### 実装方針

v-pre は他のディレクティブとは異なり，パーサーの段階で処理を行います．\
v-pre 属性を持つ要素を検出したら，その要素とその子要素に対してはディレクティブやマスタッシュ構文の解析をスキップします．

### パーサーに実装

`packages/compiler-core/src/parse.ts` に v-pre の処理を追加します．

まず，パーサーコンテキストに `inVPre` フラグを追加します．

```ts
export interface ParserContext {
  // ... 既存のプロパティ ...
  inVPre: boolean // [!code ++]
}

function createParserContext(content: string, options: ParserOptions): ParserContext {
  return {
    // ... 既存の処理 ...
    inVPre: false, // [!code ++]
  }
}
```

次に，要素をパースする際に v-pre 属性をチェックし，その場合は `inVPre` を true にします．

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // Start tag
  const element = parseTag(context, TagType.Start)

  // v-pre のチェック // [!code ++]
  const isPreBoundary = element.props.some( // [!code ++]
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'pre' // [!code ++]
  ) // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = true // [!code ++]
  } // [!code ++]

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = children

    // End tag
    if (startsWithEndTagOpen(context.source, element.tag)) {
      parseTag(context, TagType.End)
    }
  }

  // v-pre の終了 // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = false // [!code ++]
  } // [!code ++]

  return element
}
```

そして，`inVPre` が true の場合は，ディレクティブやマスタッシュ構文の解析をスキップするようにします．

`parseAttribute` 関数を修正します．

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // ... 属性名のパース処理 ...

  // v-pre の場合はディレクティブとして解析しない // [!code ++]
  if (context.inVPre) { // [!code ++]
    return { // [!code ++]
      type: NodeTypes.ATTRIBUTE, // [!code ++]
      name, // [!code ++]
      value: value && { // [!code ++]
        type: NodeTypes.TEXT, // [!code ++]
        content: value.content, // [!code ++]
        loc: value.loc, // [!code ++]
      }, // [!code ++]
      loc, // [!code ++]
    } // [!code ++]
  } // [!code ++]

  // ディレクティブのパース処理 ...
}
```

また，`parseChildren` 関数でマスタッシュ構文の解析をスキップするようにします．

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (startsWith(s, context.options.delimiters[0])) {
      // v-pre の場合はマスタッシュをスキップ // [!code ++]
      if (!context.inVPre) { // [!code ++]
        node = parseInterpolation(context)
      } // [!code ++]
    } else if (s[0] === '<') {
      // ... 要素のパース処理 ...
    }

    if (!node) {
      node = parseText(context)
    }

    nodes.push(node)
  }

  return nodes
}
```

これで v-pre の実装は完了です！

## 動作確認

それでは実装したディレクティブの動作を確認してみましょう．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello, chibivue!')
    const rawHtml = ref('<span style="color: red">Red text</span>')
    return { msg, rawHtml }
  },
}
</script>

<template>
  <div>
    <h2>v-text</h2>
    <span v-text="msg"></span>

    <h2>v-html</h2>
    <div v-html="rawHtml"></div>

    <h2>v-pre</h2>
    <span v-pre>｛｛ msg ｝｝ will not be compiled</span>
  </div>
</template>
```

うまく動作しましたか？\
これで基本的なビルトインディレクティブの実装が完了しました！

v-show とカスタムディレクティブについては，次のチャプターで扱います．\
v-once と v-memo については，最適化の章で扱う予定です．

ここまでのソースコード:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/090_other_directives)
