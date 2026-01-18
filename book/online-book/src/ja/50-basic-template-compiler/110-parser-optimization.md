# パーサーの最適化

::: info この章について
この章では，Vue 3.4 で導入された新しいパーサーアーキテクチャについて解説します．\
htmlparser2 をベースにした state-machine tokenizer により，パース速度が 2 倍に向上しました．
:::

## 背景

Vue 3.4 では，テンプレートコンパイラの内部実装が大幅にリファクタリングされました．これまでの chibivue で実装してきたパーサーは，Vue 3.3 以前のアーキテクチャに基づいています．

### 従来のパーサー（Vue 3.3 以前）

従来の Vue のパーサーは**再帰下降パーサー（recursive descent parser）**でした:

```ts
// 従来の実装イメージ
function parseChildren(context: ParserContext): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context)) {
    const s = context.source
    let node: TemplateChildNode | undefined

    if (startsWith(s, '{{')) {
      node = parseInterpolation(context)
    } else if (s[0] === '<') {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context)
      }
    }

    if (!node) {
      node = parseText(context)
    }

    nodes.push(node)
  }

  return nodes
}
```

この方式の問題点:
- 多くの**正規表現**を使用
- **先読み（look-ahead）検索**が頻繁に発生
- テンプレート文字列を何度も走査

### 新しいパーサー（Vue 3.4）

Vue 3.4 では，[htmlparser2](https://github.com/fb55/htmlparser2) の tokenizer をベースにした**ステートマシン tokenizer**が導入されました:

```ts
// 新しい実装イメージ
const enum State {
  Text,
  InterpolationOpen,
  Interpolation,
  InterpolationClose,
  BeforeTagName,
  InTagName,
  BeforeAttrName,
  InAttrName,
  // ...
}

class Tokenizer {
  private state = State.Text
  private index = 0

  parse(input: string) {
    for (let i = 0; i < input.length; i++) {
      this.index = i
      this.consume(input.charCodeAt(i))
    }
  }

  private consume(char: number) {
    switch (this.state) {
      case State.Text:
        this.handleText(char)
        break
      case State.BeforeTagName:
        this.handleBeforeTagName(char)
        break
      // ...
    }
  }
}
```

この方式の利点:
- テンプレート文字列を**一度だけ走査**
- 正規表現を使用しない（または最小限）
- **文字単位**で処理するため効率的
- **状態遷移**が明確で保守性が高い

<KawaikoNote variant="surprise" title="2 倍速！">

この state-machine tokenizer により，パース速度が**一貫して 2 倍**に向上しました！\
正規表現や先読み検索を避け，一文字ずつ順番に処理するだけで大幅な高速化が実現できるのは驚きですね．

</KawaikoNote>

## State Machine Tokenizer

ステートマシン tokenizer は，現在の状態（state）に基づいて次の文字をどう処理するかを決定します．

### 状態の定義

```ts
const enum State {
  // テキスト
  Text = 1,

  // 補間（Mustache）
  InterpolationOpen,     // {{ を検出中
  Interpolation,         // {{ 内のコンテンツ
  InterpolationClose,    // }} を検出中

  // タグ
  BeforeTagName,         // < の後
  InTagName,             // タグ名の中
  InSelfClosingTag,      // /> を検出中

  // 属性
  BeforeAttrName,        // 属性名の前
  InAttrName,            // 属性名の中
  AfterAttrName,         // 属性名の後（= の前）
  BeforeAttrValue,       // 属性値の前
  InAttrValueDq,         // ダブルクォート内の属性値
  InAttrValueSq,         // シングルクォート内の属性値
  InAttrValueNq,         // クォートなしの属性値

  // ディレクティブ
  InDirName,             // ディレクティブ名（v-xxx）
  InDirArg,              // ディレクティブ引数（:xxx）
  InDirDynamicArg,       // 動的引数（[xxx]）
  InDirModifier,         // 修飾子（.xxx）
}
```

### 状態遷移の例

```
<div v-if="show">Hello {{ name }}</div>
```

この例での状態遷移:

```
< → BeforeTagName
d → InTagName
i → InTagName
v → InTagName
(space) → BeforeAttrName
v → InAttrName (or InDirName)
- → InDirName
i → InDirName
f → InDirName
= → BeforeAttrValue
" → InAttrValueDq
s → InAttrValueDq
h → InAttrValueDq
o → InAttrValueDq
w → InAttrValueDq
" → BeforeAttrName
> → Text
H → Text
...
{ → InterpolationOpen
{ → Interpolation
(space) → Interpolation
n → Interpolation
a → Interpolation
m → Interpolation
e → Interpolation
(space) → Interpolation
} → InterpolationClose
} → Text
...
```

## Visitor パターン

新しいパーサーでは，**Visitor パターン**を使用して tokenizer と AST 構築を分離しています．

### Callbacks Interface

```ts
interface Callbacks {
  onText(start: number, end: number): void
  onInterpolation(start: number, end: number): void
  onOpenTag(tag: string, start: number): void
  onCloseTag(tag: string, start: number, end: number): void
  onSelfClosingTag(tag: string, start: number, end: number): void
  onAttr(name: string, value: string | undefined, start: number, end: number): void
  onDirective(
    name: string,
    arg: string | undefined,
    modifiers: string[],
    value: string | undefined,
    start: number,
    end: number
  ): void
  onComment(start: number, end: number): void
}
```

### Tokenizer と Parser の分離

```ts
class Tokenizer {
  private cbs: Callbacks

  constructor(callbacks: Callbacks) {
    this.cbs = callbacks
  }

  // tokenizer がイベントを発行
  private emitOpenTag(tag: string, start: number) {
    this.cbs.onOpenTag(tag, start)
  }

  private emitText(start: number, end: number) {
    this.cbs.onText(start, end)
  }
}

// Parser は Callbacks を実装して AST を構築
class Parser implements Callbacks {
  private stack: ElementNode[] = []
  private root: RootNode

  onOpenTag(tag: string, start: number) {
    const element: ElementNode = {
      type: NodeTypes.ELEMENT,
      tag,
      children: [],
      // ...
    }
    this.stack.push(element)
  }

  onCloseTag(tag: string, start: number, end: number) {
    const element = this.stack.pop()!
    const parent = this.stack[this.stack.length - 1]
    if (parent) {
      parent.children.push(element)
    } else {
      this.root.children.push(element)
    }
  }

  onText(start: number, end: number) {
    const parent = this.stack[this.stack.length - 1]
    const text: TextNode = {
      type: NodeTypes.TEXT,
      content: this.source.slice(start, end),
      // ...
    }
    parent.children.push(text)
  }
}
```

### メリット

1. **関心の分離**: Tokenizer は文字の解析のみ，Parser は AST 構築のみに集中
2. **テスタビリティ**: 各コンポーネントを独立してテスト可能
3. **再利用性**: Tokenizer を他の目的（シンタックスハイライト，Lint など）に再利用可能
4. **パフォーマンス**: 不要な中間データ構造を生成しない

<KawaikoNote variant="question" title="Visitor パターンって？">

Visitor パターンは「データ構造とその処理を分離する」設計パターンです．\
Tokenizer は「テンプレートを読んでイベントを発行するだけ」，Parser は「イベントを受け取って AST を作るだけ」というシンプルな責務分担になっています．\
これにより，コードが理解しやすく，テストもしやすくなります！

</KawaikoNote>

## パフォーマンス比較

Vue 3.4 のブログ記事によると:

| テンプレートサイズ | 改善率 |
|-----------------|-------|
| 小規模 | 約 2x |
| 中規模 | 約 2x |
| 大規模 | 約 2x |

一貫して 2 倍の高速化が実現されています．

この改善はエコシステム全体に波及します:
- **Volar**: IDE の補完・型チェック
- **vue-tsc**: 型チェック
- **ビルドツール**: Vite, Webpack など
- **コミュニティプラグイン**: ESLint, Prettier など

## chibivue での実装

::: warning
現在の chibivue は従来の再帰下降パーサーを使用しています．\
Vue 3.4 スタイルの tokenizer への移行は，今後の課題として検討されています．
:::

基本的な実装のアウトラインは以下の通りです:

<KawaikoNote variant="base" title="興味があれば挑戦！">

この章で紹介した state-machine tokenizer は，chibivue ではまだ実装していませんが，興味があれば自分で実装してみてください！\
Vue 3.4 のソースコードや htmlparser2 を参考にすると，理解が深まります．\
パーサーの最適化は，フレームワーク開発において非常に重要なスキルです．

</KawaikoNote>

```ts
// packages/compiler-core/tokenizer.ts
const enum State {
  Text = 1,
  InterpolationOpen,
  Interpolation,
  InterpolationClose,
  BeforeTagName,
  InTagName,
  // ...
}

const enum CharCodes {
  Lt = 0x3c,      // <
  Gt = 0x3e,      // >
  Slash = 0x2f,   // /
  Eq = 0x3d,      // =
  OpenBrace = 0x7b,  // {
  CloseBrace = 0x7d, // }
  // ...
}

export class Tokenizer {
  private state = State.Text
  private buffer = ''
  private sectionStart = 0
  private index = 0

  constructor(private cbs: Callbacks) {}

  parse(input: string) {
    this.buffer = input
    while (this.index < input.length) {
      const c = input.charCodeAt(this.index)
      switch (this.state) {
        case State.Text:
          this.stateText(c)
          break
        case State.InterpolationOpen:
          this.stateInterpolationOpen(c)
          break
        // ...
      }
      this.index++
    }
    this.finish()
  }

  private stateText(c: number) {
    if (c === CharCodes.Lt) {
      if (this.index > this.sectionStart) {
        this.cbs.onText(this.sectionStart, this.index)
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (c === CharCodes.OpenBrace) {
      this.state = State.InterpolationOpen
    }
  }

  private stateInterpolationOpen(c: number) {
    if (c === CharCodes.OpenBrace) {
      if (this.index > this.sectionStart + 1) {
        this.cbs.onText(this.sectionStart, this.index - 1)
      }
      this.state = State.Interpolation
      this.sectionStart = this.index + 1
    } else {
      this.state = State.Text
    }
  }

  // ...
}
```

## まとめ

- Vue 3.4 で htmlparser2 ベースの state-machine tokenizer が導入された
- テンプレート文字列を一度だけ走査することでパース速度が 2 倍に向上
- Visitor パターンにより tokenizer と AST 構築が分離され，保守性が向上
- この最適化はエコシステム全体（Volar, vue-tsc など）に恩恵をもたらす

## 参考リンク

- [Announcing Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) - Vue 公式ブログ
- [htmlparser2](https://github.com/fb55/htmlparser2) - Tokenizer のベースとなったライブラリ
- [Vue 3.4 Parser Refactor](https://github.com/vuejs/core/pull/9674) - GitHub PR
