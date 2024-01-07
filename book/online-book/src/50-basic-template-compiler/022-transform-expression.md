# transformExpression

## 目指す開発者インターフェースと現状の課題

まずはこちらのコンポーネントを見てください。

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}
</script>

<template>
  <div>
    <button :onClick="increment">count + count is: {{ count + count }}</button>
  </div>
</template>
```

このコンポーネントにはいくつかの問題があります。  
このコンポーネントは SFC で記述されているため、with 文が使用されません。
つまり、バインディングがうまくいっていません。

コンパイルされたコードを見てみましょう。

```js
const _sfc_main = {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}

function render(_ctx) {
  const { h, mergeProps, normalizeProps, normalizeClass, normalizeStyle } =
    ChibiVue

  return h('div', null, [
    '\n    ',
    h('button', normalizeProps({ onClick: increment }), [
      'count + count is: ',
      _ctx.count + count,
    ]),
    '\n  ',
  ])
}

export default { ..._sfc_main, render }
```

- 上手くいっていないポイント 1  
  イベントハンドラに登録される increment が \_ctx を辿れていません。  
  これは当たり前で、前回の v-bind の実装では prefix の付与を行なっていないためです。
- 上手くいっていないポイント 2  
  count + count が \_ctx を辿れていません。  
  マスタッシュに関しては、先頭に `_ctx.` を付与しているだけで、それ以外の識別子に対応できていません。  
  このように、式の途中で登場する識別子は全て `_ctx.` を付与する必要があります。これはマスタッシュに限らず全ての箇所で同様です。

式中に登場する識別子に対して `_ctx.` を付与して行くような処理が必要なようです。

::: details 以下のようにコンパイルしたい

```js
const _sfc_main = {
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }
    return { count, increment }
  },
}

function render(_ctx) {
  const { h, mergeProps, normalizeProps, normalizeClass, normalizeStyle } =
    ChibiVue

  return h('div', null, [
    '\n    ',
    h('button', normalizeProps({ onClick: _ctx.increment }), [
      'count + count is: ',
      _ctx.count + _ctx.count,
    ]),
    '\n  ',
  ])
}

export default { ..._sfc_main, render }
```

:::

::: warning

実は、本家の実装では少しだけアプローチが違います。

以下をみてもらえれば分かる通り、本家では setup 関数からバインディングされるものは `$setup` を介して解決されます。

![resolve_bindings_original](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/resolve_bindings_original.png)

しかしこの実装をするのは少々大変なので、簡略化として `_ctx.` を付与するように実装します。(props も setup も全て \_ctx から解決する)

:::

## 実装方針

やりたいことを一言で言うなら、「ExpressionNode 上のあらゆる Identifier(の name の先頭)に対して`_ctx.`を付与したい」です。

少し噛み砕いて説明します。  
おさらいになりますが、プログラムというのはパースされることによって AST として表現されます。  
そして、プログラムを表す AST の Node には大きく分けて Expression と Statement の 2 種類がありました。
いわゆる式と文です。

```ts
1 // これは Expression
ident // これは Expression
func() // これは Expression
ident + func() // これは Expression

let a // これは Statement
if (!a) a = 1 // これは Statement
for (let i = 0; i < 10; i++) a++ // これは Statement
```

今回考えたいのは Expression (式)です。  
Expression にはさまざまな種類があります。Identifier というのはそのうちの一つで、識別子で表現された Expression です。  
(概ね変数名だと思ってもらえれば問題ないです)

ExpressionNode 上のあらゆる Identifier というのは、

```ts
1 // なし
ident // ident --- (1)
func() // func --- (2)
ident + func() // ident, func --- (3)
```

のようなもので、(1) に関してはそれ単体が Identifier であり、(2) は CallExpression の callee が Identifier、  
(3) は BinaryExpression の left が Identifier、right が CallExpression でその callee が Identifier になっています。

このように、Identifier は式中のいろんなところで登場します。

AST は以下のサイトでプログラムを入力すれば容易に観察できるので、ぜひさまざまな Expression 上の Identifier を観測してみてください。  
https://astexplorer.net/#/gist/670a1bee71dbd50bec4e6cc176614ef8/9a9ff250b18ccd9000ed253b0b6970696607b774

## Identifier を探索する

やりたいことは分かったとして、どうやって実装していきましょうか。

とても難しそうな感じがしますが、実は単純で、estree-walker というライブラリを使います。  
https://github.com/Rich-Harris/estree-walker

babel で parse することによって得られた AST をこのライブラリを使って tree walk します。  
使い方は非常に簡単で、walk 関数に AST を渡してあげて、第二引数に各 Node の処理を記述してあげれば良いです。  
この walk 関数は AST Node 単位で walk していくのですが、その Node に到達した時点の処理で処理を行うのが enter というオプションです。  
他にも、その Node の去り際に処理をするための leave なども用意されています。今回はこの enter のみを扱います。

`compiler-core/babelUtils.ts`を新たに作成して Identifier に対して操作を行えるような utility 関数を実装します。

とりあえず estree-walker はインストールします。

```sh
ni estree-walker

ni -D @babel/types # これも
```

```ts
import { Identifier, Node } from '@babel/types'

import { walk } from 'estree-walker'

export function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier) => void,
) {
  ;(walk as any)(root, {
    enter(node: Node) {
      if (node.type === 'Identifier') {
        onIdentifier(node)
      }
    },
  })
}
```

あとは式の AST を生成し、この関数に渡して node を書き換えながら transform を行なっていけばいいです。

## transformExpression の実装

### AST の変更とパーサ

変換処理の本体である transformExpression を実装していきます。

とりあえず、InterpolationNode は content として string ではなく SimpleExpressionNode を持つように変更します。

```ts
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: string // [!code --]
  content: ExpressionNode // [!code ++]
}
```

それに伴って parseInterpolation も修正です。

```ts
function parseInterpolation(
  context: ParserContext,
): InterpolationNode | undefined {
  // .
  // .
  // .
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
      loc: getSelection(context, innerStart, innerEnd),
    },
    loc: getSelection(context, start),
  }
}
```

### transformer (本体)の実装

式の変換に関しては他の transformer でも使えるようにしたいので、`processExpression` という関数として切り出します。  
transformExpression では、INTERPOLATION と DIRECTIVE が持つ ExpressionNode を処理します。

```ts
export const transformExpression: NodeTransform = node => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content as SimpleExpressionNode)
  } else if (node.type === NodeTypes.ELEMENT) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      if (dir.type === NodeTypes.DIRECTIVE) {
        const exp = dir.exp
        const arg = dir.arg
        if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
          dir.exp = processExpression(exp)
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          dir.arg = processExpression(arg)
        }
      }
    }
  }
}

export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // TODO:
}
```

続いて processExpression の実装の説明です。  
まず、processExpression の内部に Identifier を書き換えるための rewriteIdentifier という関数を実装します。  
node が単体の Identifier だった場合はそのままこの関数を適用しておしまいです。

一点注意があるのは、この processExpression は SFC の場合 (with 文を使わない場合)限定の話です。  
つまりは isBrowser フラグが立っている場合にはそのまま node を返すように実装しておきます。  
フラグは ctx 経由で受け取れるように実装を変更します。

また、true や false などのリテラルはそのままにしておきたいので、リテラルのホワイトリストを作成しておきます。

```ts
const isLiteralWhitelisted = makeMap('true,false,null,this')

export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
): ExpressionNode {
  if (ctx.isBrowser) {
    // ブラウザの場合には何もしない
    return node
  }

  const rawExp = node.content

  const rewriteIdentifier = (raw: string) => {
    return `_ctx.${raw}`
  }

  if (isSimpleIdentifier(rawExp)) {
    const isLiteral = isLiteralWhitelisted(rawExp)
    if (!isLiteral) {
      node.content = rewriteIdentifier(rawExp)
    }
    return node
  }

  // TODO:
}
```

makeMap とは vuejs/core で実装されている存在チェック用のヘルパー関数で、カンマ区切りで定義した文字列に一致しているかどうかを boolean で返してくれます。

```ts
export function makeMap(
  str: string,
  expectsLowerCase?: boolean,
): (key: string) => boolean {
  const map: Record<string, boolean> = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
```

問題はこの次で、SimpleExpressionNode (単純な Identifier ではない) をどのようにして node を transform していくかです。  
これからの話で少し注意して欲しい点が、Babel のパーサによって生成された JavaScript の AST と、我々が定義した chibivue の AST の２つを扱うことになるので、  
混乱を避けるために前者のことを estree、後者のことを AST とこのチャプターでは呼ぶことにします。

方針としては 2 段階に分けます。

1. estree の node を置換しつつ、その node を収集していく
2. 収集された node をもとに AST を構築する

まずは 1 からやっていきます。  
こちらは簡単で、元の SimpleExpressionNode の内容(文字列)を Babel で parse し、  
estree を得ることができればあとはそれを先ほど作ったユーティリティ関数に通して rewriteIdentifier を噛ませます。  
この際に、ids という配列に収集していきます。

```ts
import { parse } from '@babel/parser'
import { Identifier } from '@babel/types'
import { walkIdentifiers } from '../babelUtils'

interface PrefixMeta {
  start: number
  end: number
}

export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // .
  // .
  // .
  const ast = parse(`(${rawExp})`).program // ※ この ast は estree のことです。
  type QualifiedId = Identifier & PrefixMeta
  const ids: QualifiedId[] = []

  walkIdentifiers(ast, node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  })

  // TODO:
}
```

注意するべき点としては、ここまでではまだ estree を操作しただけで、ast の node は何も操作されていないという点です。

### CompoundExpression

続いて 2 です。ここで新しい AST Node を定義します。`CompoundExpressionNode`というものです。  
Compound には「配合」「複合」といった意味が含まれます。  
この Node は children をもち、これらは少し特殊な値をとります。  
まずは AST の定義をご覧ください。

```ts
export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
  )[]
}
```

children は上記のような配列をとります。  
この Node の children が何を表しているのかは具体例を見た方がわかりやすいと思うので、具体例を挙げます。

以下のような式が以下のような CompoundExpressionNode に解析されます。

```ts
count * 2
```

```json
{
  "type": 7,
  "children": [
    {
      "type": 4,
      "isStatic": false,
      "content": "_ctx.count"
    },
    " * 2"
  ]
}
```

結構ヘンテコな感じです。children が string の型をとっているのはこのような形になるためです。  
CompoundExpression では Vue のコンパイラが必要な粒度で分割し、部分的に文字列で表現したり、部分的に Node で表現したりするものです。  
具体的には今回のように Expression に存在する Identifier を書き換えたりする場合に Identifier の部分だけを  
別の SimpleExpressionNode として分割したりする感じです。

つまり、これからやることは、収集した estree の Identifier Node と source などをもとにこの CompoundExpression を生成することです。  
以下のコードがその実装になります。

```ts
export function processExpression(node: SimpleExpressionNode): ExpressionNode {
  // .
  // .
  // .
  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    const start = id.start - 1
    const end = id.end - 1
    const last = ids[i - 1]
    const leadingText = rawExp.slice(last ? last.end - 1 : 0, start)
    if (leadingText.length) {
      children.push(leadingText)
    }

    const source = rawExp.slice(start, end)
    children.push(
      createSimpleExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, start),
        end: advancePositionWithClone(node.loc.start, source, end),
      }),
    )
    if (i === ids.length - 1 && end < rawExp.length) {
      children.push(rawExp.slice(end))
    }
  })

  let ret
  if (children.length) {
    ret = createCompoundExpression(children, node.loc)
  } else {
    ret = node
  }

  return ret
}
```

Babel によってパースされた Node は start と end (もと文字列のどこに当たるかのロケーション情報)を持っているのでそれをもとに rawExp から該当箇所を抜き出し、頑張って分割します。  
詳しくはソースコードをじっくり眺めてみてください。ここまでの方針が理解できれば読めるはずです。 (advancePositionWithClone などの実装も新規で行なっているのでその辺りも見てみてください。)

CompoundExpressionNode を生成することができるようになったので、Codegen の方でも対応します。

```ts
function genInterpolation(
  node: InterpolationNode,
  context: CodegenContext,
  option: Required<CompilerOptions>,
) {
  genNode(node.content, context, option)
}

function genCompoundExpression(
  node: CompoundExpressionNode,
  context: CodegenContext,
  option: Required<CompilerOptions>,
) {
  for (let i = 0; i < node.children!.length; i++) {
    const child = node.children![i]
    if (isString(child)) {
      // string の場合にはそのまま push
      context.push(child)
    } else {
      // それ以外は Node を codegen する
      genNode(child, context, option)
    }
  }
}
```

(genInterpolation がただの genNode になってしまいましたがまぁ、一応残しておきます。)

## 動かしてみる

さて、ここまで実装できたらコンパイラを完成させて動かしてみましょう！

```ts
// transformExpressionを追加する
export function getBaseTransformPreset(): TransformPreset {
  return [[transformElement], { bind: transformBind }] // [!code --]
  return [[transformExpression, transformElement], { bind: transformBind }] // [!code ++]
}
```

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const count = ref(3)
    const getMsg = (count: number) => `Count: ${count}`
    return { count, getMsg }
  },

  template: `
    <div class="container">
      <p> {{ 'Message is "' + getMsg(count) + '"'}} </p>
    </div>
  `,
})

const app = createApp(App)

app.mount('#app')
```

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/022_transform_expression)
