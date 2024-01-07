# イベント修飾子

## 今回やること

前回、v-on ディレクティブを実装したので続いてはイベント修飾子を実装します。

Vue.js には preventDefault や stopPropagation に対応する修飾子があります。

https://ja.vuejs.org/guide/essentials/event-handling.html#event-modifiers

今回は以下のような開発者インターフェースを目指してみましょう。

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const inputText = ref('')

    const buffer = ref('');
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      buffer.value = target.value
    }
    const submit = () => {
      inputText.value = buffer.value
      buffer.value = ''
    };

    return { inputText, buffer, handleInput,fun submit }
  },

  template: `<div>
    <form @submit.prevent="submit">
      <label>
        Input Data
        <input :value="buffer" @input="handleInput" />
      </label>
      <button>submit</button>
    </form>
    <p>inputText: {{ inputText }}</p>
</div>`,
});

const app = createApp(App)

app.mount('#app')
```

特に、以下の部分に注目してください。

```html
<form @submit.prevent="submit"></form>
```

`@submit.prevent` という記述があります。これは submit イベントのハンドラを呼び出す際に、`preventDefault` を実行するという意味です。

この `.prevent` を記述しない場合、submit 時にページがリロードされてしまいます。

## AST と Parser の実装

テンプレートの新しいシンタックスを追加するわけなので、Parser と AST の変更が必要になります。

まずは AST を見てみましょう。これはとっても簡単で、`DirectiveNode` に `modifiers` というプロパティ(string の配列)を追加するだけです。

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[] // ここを追加
}
```

これに合わせて Parser も実装します。

実は本家から拝借した正規表現にもう含まれているので、こちらの実装もとても簡単です。

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  const modifiers = match[3] ? match[3].slice(1).split('.') : [] // match 結果から修飾子を取り出す
  return {
    type: NodeTypes.DIRECTIVE,
    name: dirName,
    exp: value && {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value.content,
      isStatic: false,
      loc: value.loc,
    },
    loc,
    arg,
    modifiers, // return に含める
  }
}
```

はい。これで AST と Parser の実装は完了です。

## compiler-dom/transform

ここで少し今のコンパイラの構成をおさらいしてみます。

現状は以下のような構成になっています。

![50-027-compiler-architecture](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/50-027-compiler-architecture.drawio.png)

compiler-core と compiler-dom のそれぞれの役割を改めて理解してみると、  
compiler-core は DOM に依存しないコンパイラの機能を提供するもので、AST の生成や、その変換を行います。

これまでに、v-on ディレクティブなどを compiler-core に実装しましたが、これは`@click="handle"` という記述を `{ onClick: handle }` というオブジェクトに変換しているだけで、  
DOM に依存するような処理は行っていません。

ここで、今回実装したいものを見てみましょう。  
今回は実際に `e.preventDefault()` や `e.stopPropagation()` を実行するコードを生成したいです。  
これらは大きく DOM に依存してしまいます。

そこで、compiler-dom 側にも transformer を実装していきます。 DOM に関連する transform はここに実装して行くことにしましょう。

compiler-dom の方に `transformOn` を実装していきたいのですが、runtime-core の `transformOn` との兼ね合いを考える必要があります。  
兼ね合いというのは、「compiler-core の transform も実行しつつ、compiler-dom で実装した transform を実装するにはどうすればいいのか?」 ということです。

そこでまず、 compiler-core の方に実装してある `DirectiveTransform` という interface に手を加えていきます。

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult, // 追加
) => DirectiveTransformResult
```

augmentor というものを追加してみました。  
まぁ、これはただのコールバック関数です。 `DirectiveTransform` の interface としてコールバックを受け取れるようにして、transform 関数を拡張可能にしています。

compiler-dom の方では、compiler-core で実装した transformer をラップした transformer の実装をしていくようにします。

```ts
// 実装イメージ

// compiler-dom側の実装

import { transformOn as baseTransformOn } from 'compiler-core'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransformOn(dir, node, context, () => {
    /** ここに compiler-dom の独自の実装 */
    return {
      /** */
    }
  })
}
```

そして、この compiler-dom 側で実装した `transformOn` を compiler のオプションとして渡してあげれば OK です。  
以下のような関係図です。  
全ての transformer を compiler-dom から渡すのではなく、デフォルトの実装は compiler-core に実装しておき、オプションとしてあと乗せ出来るような構成にするイメージです。

![50-027-new-compiler-architecture](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/50-027-new-compiler-architecture.drawio.png)

これで compiler-core が DOM に依存せず、compiler-dom 側で DOM に依存した処理を実装しつつ compiler-core の transformer を実行できるようになります。

## transformer の実装

それでは、compiler-dom 側の transformer を実装していきます。

どういう風に transform していきましょうか。とりあえず、一概に '修飾子' といってもいろんな種類のものがあるので、  
今後のことも考えて分類わけできるようにしておきましょう。

今回実装するのは 'イベント修飾子' です。
とりあえず、この eventModifiers として取り出してみましょう。

```ts
const isEventModifier = makeMap(
  // event propagation management
  `stop,prevent,self`,
)

const resolveModifiers = (modifiers: string[]) => {
  const eventModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (isEventModifier(modifier)) {
      eventModifiers.push(modifier)
    }
  }

  return { eventModifiers }
}
```

eventModifiers を抽出できたところでこれをどう使いましょうか。
結論から言うと、これは runtime-dom 側に withModifiers というヘルパー関数を実装し、その関数を呼び出す式に transform していきます。

```ts
// runtime-dom/runtimeHelpers.ts

export const V_ON_WITH_MODIFIERS = Symbol()
```

```ts
export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const { eventModifiers } = resolveModifiers(modifiers)

    if (eventModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(eventModifiers),
      ])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
```

これで transform 側の実装は概ね終わりです。

あとはこの withModifiers を compiler-dom 側で実装していきます。

## withModifiers の実装

runtime-dom/directives/vOn.ts に実装を進めていきます。

実装はとてもシンプルです。

イベント修飾子のガード関数を実装して、配列で受け取った修飾子の分だけ実行するような実装をするだけです。

```ts
const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
}

export const withModifiers = (fn: Function, modifiers: string[]) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event)) return
    }
    return fn(event, ...args)
  }
}
```

これで実装はおしまいです。

動作を確認してみましょう！  
ボタンを押した際に、ページがリロードされずに input の内容が画面に反映されていれば OK です！

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier)

## その他の修飾子

さて、ここまできたら他の修飾子も実装してみましょう。

基本的な実装方針は同じです。

修飾子を以下のように分類してみましょう。

```ts
const keyModifiers = []
const nonKeyModifiers = []
const eventOptionModifiers = []
```

あとはこれに必要な map を生成して、resolveModifiers でこれらに分類できれば OK です。

残り気をつけるべき点は 2 点で、

- 修飾子名と実際の DOM API の名前の差異
- 特定のキーイベントで実行する helper 関数を新たに実装 (withKeys)

です。

この辺りは実際にコードを読みながら実装してみてください！  
ここまできた皆さんなら出来るはずです。

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier2)
