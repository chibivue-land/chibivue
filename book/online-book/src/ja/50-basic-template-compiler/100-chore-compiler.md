# コンパイラの細かい調整

このチャプターでは，テンプレートコンパイラの品質を向上させるためのいくつかの調整を行います．\
主に以下の2つのトピックを扱います．

1. **ホワイトスペースの処理** - 不要な空白を削除・圧縮する
2. **テキストノードの結合** - 隣接するテキストノードを効率的に結合する

これらは見た目の機能というよりは，生成されるコードの品質を向上させるための最適化です．

## ホワイトスペースの処理

### 問題点

現在の実装では，テンプレート内のすべての空白がそのまま保持されます．\
例えば以下のようなテンプレートを考えてみましょう．

```html
<div>
  <span>Hello</span>
  <span>World</span>
</div>
```

現在の実装では，`<div>` と `<span>` の間の改行やインデントもテキストノードとして保持されます．\
これは無駄なノードを生成し，パフォーマンスに影響を与える可能性があります．

### Vue.js のアプローチ

Vue.js では，`whitespace` オプションを使用してホワイトスペースの処理方法を制御できます．

```ts
type WhitespaceStrategy = 'preserve' | 'condense'
```

- **`'condense'`** (デフォルト): 連続したホワイトスペースを圧縮し，不要なホワイトスペースを削除
- **`'preserve'`**: ホワイトスペースをそのまま保持

### condense モードの動作

condense モードでは，以下のルールに従ってホワイトスペースが処理されます．

1. **先頭・末尾のホワイトスペースのみのテキストノード** → 削除
2. **要素間の改行を含むホワイトスペース** → 削除
3. **連続するホワイトスペース** → 単一のスペースに圧縮
4. **要素間の改行を含まないホワイトスペース** → 保持（単一スペースに圧縮）

例:

```html
<div>   <span/>    </div>
<!-- 結果: <span/> のみが子ノード（前後のスペースは削除） -->

<div/>
<div/>
<div/>
<!-- 結果: 3つの div 要素のみ（改行を含むホワイトスペースは削除） -->

<span>foo</span>  <span>bar</span>
<!-- 結果: 要素間のスペースは保持される（改行がないため） -->
```

### 実装

まず，`ParserOptions` に `whitespace` オプションを追加します．

`packages/compiler-core/src/options.ts`:

```ts
export interface ParserOptions {
  // ... 既存のオプション ...
  whitespace?: 'preserve' | 'condense' // [!code ++]
}
```

`packages/compiler-core/src/parse.ts` にホワイトスペース処理の関数を追加します．

```ts
function isAllWhitespace(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (
      c !== 0x20 && // space
      c !== 0x09 && // tab
      c !== 0x0a && // newline
      c !== 0x0c && // form feed
      c !== 0x0d    // carriage return
    ) {
      return false
    }
  }
  return true
}

function hasNewlineChar(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (c === 0x0a || c === 0x0d) {
      return true
    }
  }
  return false
}

function condense(content: string): string {
  let result = ''
  let prevIsWhitespace = false
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    const isWhitespace =
      c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d
    if (isWhitespace) {
      if (!prevIsWhitespace) {
        result += ' '
        prevIsWhitespace = true
      }
    } else {
      result += content[i]
      prevIsWhitespace = false
    }
  }
  return result
}

function condenseWhitespace(
  nodes: TemplateChildNode[],
  context: ParserContext,
): TemplateChildNode[] {
  const shouldCondense = context.options.whitespace !== 'preserve'
  let removedWhitespace = false

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      if (!context.inPre) {
        if (isAllWhitespace(node.content)) {
          const prev = nodes[i - 1]?.type
          const next = nodes[i + 1]?.type
          // 以下の場合に削除:
          // - 先頭または末尾のホワイトスペース
          // - (condense モード) コメント間のホワイトスペース
          // - (condense モード) コメントと要素間のホワイトスペース
          // - (condense モード) 改行を含む要素間のホワイトスペース
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              ((prev === NodeTypes.COMMENT &&
                (next === NodeTypes.COMMENT || next === NodeTypes.ELEMENT)) ||
                (prev === NodeTypes.ELEMENT &&
                  (next === NodeTypes.COMMENT ||
                    (next === NodeTypes.ELEMENT &&
                      hasNewlineChar(node.content))))))
          ) {
            removedWhitespace = true
            nodes[i] = null as any
          } else {
            // それ以外の場合は単一スペースに圧縮
            node.content = ' '
          }
        } else if (shouldCondense) {
          // condense モードでは連続するホワイトスペースを圧縮
          node.content = condense(node.content)
        }
      }
    }
  }

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}
```

そして，要素のパース時にこの関数を呼び出します．

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // ... 既存の処理 ...

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = condenseWhitespace(children, context) // [!code ++]
    // element.children = children // [!code --]

    // ...
  }

  return element
}
```

また，ルートノードに対しても同様の処理を行います．

```ts
export const baseParse = (
  content: string,
  options: ParserOptions = {},
): RootNode => {
  const context = createParserContext(content, options)
  const children = parseChildren(context, [])
  return createRoot(condenseWhitespace(children, context)) // [!code ++]
  // return createRoot(children) // [!code --]
}
```

## テキストノードの結合 (transformText)

### 問題点

現在の実装では，テキストノードとマスタッシュ構文（`{{ }}`）が別々のノードとして扱われます．

```html
<div>abc {{ d }} {{ e }}</div>
```

このテンプレートは以下の3つの子ノードを持ちます:
- `TEXT`: "abc "
- `INTERPOLATION`: d
- `TEXT`: " "
- `INTERPOLATION`: e

コード生成時にこれらを個別に処理すると，効率が悪くなります．

### Vue.js のアプローチ

Vue.js では `transformText` というトランスフォーマーを使用して，隣接するテキストノードとマスタッシュ構文を1つの `CompoundExpression` に結合します．

結合後:
```ts
// "abc " + d + " " + e
createCompoundExpression(['abc ', d, ' ', e])
```

これにより，コード生成時に効率的な連結演算として出力できます．

### 実装

`packages/compiler-core/src/transforms/transformText.ts` を作成します．

```ts
import type { NodeTransform } from '../transform'
import {
  type CompoundExpressionNode,
  ElementTypes,
  NodeTypes,
  createCallExpression,
  createCompoundExpression,
} from '../ast'
import { isText } from '../utils'
import { CREATE_TEXT } from '../runtimeHelpers'
import { PatchFlags } from '@chibivue/shared'

// 隣接するテキストノードとマスタッシュを1つの式に結合
// 例: <div>abc {{ d }} {{ e }}</div> は1つの子ノードを持つ
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // 子の処理が完了した後に実行
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc,
                )
              }
              // 隣接するテキストノードを結合
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }

      if (
        !hasText ||
        // 単一のテキスト子を持つプレーン要素はそのまま残す
        // ランタイムが textContent を直接設定する最適化パスを持つため
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              !node.props.find(
                p =>
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name],
              ))))
      ) {
        return
      }

      // テキストノードを createTextVNode(text) 呼び出しに変換
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: any[] = []
          // createTextVNode はデフォルトで単一スペースなので，
          // 単一スペースの場合は引数を省略できる
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // 動的テキストにフラグを付けてブロック内でパッチされるようにする
          if (!context.ssr && !isStaticNode(child)) {
            callArgs.push(PatchFlags.TEXT)
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs,
            ),
          }
        }
      }
    }
  }
}

function isStaticNode(node: any): boolean {
  if (node.type === NodeTypes.TEXT) {
    return true
  }
  if (node.type === NodeTypes.INTERPOLATION) {
    return node.content.isStatic
  }
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    return node.children.every((child: any) => {
      if (typeof child === 'string') return true
      return isStaticNode(child)
    })
  }
  return false
}
```

`packages/compiler-core/src/utils.ts` に `isText` ヘルパーを追加します．

```ts
export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION
}
```

`packages/compiler-core/src/ast.ts` に `TEXT_CALL` ノードタイプと `createCallExpression` を追加します．

```ts
export const enum NodeTypes {
  // ... 既存のタイプ ...
  TEXT_CALL, // [!code ++]
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression
}

export function createCallExpression(
  callee: string,
  args: CallExpression['arguments'] = [],
  loc: SourceLocation = locStub,
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  }
}
```

`packages/compiler-core/src/runtimeHelpers.ts` に `CREATE_TEXT` を追加します．

```ts
export const CREATE_TEXT = Symbol('createTextVNode')

export const helperNameMap: Record<symbol, string> = {
  // ... 既存のヘルパー ...
  [CREATE_TEXT]: 'createTextVNode',
}
```

### トランスフォーマーの登録

`packages/compiler-core/src/compile.ts` でトランスフォーマーを登録します．

```ts
import { transformText } from './transforms/transformText'

export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformElement,
      transformSlotOutlet,
      transformText, // [!code ++]
    ],
    {
      on: transformOn,
      bind: transformBind,
      if: transformIf,
      for: transformFor,
      model: transformModel,
    },
  ]
}
```

### コード生成の更新

`packages/compiler-core/src/codegen.ts` に `TEXT_CALL` ノードの処理を追加します．

```ts
function genNode(node: any, context: CodegenContext) {
  switch (node.type) {
    // ... 既存のケース ...
    case NodeTypes.TEXT_CALL: // [!code ++]
      genNode(node.codegenNode, context) // [!code ++]
      break // [!code ++]
  }
}
```

### ランタイムの更新

`packages/runtime-core/src/vnode.ts` に `createTextVNode` を追加します．

```ts
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}
```

これを `packages/runtime-core/src/index.ts` からエクスポートします．

```ts
export { createTextVNode } from './vnode'
```

## 動作確認

以下のようなテンプレートで動作を確認してみましょう．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const name = ref('World')
    return { name }
  },
}
</script>

<template>
  <div>
    <p>Hello {{ name }}!</p>
  </div>
</template>
```

コンパイル結果を確認すると，以下のようになるはずです:
- 不要なホワイトスペース（改行・インデント）が削除されている
- `Hello ` と `{{ name }}` と `!` が結合されている

これでコンパイラの品質が向上しました！

ここまでのソースコード:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/100_chore_compiler)
