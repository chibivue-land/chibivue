# v-for ディレクティブに対応する

## 今回目指す開発者インターフェース

さて、ディレクティブ実装の続きです。今回は v-for に対応してみようと思います。

まぁ、Vue.js を触ったことあるみなさんならお馴染みのディレクティブだと思います。

v-for には様々な syntax があります。
最もベーシックなのは配列をループすることですが、他にも文字列であったりオブジェクトの key, range, などなど様々なものをループできます。

https://ja.vuejs.org/guide/essentials/list.html

少し長いですが、今回は以下のような開発者インターフェースを目指してみましょう。

```vue
<script>
import { createApp, defineComponent, ref } from 'chibivue'

const genId = () => Math.random().toString(36).slice(2)

const FRUITS_FACTORIES = [
  () => ({ id: genId(), name: 'apple', color: 'red' }),
  () => ({ id: genId(), name: 'banana', color: 'yellow' }),
  () => ({ id: genId(), name: 'grape', color: 'purple' }),
]

export default {
  setup() {
    const fruits = ref([...FRUITS_FACTORIES].map(f => f()))
    const addFruit = () => {
      fruits.value.push(
        FRUITS_FACTORIES[Math.floor(Math.random() * FRUITS_FACTORIES.length)](),
      )
    }
    return { fruits, addFruit }
  },
}
</script>

<template>
  <button @click="addFruit">add fruits!</button>

  <!-- basic -->
  <ul>
    <li v-for="fruit in fruits" :key="fruit.id">
      <span :style="{ backgroundColor: fruit.color }">{{ fruit.name }}</span>
    </li>
  </ul>

  <!-- indexed -->
  <ul>
    <li v-for="(fruit, i) in fruits" :key="fruit.id">
      <span :style="{ backgroundColor: fruit.color }">{{ fruit.name }}</span>
    </li>
  </ul>

  <!-- destructuring -->
  <ul>
    <li v-for="({ id, name, color }, i) in fruits" :key="id">
      <span :style="{ backgroundColor: color }">{{ name }}</span>
    </li>
  </ul>

  <!-- object -->
  <ul>
    <li v-for="(value, key, idx) in fruits[0]" :key="key">
      [{{ idx }}] {{ key }}: {{ value }}
    </li>
  </ul>

  <!-- range -->
  <ul>
    <li v-for="n in 10">{{ n }}</li>
  </ul>

  <!-- string -->
  <ul>
    <li v-for="c in 'hello'">{{ c }}</li>
  </ul>

  <!-- nested -->
  <ul>
    <li v-for="({ id, name, color }, i) in fruits" :key="id">
      <span :style="{ backgroundColor: color }">
        <span v-for="n in 3">{{ n }}</span>
        <span>{{ name }}</span>
      </span>
    </li>
  </ul>
</template>
```

急にこんなにいっぱい実装するのかよ！無理だろ！と身構えてしまうかもしれませんが、安心してください、ステップバイステップで説明していきます。

## 実装方針

まず、軽くどういうふうにコンパイルしたいのかということを考えてみて、実装する際に難しそうなポイントはどこなのかということについて考えてみましょう。

まず、目指したいコンパイル結果から見てみましょう。

基本的な構成はそれほど難しいものではありません。renderList というヘルパー関数を runtime-core の方に実装して、リストをレンダリングする式にコンパイルします。

例 1:

```html
<!-- input -->
<li v-for="fruit in fruits" :key="fruit.id">{{ fruit.name }}</li>
```

```ts
// output
h(
  _Fragment,
  null,
  _renderList(fruits, fruit => h('li', { key: fruit.id }, fruit.name)),
)
```

例 2:

```html
<!-- input -->
<li v-for="(fruit, idx) in fruits" :key="fruit.id">
  {{ idx }}: {{ fruit.name }}
</li>
```

```ts
// output
h(
  _Fragment,
  null,
  _renderList(fruits, fruit => h('li', { key: fruit.id }, fruit.name)),
)
```

例 3:

```html
<!-- input -->
<li v-for="{ name, id } in fruits" :key="id">{{ name }}</li>
```

```ts
// output
h(
  _Fragment,
  null,
  _renderList(fruits, ({ name, id }) => h('li', { key: id }, name)),
)
```

後々、renderList の第 1 引数として渡す値は配列以外にも数値やオブジェクトも想定していきますが、  
一旦、配列のみを想定すると、\_renderList 関数の実装自体は概ね Array.prototype.map と同じようなものだと理解できるかと思います。  
配列以外の値に関しては、\_renderList の方で正規化してあげればいいだけなので、初めのうちは忘れてしまいましょう。(配列のことだけ考えてれば OK)

そして、ここまで様々なディレクティブを実装してきたみなさんにとってはこのようなコンパイラ(transformer) を実装するのはさほど難しい事ではないとは思います。

## 実装の肝 (難しいポイント)

問題は、SFC で使用する場合です。  
SFC で使用する際のコンパイラと、ブラウザ上で使用する際のコンパイラの差異を覚えているでしょうか?  
そうです。`_ctx` を使った式の解決です。

v-for ではいろんな形でユーザー定義のローカル変数が登場するので、それらをうまく収集して rewriteIdentifiers をスキップしていく必要があります。

```ts
// ダメな例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits は _ctx からバインドされるものだので prefix がついていて OK
    ({ name, id }) =>
      h(
        'li',
        { key: _ctx.id }, // ここに _ctx がついてはダメ
        _ctx.name, // ここに _ctx がついてはダメ
      ),
  ),
)
```

```ts
// 良い例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits は _ctx からバインドされるものだので prefix がついていて OK
    ({ name, id }) =>
      h(
        'li',
        { key: id }, // ここに _ctx がついてはダメ
        name, // ここに _ctx がついてはダメ
      ),
  ),
)
```

ローカル変数の定義は様々で、例 1~3 までそれぞれあります。

それぞれの定義を解析し、スキップ対象の識別子を収集していく必要があります。

さて、これをどうやって実現していくかについてですが、それは一旦おいておいて、大枠から実装を始めてしまいましょう。

## AST の実装

とりあえず例の如く、AST を定義しておきます。

今回も v-if の時と同様、transform 後の AST を考えていきます。(パーサの実装は必要ない)

```ts
export const enum NodeTypes {
  // .
  // .
  FOR, // [!code ++]
  // .
  // .
  JS_FUNCTION_EXPRESSION, // [!code ++]
}

export type ParentNode =
  | RootNode
  | ElementNode
  | ForNode // [!code ++]
  | IfBranchNode

export interface ForNode extends Node {
  type: NodeTypes.FOR
  source: ExpressionNode
  valueAlias: ExpressionNode | undefined
  keyAlias: ExpressionNode | undefined
  children: TemplateChildNode[]
  parseResult: ForParseResult // 後述
  codegenNode?: ForCodegenNode
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST // 後述
  arguments: [ExpressionNode, ForIteratorExpression]
}

// renderList の第二引数でコールバック関数を使用するので、関数式にも対応します。
export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
}

// v-for の場合、 return は決まっているので、それ用のASTとして表現します。
export interface ForIteratorExpression extends FunctionExpression {
  returns: VNodeCall
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ConditionalExpression
  | ExpressionNode
  | FunctionExpression // [!code ++]
```

`RENDER_LIST` に関しては、例の如く runtimeHelpers に追加しておきます。

```ts
// runtimeHelpers.ts
// .
// .
// .
export const RENDER_LIST = Symbol() // [!code ++]

export const helperNameMap: Record<symbol, string> = {
  // .
  // .
  [RENDER_LIST]: `renderList`, // [!code ++]
  // .
  // .
}
```

`ForParseResult` についてですが、こちらの定義は transform/vFor にあります。

```ts
export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}
```

それぞれが何を指しているかというと、

`v-for="(fruit, i) in fruits"` のような場合に

- source: `fruits`
- value: `fruit`
- key: `i`
- index: `undefined`

のようになります。`index` は v-for にオブジェクトを適応した際に 3 つ目の引数として取られるものです。

https://ja.vuejs.org/guide/essentials/list.html#v-for-with-an-object

![v_for_ast.drawio.png](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/v_for_ast.drawio.png)

value に関しては、`{ id, name, color, }` のように分割代入を使用した場合は複数の Identifier を持つことになります。

これら、value, key, index で定義された Identifier を収集し、prefix の付与をスキップしていきます。

## codegen の実装

少し順番が前後してしまいますが、codegen の方は大した話がないので先に実装を済ませてしまいます。  
やることはたった二つ。`NodeTypes.FOR` のハンドリングと関数式の codegen です。(なんだかんだ関数式は初登場でした)

```ts
switch (node.type) {
  case NodeTypes.ELEMENT:
  case NodeTypes.FOR: // [!code ++]
  case NodeTypes.IF:
  // .
  // .
  // .
  case NodeTypes.JS_FUNCTION_EXPRESSION: // [!code ++]
    genFunctionExpression(node, context, option) // [!code ++]
    break // [!code ++]
  // .
  // .
  // .
}

function genFunctionExpression(
  node: FunctionExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { push, indent, deindent } = context
  const { params, returns, newline } = node

  push(`(`, node)
  if (isArray(params)) {
    genNodeList(params, context, option)
  } else if (params) {
    genNode(params, context, option)
  }
  push(`) => `)
  if (newline) {
    push(`{`)
    indent()
  }
  if (returns) {
    if (newline) {
      push(`return `)
    }
    if (isArray(returns)) {
      genNodeListAsArray(returns, context, option)
    } else {
      genNode(returns, context, option)
    }
  }
  if (newline) {
    deindent()
    push(`}`)
  }
}
```

特に難しいところはないかと思います。これでおしまいです。

## transformer の実装

### 下準備

transformer の実装をしていきますが、ここでもまたいくつか下準備です。

v-on の時にもやりましたが、v-for の場合には processExpression を実行するタイミングが少し特殊 (ローカル変数を収集しないといけない) なので、transformExpression の方ではスキップしてあげます。

```ts
export const transformExpression: NodeTransform = (node, ctx) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content as SimpleExpressionNode, ctx)
  } else if (node.type === NodeTypes.ELEMENT) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      if (
        dir.type === NodeTypes.DIRECTIVE &&
        dir.name !== 'for' // [!code ++]
      ) {
        // .
        // .
        // .
      }
    }
  }
}
```

### Identifier の収集

さて、ここからはメインの実装をしていくわけですが、先にどのように identifier を収集していくかを考えていきましょう。

今回は `fruit` のようなシンプルなものだけではなく、`{ id, name, color }` のような分割代入も考慮する必要があります。  
ついては、例の如く TreeWalker を使用する必要があるようです。

現在 processExpression では identifier を探索し、 `_ctx` を付与するような実装がされていますが、今回は付与せずに収集だけするような実装が必要そうです。これを実現していきます。

まず、収集したものを溜めておくための場所を用意します。これは各 Node が持っておいた方が codegen などの時に便利なので、その Node 上に存在する identifier (複数) を持っておけるようなプロパティを AST に追加してしまいましょう。

対象は `CompoundExpressionNode` と `SimpleExpressionNode` です。

`fruit` のようなシンプルなものは `SimpleExpressionNode` に、  
`{ id, name, color }` のような分割代入は `CompoundExpressionNode` になります。(イメージで言うと、`["{", simpleExpr("id"), ",", simpleExpr("name"), ",", simpleExpr("color"), "}"]` のような compound expr になる)

```ts
export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string
  isStatic: boolean
  identifiers?: string[] // [!code ++]
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
  )[]
  identifiers?: string[] // [!code ++]
}
```

processExpression の方で、ここに identifier を収集していくような実装をし、収集した identifier を transformer の context に追加することによって prefix の付与をスキップしていきます。

今、そこに identifier を追加/削除するための関数は、単一の識別子を string で受け取るような構成になってしまっているため、`{ identifier: string [] }` を想定した形に変更してあげます。

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  // .
  // .
  addIdentifiers(exp: ExpressionNode | string): void
  removeIdentifiers(exp: ExpressionNode | string): void
  // .
  // .
  // .
}

const context: TransformContext = {
  // .
  // .
  // .
  addIdentifiers(exp) {
    if (!isBrowser) {
      if (isString(exp)) {
        addId(exp)
      } else if (exp.identifiers) {
        exp.identifiers.forEach(addId)
      } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        addId(exp.content)
      }
    }
  },
  removeIdentifiers(exp) {
    if (!isBrowser) {
      if (isString(exp)) {
        removeId(exp)
      } else if (exp.identifiers) {
        exp.identifiers.forEach(removeId)
      } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        removeId(exp.content)
      }
    }
  },
  // .
  // .
  // .
}
```

それでは、processExpression の方で identifier を収集する実装をやっていきます。

processExpression の方で `asParams` というようなオプションを定義して、こちらが true になっている場合には prefix の付与をスキップして node.identifiers に identifier を収集するような実装をしていきます。

asParams と言うのは、renderList の第二引数のコールバック関数に定義された引数(ローカル変数) のことを想定しているものです。

```ts
export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
  asParams = false, // [!code ++]
) {
  // .
  if (isSimpleIdentifier(rawExp)) {
    const isScopeVarReference = ctx.identifiers[rawExp]
    if (
      !asParams && // [!code ++]
      !isScopeVarReference
    ) {
      node.content = rewriteIdentifier(rawExp)
    } // [!code ++]
    return node

    // .
  }
}
```

simpleIdentifier の場合はこれでおしまいです。問題はそれ以外です。

こちらは babelUtils に実装した `walkIdentifiers` を利用していきます。

関数の引数として定義されたローカル変数を想定するので、こちらの方でも 「関数の引数」のように変換し、walkIdentifier の方でも Function の param として探索するようにします。

```ts
// asParams の場合は、関数の引数のように変換する
const source = `(${rawExp})${asParams ? `=>{}` : ``}`
```

walkIdentifiers の方が多少複雑です。

```ts
export function walkIdentifiers(
  root: Node,
  onIdentifier: (node: Identifier) => void,
  knownIds: Record<string, number> = Object.create(null),
  parentStack: Node[] = [],
) {
  // .

  ;(walk as any)(root, {
    // prettier-ignore
    enter(node: Node, parent: Node | undefined) {
      parent && parentStack.push(parent);
      if (node.type === "Identifier") {
        const isLocal = !!knownIds[node.name];
        const isRefed = isReferencedIdentifier(node, parent!, parentStack);
        if (!isLocal && isRefed) {
          onIdentifier(node);
        }
        
      } else if (isFunctionType(node)) { // [!code ++]
        // 後述 (この関数の中で knownIds に identifier を収集している)
        walkFunctionParams(node, (id) => // [!code ++]
          markScopeIdentifier(node, id, knownIds)// [!code ++]
        ); // [!code ++]
      } // [!code ++]
    },
  })
}

export const isFunctionType = (node: Node): node is Function => {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}
```

やっていることとしては、 node が関数だった場合には、その引数を walk し、identifiers に identifier を収集しているだけです。

`walkIdentifiers` を呼び出す側では、`knownIds` を定義し、walkIdentifiers にこの `knownIds` を渡してあげ、収集させます。

`walkIdentifiers` で収集した後で、最後、CompoundExpression を生成するタイミングで `knownIds` を元に identifiers を生成します。

```ts
const knownIds: Record<string, number> = Object.create(ctx.identifiers)

walkIdentifiers(
  ast,
  node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  },
  knownIds, // 渡す
  parentStack,
)

// .
// .
// .

ret.identifiers = Object.keys(knownIds) //　knownIds を元に identifiers を生成
return ret
```

少しファイルが前後しますが、walkFunctionParams, markScopeIdentifier は何をやっているかというと、これは単純で、 param の walk と Node.name を knownIds に追加しているだけです。

```ts
export function walkFunctionParams(
  node: Function,
  onIdent: (id: Identifier) => void,
) {
  for (const p of node.params) {
    for (const id of extractIdentifiers(p)) {
      onIdent(id)
    }
  }
}

function markScopeIdentifier(
  node: Node & { scopeIds?: Set<string> },
  child: Identifier,
  knownIds: Record<string, number>,
) {
  const { name } = child
  if (node.scopeIds && node.scopeIds.has(name)) {
    return
  }
  if (name in knownIds) {
    knownIds[name]++
  } else {
    knownIds[name] = 1
  }
  ;(node.scopeIds || (node.scopeIds = new Set())).add(name)
}
```

これで identifier の収集ができるようになったはずです。 これを使って transformFor を実装し、v-for ディレクティブを完成させましょう！

### transformFor

さて、山は超えたのであとはいつも通り今あるものを使って transformer を実装していきます。
あと少し、頑張りましょう！

こちらも v-if と同様、構造に関与するものなので createStructuralDirectiveTransform で実装していきます。

おそらくこちらはコードベースで説明を書いて行った方がわかりやすいと思うので解説込みのコードを以下に記載しますが、ぜひこちらを見る前にソースコードを読んで自力で実装してみてください！

```ts
// こちらは v-if の時と同様、大枠の実装になります。
// しかるべきところで processFor を実行し、しかるべきところで codegenNode を生成します。
// processFor が一番複雑な実装になります。
export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    return processFor(node, dir, context, forNode => {
      // 想定通り、renderList を呼び出すコードを生成します。
      const renderExp = createCallExpression(context.helper(RENDER_LIST), [
        forNode.source,
      ]) as ForRenderListExpression

      // v-for のコンテナとなる Fragment の codegenNode を生成
      forNode.codegenNode = createVNodeCall(
        context,
        context.helper(FRAGMENT),
        undefined,
        renderExp,
      ) as ForCodegenNode

      // codegen の process (processFor 内で、parse, identifiers の収集後に実行されます)
      return () => {
        const { children } = forNode
        const childBlock = (children[0] as ElementNode).codegenNode as VNodeCall

        renderExp.arguments.push(
          createFunctionExpression(
            createForLoopParams(forNode.parseResult),
            childBlock,
            true /* force newline */,
          ) as ForIteratorExpression,
        )
      }
    })
  },
)

export function processFor(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (forNode: ForNode) => (() => void) | undefined,
) {
  // v-for の式を解析します。
  // parseResult の段階ですでに各 Node の identifiers は収集されています。
  const parseResult = parseForExpression(
    dir.exp as SimpleExpressionNode,
    context,
  )

  const { addIdentifiers, removeIdentifiers } = context

  const { source, value, key, index } = parseResult!

  const forNode: ForNode = {
    type: NodeTypes.FOR,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    parseResult: parseResult!,
    children: [node],
  }

  // Node を forNode に置き換える
  context.replaceNode(forNode)

  if (!context.isBrowser) {
    // 収集された identifiers を context に追加して、
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  // code を生成します。 (これにより、 ローカル変数の prefix の付与をスキップできる)
  const onExit = processCodegen && processCodegen(forNode)

  return () => {
    value && removeIdentifiers(value)
    key && removeIdentifiers(key)
    index && removeIdentifiers(index)

    if (onExit) onExit()
  }
}

// 正規表現を活用して v-for に与えられた式を解析します。
const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}

export function parseForExpression(
  input: SimpleExpressionNode,
  context: TransformContext,
): ForParseResult | undefined {
  const loc = input.loc
  const exp = input.content
  const inMatch = exp.match(forAliasRE)

  if (!inMatch) return

  const [, LHS, RHS] = inMatch
  const result: ForParseResult = {
    source: createAliasExpression(
      loc,
      RHS.trim(),
      exp.indexOf(RHS, LHS.length),
    ),
    value: undefined,
    key: undefined,
    index: undefined,
  }

  if (!context.isBrowser) {
    result.source = processExpression(
      result.source as SimpleExpressionNode,
      context,
    )
  }

  let valueContent = LHS.trim().replace(stripParensRE, '').trim()
  const iteratorMatch = valueContent.match(forIteratorRE)
  const trimmedOffset = LHS.indexOf(valueContent)

  if (iteratorMatch) {
    valueContent = valueContent.replace(forIteratorRE, '').trim()
    const keyContent = iteratorMatch[1].trim()
    let keyOffset: number | undefined
    if (keyContent) {
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length)
      result.key = createAliasExpression(loc, keyContent, keyOffset)
      if (!context.isBrowser) {
        // ブラウザモードでない場合、asParams を true にし、key の identifiers を収集します。
        result.key = processExpression(result.key, context, true)
      }
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()
      if (indexContent) {
        result.index = createAliasExpression(
          loc,
          indexContent,
          exp.indexOf(
            indexContent,
            result.key
              ? keyOffset! + keyContent.length
              : trimmedOffset + valueContent.length,
          ),
        )
        if (!context.isBrowser) {
          // ブラウザモードでない場合、asParams を true にし、index の identifiers を収集します。
          result.index = processExpression(result.index, context, true)
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    if (!context.isBrowser) {
      // ブラウザモードでない場合、asParams を true にし、value の identifiers を収集します。
      result.value = processExpression(result.value, context, true)
    }
  }

  return result
}

function createAliasExpression(
  range: SourceLocation,
  content: string,
  offset: number,
): SimpleExpressionNode {
  return createSimpleExpression(
    content,
    false,
    getInnerRange(range, offset, content.length),
  )
}

export function createForLoopParams(
  { value, key, index }: ForParseResult,
  memoArgs: ExpressionNode[] = [],
): ExpressionNode[] {
  return createParamsList([value, key, index, ...memoArgs])
}

function createParamsList(
  args: (ExpressionNode | undefined)[],
): ExpressionNode[] {
  let i = args.length
  while (i--) {
    if (args[i]) break
  }
  return args
    .slice(0, i + 1)
    .map((arg, i) => arg || createSimpleExpression(`_`.repeat(i + 1), false))
}
```

さて、残りは実際にコンパイル後のコードに含まれる renderList の実装であったり、transformer の登録を実装できれば v-for が動くようになるはずです！

実際に動かしてみましょう！

![v_for](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/v_for.png)

順調そうです。

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/050_v_for)
