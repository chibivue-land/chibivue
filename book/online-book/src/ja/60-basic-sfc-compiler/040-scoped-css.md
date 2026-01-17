# Scoped CSS に対応する

::: info この章について
この章では，Vue の Scoped CSS 機能の実装方法を学びます。\
コンポーネントごとにスタイルを分離し，スタイルの衝突を防ぐ仕組みを理解しましょう。
:::

## Scoped CSS とは

Scoped CSS は，`<style scoped>` で定義されたスタイルをそのコンポーネントにのみ適用する機能です。

```vue
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

このスタイルは，同じクラス名を持つ他のコンポーネントの要素には影響しません。

<KawaikoNote variant="question" title="なぜ Scoped CSS が必要？">

大規模なアプリケーションでは，異なるコンポーネントで同じクラス名を使うことがあります。\
Scoped CSS がないと，スタイルが意図せず他のコンポーネントに影響してしまいます。\
コンポーネントごとにスタイルを分離することで，安全にスタイリングできます！

</KawaikoNote>

## 実装の仕組み

Scoped CSS は以下のステップで実現されます：

1. **スコープ ID の生成**: コンポーネントごとにユニークな ID を生成
2. **テンプレートの変換**: 要素に `data-v-xxx` 属性を追加
3. **スタイルの変換**: セレクタに `[data-v-xxx]` を追加

### 変換の例

```vue
<!-- 入力 -->
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

```html
<!-- 出力 (HTML) -->
<p class="message" data-v-7ba5bd90>Hello</p>

<!-- 出力 (CSS) -->
<style>
.message[data-v-7ba5bd90] {
  color: red;
}
</style>
```

## スコープ ID の生成

コンポーネントごとにユニークな ID を生成します。通常はファイルパスのハッシュを使用します。

```ts
// packages/compiler-sfc/src/parse.ts

import { createHash } from 'crypto'

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME }: SFCParseOptions = {},
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
  }

  // スコープ ID を生成
  descriptor.id = createHash('sha256')
    .update(filename + source)
    .digest('hex')
    .slice(0, 8)

  // ... 残りのパース処理
}
```

## SFCStyleBlock の拡張

スタイルブロックに scoped 情報を追加します。

```ts
// packages/compiler-sfc/src/parse.ts

export interface SFCStyleBlock extends SFCBlock {
  type: "style"
  scoped?: boolean  // 追加
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  // ...
  node.props.forEach((p) => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      attrs[p.name] = p.value ? p.value.content || true : true
      if (type === "style") {
        if (p.name === "scoped") {
          (block as SFCStyleBlock).scoped = true
        }
      }
    }
  })
  return block
}
```

## テンプレートの変換

テンプレートコンパイル時に，要素に scopeId 属性を追加します。

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, scopeId } = context
  const { tag, props, children } = node

  // scopeId がある場合は props に追加
  let propsWithScope = props
  if (scopeId) {
    const scopeIdProp = `"data-v-${scopeId}": ""`
    if (props) {
      // 既存の props とマージ
      propsWithScope = `{ ...${props}, ${scopeIdProp} }`
    } else {
      propsWithScope = `{ ${scopeIdProp} }`
    }
  }

  push(helper(CREATE_ELEMENT_VNODE) + `(`)
  genNodeList(genNullableArgs([tag, propsWithScope, children]), context)
  push(`)`)
}
```

## スタイルの変換

CSS セレクタにスコープ属性セレクタを追加します。

```ts
// packages/compiler-sfc/src/compileStyle.ts

import postcss from 'postcss'

export interface SFCStyleCompileOptions {
  source: string
  filename: string
  id: string
  scoped?: boolean
}

export function compileStyle(options: SFCStyleCompileOptions): string {
  const { source, id, scoped } = options

  if (!scoped) {
    return source
  }

  // PostCSS を使ってセレクタを変換
  const result = postcss([scopedPlugin(id)]).process(source, { from: undefined })
  return result.css
}

function scopedPlugin(id: string) {
  const scopeId = `data-v-${id}`

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      // セレクタに [data-v-xxx] を追加
      rule.selectors = rule.selectors.map((selector) => {
        return `${selector}[${scopeId}]`
      })
    },
  }
}
```

## Vite プラグインでの統合

```ts
// packages/@extensions/vite-plugin-chibivue/src/main.ts

async function genStyleCode(descriptor: SFCDescriptor): Promise<string> {
  let stylesCode = ``

  for (let i = 0; i < descriptor.styles.length; i++) {
    const style = descriptor.styles[i]
    const src = descriptor.filename
    const scoped = style.scoped ? '&scoped=true' : ''
    const query = `?chibivue&type=style&index=${i}${scoped}&lang.css`
    const styleRequest = src + query
    stylesCode += `\nimport ${JSON.stringify(styleRequest)}`
  }

  return stylesCode
}

// Vite プラグインの load でスタイルをコンパイル
load(id) {
  const { filename, query } = parseChibiVueRequest(id)
  if (query.chibivue && query.type === "style") {
    const descriptor = getDescriptor(filename, options)!
    const style = descriptor.styles[query.index!]

    if (query.scoped) {
      return {
        code: compileStyle({
          source: style.content,
          filename,
          id: descriptor.id,
          scoped: true,
        })
      }
    }

    return { code: style.content }
  }
}
```

<KawaikoNote variant="surprise" title="PostCSS の力！">

スタイルの変換には PostCSS を使っています。\
PostCSS は CSS を AST として扱えるツールで，セレクタの変換が簡単にできます。\
Vue.js も内部で PostCSS を使っています！

</KawaikoNote>

## 動作確認

```vue
<!-- ComponentA.vue -->
<template>
  <p class="text">Component A</p>
</template>

<style scoped>
.text {
  color: red;
}
</style>
```

```vue
<!-- ComponentB.vue -->
<template>
  <p class="text">Component B</p>
</template>

<style scoped>
.text {
  color: blue;
}
</style>
```

両方のコンポーネントが同じクラス名 `.text` を使用していますが，それぞれ異なる色で表示されます。

## 今後の拡張

現在の chibivue では Scoped CSS は未実装ですが，以下の機能も検討できます：

- **:deep() セレクタ**: 子コンポーネントのスタイルを変更
- **:slotted() セレクタ**: スロット内容のスタイル
- **:global() セレクタ**: グローバルスタイルの定義
- **CSS Modules**: クラス名の自動生成

<KawaikoNote variant="base" title="実装に挑戦！">

この章で説明した仕組みを参考に，ぜひ Scoped CSS を実装してみてください！\
PostCSS の使い方を学ぶ良い機会にもなります。

</KawaikoNote>

## まとめ

- Scoped CSS はコンポーネントごとにスタイルを分離する機能
- ユニークな scopeId を生成してテンプレートとスタイルに適用
- テンプレートには `data-v-xxx` 属性，CSS には `[data-v-xxx]` セレクタ
- PostCSS を使ってセレクタを変換

## 参考リンク

- [Vue.js - Scoped CSS](https://vuejs.org/api/sfc-css-features.html#scoped-css) - Vue 公式ドキュメント
- [PostCSS](https://postcss.org/) - CSS 変換ツール
