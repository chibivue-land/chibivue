# 支援 v-for 指令

## 目標開發者介面

現在，讓我們繼續指令的實現。這次，讓我們嘗試支援 v-for。

嗯，我想對於那些之前使用過 Vue.js 的人來說，這是一個熟悉的指令。

v-for 有各種語法。
最基本的是循環遍歷陣列，但你也可以循環遍歷其他東西，如字串、物件鍵、範圍等等。

https://vuejs.org/v2/guide/list.html

雖然有點長，但這次，讓我們以以下開發者介面為目標：

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

你可能會想，"我們突然要實現這麼多東西？這不可能！"但不要擔心，我會一步一步地解釋。

## 實現方法

首先，讓我們大致思考一下我們想要如何編譯它，並考慮在實現時可能遇到的困難點。

首先，讓我們看看期望的編譯結果。

基本結構並不那麼困難。我們將在 runtime-core 中實現一個名為 renderList 的輔助函式來渲染列表，並將其編譯為表達式。

示例 1：

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

示例 2：

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

示例 3：

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

將來，作為 renderList 第一個參數傳遞的值預期不僅是陣列，還可能是數字和物件。但是，現在讓我們假設只期望陣列。\_renderList 函式本身的實現可以理解為類似於 Array.prototype.map 的東西。至於除陣列之外的值，你只需要在 \_renderList 中對它們進行規範化，所以現在讓我們忘記它們（只關注陣列）。

現在，對於那些到目前為止已經實現了各種指令的人來說，實現這種編譯器（轉換器）應該不會太困難。

## 關鍵實現點（困難點）

困難點在於在 SFC（單檔案組件）中使用它時。你還記得在 SFC 中使用的編譯器和在瀏覽器中使用的編譯器之間的區別嗎？是的，就是使用 `_ctx` 解析表達式。

在 v-for 中，使用者定義的局部變數以各種形式出現，所以你需要正確地收集它們並跳過 rewriteIdentifiers。

```ts
// 錯誤示例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits 有前綴是可以的，因為它是從 _ctx 綁定的
    ({ name, id }) =>
      h(
        'li',
        { key: _ctx.id }, // 這裡有 _ctx 是不對的
        _ctx.name, // 這裡有 _ctx 是不對的
      ),
  ),
)
```

```ts
// 正確示例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits 有前綴是可以的，因為它是從 _ctx 綁定的
    ({ name, id }) =>
      h(
        'li',
        { key: id }, // 這裡不應該有 _ctx
        name, // 這裡不應該有 _ctx
      ),
  ),
)
```

從示例 1 到 3，有各種局部變數的定義。

你需要分析每個定義並收集要跳過的識別符。

現在，讓我們暫時擱置如何實現這一點，從大局開始實現。

## AST 的實現

現在，讓我們像往常一樣定義 AST。

與 v-if 一樣，我們將考慮轉換後的 AST（無需實現解析器）。

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
  parseResult: ForParseResult // 稍後解釋
  codegenNode?: ForCodegenNode
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST // 稍後解釋
  arguments: [ExpressionNode, ForIteratorExpression]
}

// 還支援函式表達式，因為回呼函式用作 renderList 的第二個參數。
export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
}

// 在 v-for 的情況下，返回是固定的，所以它被表示為專門用於此目的的 AST。
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

關於 `RENDER_LIST`，像往常一樣，將其添加到 `runtimeHelpers`。

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

至於 `ForParseResult`，其定義在 `transform/vFor` 中。

```ts
export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}
```

為了解釋它們各自指的是什麼，

在 `v-for="(fruit, i) in fruits"` 的情況下，

- source: `fruits`
- value: `fruit`
- key: `i`
- index: `undefined`

`index` 是將物件應用於 `v-for` 時的第三個參數。

https://vuejs.org/v2/guide/list.html#v-for-with-an-object

![v_for_ast.drawio.png](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/v_for_ast.drawio.png)

關於 `value`，如果你使用像 `{ id, name, color, }` 這樣的解構賦值，它將有多個識別符。

我們收集由 `value`、`key` 和 `index` 定義的識別符，並跳過添加前綴。

## codegen 的實現

雖然順序有點顛倒，但讓我們先實現 codegen，因為沒有太多要討論的。
只需要做兩件事：處理 `NodeTypes.FOR` 和函式表達式的 codegen（這是第一次出現）。

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

沒有什麼特別困難的。就這樣結束了。

## 轉換器的實現

### 準備工作

在實現轉換器之前，還有一些準備工作。

正如我們在 `v-on` 中所做的，在 `v-for` 的情況下，執行 `processExpression` 的時機有點特殊（我們需要收集局部變數），所以我們在 `transformExpression` 中跳過它。

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

### 收集識別符

現在，在我們繼續主要實現之前，讓我們思考如何收集識別符。

這次，我們需要考慮不僅是像 `fruit` 這樣的簡單識別符，還有像 `{ id, name, color }` 這樣的解構賦值。
為此，似乎我們需要像往常一樣使用 TreeWalker。

目前，在 `processExpression` 函式中，實現是搜尋識別符並向它們添加 `_ctx`。但是，這次我們只需要收集識別符而不添加任何東西。讓我們實現這一點。

首先，讓我們準備一個地方來存儲收集的識別符。由於如果每個 Node 都有它們對於 codegen 和其他目的會很方便，讓我們向 AST 添加一個可以在每個 Node 上保存多個識別符的屬性。

目標是 `CompoundExpressionNode` 和 `SimpleExpressionNode`。

像 `fruit` 這樣的簡單識別符將被添加到 `SimpleExpressionNode`，
像 `{ id, name, color }` 這樣的解構賦值將被添加到 `CompoundExpressionNode`。（在視覺化方面，它將是一個複合表達式，如 `["{", simpleExpr("id"), ",", simpleExpr("name"), ",", simpleExpr("color"), "}"]`）

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

在 `processExpression` 函式中，讓我們在這裡實現收集識別符的邏輯，並透過將收集的識別符添加到轉換器的上下文中來跳過添加前綴。

目前，用於添加/刪除識別符的函式被配置為接收單個識別符作為字串，所以讓我們將其更改為假設 `{ identifier: string[] }` 的形式。

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

現在，讓我們在 `processExpression` 函式中實現收集識別符的邏輯。

在 `processExpression` 函式中，定義一個名為 `asParams` 的選項，如果設置為 true，實現跳過添加前綴並在 `node.identifiers` 中收集識別符的邏輯。

`asParams` 旨在引用在 `renderList` 的回呼函式中定義的參數（局部變數）。

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

這就是簡單識別符的結束。問題在於其他情況。

為此，我們將使用在 `babelUtils` 中實現的 `walkIdentifiers`。

由於我們假設定義為函式參數的局部變數，我們將在此函式中將它們轉換為"函式參數"，並在 `walkIdentifier` 中將它們作為 Function params 搜尋。

```ts
// 將 asParams 轉換為類似函式參數的形式
const source = `(${rawExp})${asParams ? `=>{}` : ``}`

// walkIdentifiers 稍微複雜一些。
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

      } else if (isFunctionType(node)) {
        // 稍後解釋（在此函式內的 knownIds 中收集識別符）
        walkFunctionParams(node, (id) =>
          markScopeIdentifier(node, id, knownIds)
        );
      }
    },
  })
}

export const isFunctionType = (node: Node): node is Function => {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}
```

我們在這裡做的只是如果 node 是函式則遍歷參數，並將識別符收集到 `identifiers` 中。

在 `walkIdentifiers` 的呼叫者中，我們定義 `knownIds` 並將其與 `knownIds` 一起傳遞給 `walkIdentifiers` 以收集識別符。

在 `walkIdentifiers` 中收集後，最後，在生成 CompoundExpression 時基於 `knownIds` 生成識別符。

```ts
const knownIds: Record<string, number> = Object.create(ctx.identifiers)

walkIdentifiers(
  ast,
  node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  },
  knownIds, // 傳遞
  parentStack,
)

// .
// .
// .

ret.identifiers = Object.keys(knownIds) // 基於 knownIds 生成識別符
return ret
```

雖然檔案有點亂序，但 `walkFunctionParams` 和 `markScopeIdentifier` 只是遍歷參數並將 `Node.name` 添加到 `knownIds`。

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

有了這個，我們應該能夠收集識別符。讓我們使用這個實現 `transformFor` 並完成 v-for 指令！

### transformFor

現在我們已經克服了障礙，讓我們像往常一樣使用我們擁有的東西實現轉換器。
還有一點點，讓我們加油！

像 v-if 一樣，這也涉及結構，所以讓我們使用 `createStructuralDirectiveTransform` 來實現它。

我認為如果我用程式碼寫解釋會更容易理解，所以我將在下面提供帶有解釋的程式碼。但是，請在查看這個之前嘗試透過閱讀原始碼自己實現它！

```ts
// 這是主要結構的實現，類似於 v-if。
// 它在適當的地方執行 processFor 並在適當的地方生成 codegenNode。
// processFor 是最複雜的實現。
export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    return processFor(node, dir, context, forNode => {
      // 如預期的那樣，生成呼叫 renderList 的程式碼。
      const renderExp = createCallExpression(context.helper(RENDER_LIST), [
        forNode.source,
      ]) as ForRenderListExpression

      // 為作為 v-for 容器的 Fragment 生成 codegenNode。
      forNode.codegenNode = createVNodeCall(
        context,
        context.helper(FRAGMENT),
        undefined,
        renderExp,
      ) as ForCodegenNode

      // codegen 過程（在 processFor 中的解析和識別符收集之後執行）
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
  // 解析 v-for 的表達式。
  // 在 parseResult 階段，每個 Node 的識別符已經被收集。
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

  // 用 forNode 替換 Node。
  context.replaceNode(forNode)

  if (!context.isBrowser) {
    // 將收集的識別符添加到上下文中。
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  // 生成程式碼（這允許跳過向局部變數添加前綴）
  const onExit = processCodegen && processCodegen(forNode)

  return () => {
    value && removeIdentifiers(value)
    key && removeIdentifiers(key)
    index && removeIdentifiers(index)

    if (onExit) onExit()
  }
}

// 使用正規表達式解析給定給 v-for 的表達式。
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
        // 如果不在瀏覽器模式下，將 asParams 設置為 true 並收集 key 的識別符。
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
          // 如果不在瀏覽器模式下，將 asParams 設置為 true 並收集 index 的識別符。
          result.index = processExpression(result.index, context, true)
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    if (!context.isBrowser) {
      // 如果不在瀏覽器模式下，將 asParams 設置為 true 並收集 value 的識別符。
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

現在，剩下的部分是實際包含在編譯程式碼中的 renderList 的實現，以及註冊轉換器的實現。如果我們能實現這些，v-for 應該就能工作了！

讓我們嘗試執行它！

![v_for](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/v_for.png)

看起來進展順利。

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/050_v_for)
