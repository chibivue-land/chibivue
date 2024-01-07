# v-if と構造的ディレクティブ

さてここからはまたディレクティブの実装をやっていきましょう！

ついに v-if を実装していきます。

## v-if ディレクティブとこれまでのディレクティブの違い

これまでの v-bind や v-on などを実装してきました。

これから v-if を実装して行くのですが、v-if はこれらのディレクティブとは少し作りが違います。

以下は Vue.js の公式ドキュメントのコンパイル時最適化に関する項目の一説ですが、

> In this case, the entire template has a single block because it does not contain any structural directives like v-if and v-for.

https://vuejs.org/guide/extras/rendering-mechanism.html#tree-flattening

という言葉が見受けられます。(Tree Flattening が何かについては別で解説するので気にしなくていいです。)

この通り、v-if や v-if は `structural directives` と呼ばれるもので、構造を伴うディレクティブです。

angular のドキュメントだと項目として明記されていたりもします。

https://angular.jp/guide/structural-directives

v-if や v-for は単にその要素の属性(+イベントに対する振舞い)を変更するだけでなく、要素の存在を切り替えたり、リストの数に応じて 要素を生成・削除したりと、要素の構造を変更するディレクティブです。

## 目指す開発者インターフェース

v-if / v-else-if / v-else を組み合わせて FizzBuzz が実装できるようなものを考えてみましょう。

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const n = ref(1)
    const inc = () => {
      n.value++
    }

    return { n, inc }
  },

  template: `
    <button @click="inc">inc</button>
    <p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
    <p v-else-if="n % 5 === 0">Buzz</p>
    <p v-else-if="n % 3 === 0">Fizz</p>
    <p v-else>{{ n }}</p>
  `,
})

const app = createApp(App)

app.mount('#app')
```

今回はまず初めに、どういうコードを生成したいかについても考えてみようかと思います。

結論から言ってしまうと、v-if や v-else は以下のように条件式に変換されます。

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

これをみても分かる通り、これまで実装してきたものに条件を表す構造を持たせています。

このようなコードを生成するための AST に変形させる transformer を実装するには一工夫必要そうです。

::: warning

現時点での実装では空白などの読み飛ばしの実装を行っていないので実際には間に余計な文字 Node が入ってしまうかと思います。

が、 v-if の実装上は特に問題ありませんので(後でわかります)、今回は無視してください。

:::

## 構造的ディレクティブの実装

### 構造にまつわるメソッドを実装する

v-if の実装を行っていく前に、少し準備です。

最初にも v-if や v-for という構造的ディレクティブは AST Node の構造を変更するディレクティブであるということを説明しました。

これらを実現するために、ベースとなる transformer にいくつかの実装を行います。

具体的には、TransformContext に以下の３つを実装します。

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  // .
  // .
  replaceNode(node: TemplateChildNode): void // 追加
  removeNode(node?: TemplateChildNode): void // 追加
  onNodeRemoved(): void // 追加
}
```

traverseChildren の方で現在の parent と children の index は保持するようになっていると思うので、それらを使って 上記のメソッドを実装していきます。

<!-- NOTE: このチャプターまで実装しなくてもいいかもしれない -->

::: details 念の為

この部分です。

実装していると思いますが、これを実装したチャプターではあまり詳しく説明していなかったので念の為補足です。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent // これ
    context.childIndex = i // これ
    traverseNode(child, context)
  }
}
```

:::

```ts
export function createTransformContext(
  root: RootNode,
  { nodeTransforms = [], directiveTransforms = {} }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    // .
    // .
    // .

    // Node を受け取って currentNode と 該当の parent の children をその Node に置き換えます
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    },

    // Node を受け取って currentNode と 該当の parent の children からその Node を削除します
    removeNode(node) {
      const list = context.parent!.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (!node || node === context.currentNode) {
        // current node removed
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // sibling node removed
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent!.children.splice(removalIndex, 1)
    },

    // こちらは replaceNode 等を実際に使用する際に登録するようにします
    onNodeRemoved: () => {},
  }

  return context
}
```

既存の実装も少し修正が必要です。transform 中に removeNode が呼ばれることを想定して、traverseChildren の方を調整してあげます。

Node が削除されると index が変わってしまうので、Node が 削除された際に for の index を減らしてあげます。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  let i = 0 // これ
  const nodeRemoved = () => {
    i-- // これ
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved // これ
    traverseNode(child, context)
  }
}
```

### createStructuralDirectiveTransform の実装

v-if や v-for といったディレクティブを実装するにあたって、createStructuralDirectiveTransform というヘルパー関数を実装します。

これらの transformer は NodeTypes.ELEMENT のみに作用し、その Node が持つ DirectiveNode に対して 各 transformer の実装を適用します。

まぁ、実装自体は大きなものではないので、実際に見てもらった方がわかりやすいと思います。以下のような感じです。

```ts
// 各 transformer (v-if/v-for など) はこの interface にそって実装されます。
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void)

export function createStructuralDirectiveTransform(
  // name は正規表現にも対応しています。
  // v-if の transformer でいうと、 `/^(if|else|else-if)$/` のようなものを受け取れる想定です。
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      // NodeTypes.ELEMENT のみに作用
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // NodeTypes.DIRECTIVE かつ name が一致するものに対して transformer を実行
          props.splice(i, 1)
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
```

## v-if を実装していく

### AST の実装

上記までで準備は終わりです。ここからは v-if の実装を行っていきます。

いつものように、AST の定義から行なって、パーサーを実装していきましょう。

と言いたいところでしたが、今回はパーサーは必要なさそうです。

どちらかというと、今回は transform 後の AST をどういう形にしたいかを考えて、それに変形させるための transformer を実装していく感じになります。

改めて、冒頭で想定していたコンパイル後のコードを見てみましょう。

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

最終的には条件式(三項演算子)に変換されていることが分かります。

これまで条件式を扱ったことはないので、Codegen のために AST 側でこれを取り扱う必要があるようです。  
基本的に考えたいものは 3 つの情報です。("三項"演算子なのでね)

- **条件**  
  A ? B : C の A にあたる部分です。  
  condition という名前で表現されます。
- **条件にマッチした時の Node**  
  A ? B : C の B にあたる部分です。  
  consequent という名前で表現されます。
- **条件にマッチしなかった時の Node**  
  A ? B : C の C にあたる部分です。  
  alternate という名前で表現されます。

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  JS_CONDITIONAL_EXPRESSION,
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION
  test: JSChildNode
  consequent: JSChildNode
  alternate: JSChildNode
  newline: boolean // これは codegen のフォーマット用なのであまり気にしなくていいです
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ConditionalExpression // 追加
  | ExpressionNode

export function createConditionalExpression(
  test: ConditionalExpression['test'],
  consequent: ConditionalExpression['consequent'],
  alternate: ConditionalExpression['alternate'],
  newline = true,
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  }
}
```

これらを使って VIf の Node を表現する AST を実装していきます。

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  IF,
  IF_BRANCH,
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode?: IfConditionalExpression
}

export interface IfConditionalExpression extends ConditionalExpression {
  consequent: VNodeCall
  alternate: VNodeCall | IfConditionalExpression
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
}

export type ParentNode =
  | RootNode
  | ElementNode
  // 追加
  | IfBranchNode
```

### transformer の実装

AST ができたので、実際にこの AST を生成する transformer を実装していきます。

イメージ的にはいくつかの `ElementNode` をもとに `IfNode` を生成するという感じです。

「いくつかの」といったのは、今回の場合、ある一つの Node を違う一つの Node に変形するようなものではなく、

```html
<p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
<p v-else-if="n % 5 === 0">Buzz</p>
<p v-else-if="n % 3 === 0">Fizz</p>
<p v-else>{{ n }}</p>
```

のような複数の ElementNode があった場合には v-if ~ v-else までを一つの IfNode として生成する必要があります。

最初の v-if にマッチした場合、後続の Node が v-else-if や v-else に当たるものでないかどうかを判定しながら IfNode を生成していきます。

具体的な それぞれの処理は processIf という関数に逃しておくとして、とりあえず大枠を実装してみましょう。
先ほどの `createStructuralDirectiveTransform` を活用します。

具体的には、最終的に codegenNode に先ほど実装した AST を詰めていきたいわけなので、
この transformer の `onExit` で Node を生成します。

```ts
export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            context,
          ) as IfConditionalExpression
        } else {
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            context,
          )
        }
      }
    })
  },
)

export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // TODO:
}
```

```ts
/// codegenNode を生成するのに使用した関数たち

// branch の codegenNode 生成
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      // alternate はとりあえずコメントアウトで生成するようになっています。
      // v-else-if や v-if が来た時に alternate を対象の Node に書き換えます。
      // `parentCondition.alternate = createCodegenNodeForBranch(branch, context);` の部分です
      // もし、v-else-if や v-else がこなかった場合には、このまま CREATE_COMMENT の Node になります。
      createCallExpression(context.helper(CREATE_COMMENT), ['""', 'true']),
    ) as IfConditionalExpression
  } else {
    return createChildrenCodegenNode(branch, context)
  }
}

function createChildrenCodegenNode(
  branch: IfBranchNode,
  context: TransformContext,
): VNodeCall {
  // branch から vnode call を取り出すだけ
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  // node から辿って 末端の Node を取得する
  while (true) {
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        node = node.alternate
      } else {
        return node
      }
    }
  }
}
```

`processIf` ではより具体的な AST Node の変形処理を行なっていきます。

if / else-if / else の場合がありますが、まずは `if` だった場合を考えてみます。

こちらはかなり単純です。 IfNode を生成し、codegenNode の生成を実行してあげるだけです。
この際、今の Node を IfBranch としてを生成し、それを IfNode に持たせた上で IfNode に replace しておきます。

```
- parent
  - currentNode

↓

- parent
  - IfNode
    - IfBranch (currentNode)
```

のように構造を変更するイメージです。

```ts
export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // あらかじめ、exp には processExpression を実行しておきます。
  if (!context.isBrowser && dir.exp) {
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode: IfNode = {
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch],
    }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    // TODO:
  }
}

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: [node],
  }
}
```

次は v-if 以外の場合を考えてみましょう。

context から parent の children を辿って siblings を取得し、  
現在の node (自身) から順にループを回し、自身をもとに IfBranch を生成して branches に push していきます。  
この際、コメントや空のテキストは削除してしまいます。

```ts
if (dir.name === 'if') {
  /** 省略 */
} else {
  const siblings = context.parent!.children
  let i = siblings.indexOf(node)
  while (i-- >= -1) {
    const sibling = siblings[i]
    if (sibling && sibling.type === NodeTypes.COMMENT) {
      context.removeNode(sibling)
      continue
    }

    if (
      sibling &&
      sibling.type === NodeTypes.TEXT &&
      !sibling.content.trim().length
    ) {
      context.removeNode(sibling)
      continue
    }

    if (sibling && sibling.type === NodeTypes.IF) {
      context.removeNode()
      const branch = createIfBranch(node, dir)
      sibling.branches.push(branch)
      const onExit = processCodegen && processCodegen(sibling, branch, false)
      traverseNode(branch, context)
      if (onExit) onExit()
      context.currentNode = null
    }
    break
  }
}
```

これをみても分かる通り、実は else-if と else は区別していません。

AST 上でも condition がない場合は else というふうな定義にしているので、特に考えることはないのです。  
(`createIfBranch` の `dir.name === "else" ? undefined : dir.exp` の部分で吸収)

重要なのは、`if` であった場合に `IfNode` を生成しておくということで、それ以外はその Node の branches に突っ込んでいけばいいわけです。

ここまで来れば transformIf の実装は終わりです。あとは周辺に少しだけ手を加えます。

traverseNode で、IfNode が持つ branches に対して traverseNode を実行してあげるようにします。

IfBranch も traverseChildren の対象にしてあげます。

```ts
export function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) {
  // .
  // .
  // .
  switch (node.type) {
    // .
    // .
    // 追加
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break

    case NodeTypes.IF_BRANCH: // 追加
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }
}
```

あとは、compiler のオプションとして transformIf を登録してあげるだけです。

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformElement],
    { bind: transformBind, on: transformOn },
  ]
}
```

これで transformer が実装できました！

あとは codegen を実装すれば、v-if の完成です。もう少しです、頑張りましょう！

### codegen の実装

あとは楽ちんです。ConditionalExpression の Node をもとにコードを生成すれば OK です。

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF: // ここを追加するのを忘れずに！
      genNode(node.codegenNode!, context, option)
      break
    // .
    // .
    // .
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context, option)
      break
    /* istanbul ignore next */
    case NodeTypes.IF_BRANCH:
      // noop
      break
  }
}

function genConditionalExpression(
  node: ConditionalExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { test, consequent, alternate, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context)
  } else {
    push(`(`)
    genNode(test, context, option)
    push(`)`)
  }
  needNewline && indent()
  context.indentLevel++
  needNewline || push(` `)
  push(`? `)
  genNode(consequent, context, option)
  context.indentLevel--
  needNewline && newline()
  needNewline || push(` `)
  push(`: `)
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  if (!isNested) {
    context.indentLevel++
  }
  genNode(alternate, context, option)
  if (!isNested) {
    context.indentLevel--
  }
  needNewline && deindent(true /* without newline */)
}
```

いつも通り、AST をもとに条件式を生成しているだけなので特に難しいことはないと思います。

## 完成！！

さてさて、久しぶりに少しファットなチャプターになってしまいましたがこれで v-if の実装は完了です！ (お疲れ様でした。)

実際に動かしてみましょう！！！！

ちゃんと動いています！

![vif_fizzbuzz](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/vif_fizzbuzz.png)

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/040_v_if_and_structural_directive)
