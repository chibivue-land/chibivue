# 支持 v-for 指令

## 目标开发者接口

现在，让我们继续指令的实现．这次，让我们尝试支持 v-for．

嗯，我想对于那些之前使用过 Vue.js 的人来说，这是一个熟悉的指令．

v-for 有各种语法．
最基本的是循环遍历数组，但你也可以循环遍历其他东西，如字符串，对象键，范围等等．

https://vuejs.org/v2/guide/list.html

虽然有点长，但这次，让我们以以下开发者接口为目标：

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

你可能会想，"我们突然要实现这么多东西？这不可能！"但不要担心，我会一步一步地解释．

## 实现方法

首先，让我们大致思考一下我们想要如何编译它，并考虑在实现时可能遇到的困难点．

首先，让我们看看期望的编译结果．

基本结构并不那么困难．我们将在 runtime-core 中实现一个名为 renderList 的辅助函数来渲染列表，并将其编译为表达式．

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

将来，作为 renderList 第一个参数传递的值预期不仅是数组，还可能是数字和对象．但是，现在让我们假设只期望数组．\_renderList 函数本身的实现可以理解为类似于 Array.prototype.map 的东西．至于除数组之外的值，你只需要在 \_renderList 中对它们进行规范化，所以现在让我们忘记它们（只关注数组）．

现在，对于那些到目前为止已经实现了各种指令的人来说，实现这种编译器（转换器）应该不会太困难．

## 关键实现点（困难点）

困难点在于在 SFC（单文件组件）中使用它时．你还记得在 SFC 中使用的编译器和在浏览器中使用的编译器之间的区别吗？是的，就是使用 `_ctx` 解析表达式．

在 v-for 中，用户定义的局部变量以各种形式出现，所以你需要正确地收集它们并跳过 rewriteIdentifiers．

```ts
// 错误示例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits 有前缀是可以的，因为它是从 _ctx 绑定的
    ({ name, id }) =>
      h(
        'li',
        { key: _ctx.id }, // 这里有 _ctx 是不对的
        _ctx.name, // 这里有 _ctx 是不对的
      ),
  ),
)
```

```ts
// 正确示例
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // fruits 有前缀是可以的，因为它是从 _ctx 绑定的
    ({ name, id }) =>
      h(
        'li',
        { key: id }, // 这里不应该有 _ctx
        name, // 这里不应该有 _ctx
      ),
  ),
)
```

从示例 1 到 3，有各种局部变量的定义．

你需要分析每个定义并收集要跳过的标识符．

现在，让我们暂时搁置如何实现这一点，从大局开始实现．

## AST 的实现

现在，让我们像往常一样定义 AST．

与 v-if 一样，我们将考虑转换后的 AST（无需实现解析器）．

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
  parseResult: ForParseResult // 稍后解释
  codegenNode?: ForCodegenNode
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST // 稍后解释
  arguments: [ExpressionNode, ForIteratorExpression]
}

// 还支持函数表达式，因为回调函数用作 renderList 的第二个参数。
export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
}

// 在 v-for 的情况下，返回是固定的，所以它被表示为专门用于此目的的 AST。
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

关于 `RENDER_LIST`，像往常一样，将其添加到 `runtimeHelpers`．

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

至于 `ForParseResult`，其定义在 `transform/vFor` 中．

```ts
export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}
```

为了解释它们各自指的是什么，

在 `v-for="(fruit, i) in fruits"` 的情况下，

- source: `fruits`
- value: `fruit`
- key: `i`
- index: `undefined`

`index` 是将对象应用于 `v-for` 时的第三个参数．

https://vuejs.org/v2/guide/list.html#v-for-with-an-object

![v_for_ast.drawio.png](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/v_for_ast.drawio.png)

关于 `value`，如果你使用像 `{ id, name, color, }` 这样的解构赋值，它将有多个标识符．

我们收集由 `value`，`key` 和 `index` 定义的标识符，并跳过添加前缀．

## codegen 的实现

虽然顺序有点颠倒，但让我们先实现 codegen，因为没有太多要讨论的．
只需要做两件事：处理 `NodeTypes.FOR` 和函数表达式的 codegen（这是第一次出现）．

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

没有什么特别困难的．就这样结束了．

## 转换器的实现

### 准备工作

在实现转换器之前，还有一些准备工作．

正如我们在 `v-on` 中所做的，在 `v-for` 的情况下，执行 `processExpression` 的时机有点特殊（我们需要收集局部变量），所以我们在 `transformExpression` 中跳过它．

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

### 收集标识符

现在，在我们继续主要实现之前，让我们思考如何收集标识符．

这次，我们需要考虑不仅是像 `fruit` 这样的简单标识符，还有像 `{ id, name, color }` 这样的解构赋值．
为此，似乎我们需要像往常一样使用 TreeWalker．

目前，在 `processExpression` 函数中，实现是搜索标识符并向它们添加 `_ctx`．但是，这次我们只需要收集标识符而不添加任何东西．让我们实现这一点．

首先，让我们准备一个地方来存储收集的标识符．由于如果每个 Node 都有它们对于 codegen 和其他目的会很方便，让我们向 AST 添加一个可以在每个 Node 上保存多个标识符的属性．

目标是 `CompoundExpressionNode` 和 `SimpleExpressionNode`．

像 `fruit` 这样的简单标识符将被添加到 `SimpleExpressionNode`，
像 `{ id, name, color }` 这样的解构赋值将被添加到 `CompoundExpressionNode`．（在可视化方面，它将是一个复合表达式，如 `["{", simpleExpr("id"), ",", simpleExpr("name"), ",", simpleExpr("color"), "}"]`）

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

在 `processExpression` 函数中，让我们在这里实现收集标识符的逻辑，并通过将收集的标识符添加到转换器的上下文中来跳过添加前缀．

目前，用于添加/删除标识符的函数被配置为接收单个标识符作为字符串，所以让我们将其更改为假设 `{ identifier: string[] }` 的形式．

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

现在，让我们在 `processExpression` 函数中实现收集标识符的逻辑．

在 `processExpression` 函数中，定义一个名为 `asParams` 的选项，如果设置为 true，实现跳过添加前缀并在 `node.identifiers` 中收集标识符的逻辑．

`asParams` 旨在引用在 `renderList` 的回调函数中定义的参数（局部变量）．

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

这就是简单标识符的结束．问题在于其他情况．

为此，我们将使用在 `babelUtils` 中实现的 `walkIdentifiers`．

由于我们假设定义为函数参数的局部变量，我们将在此函数中将它们转换为"函数参数"，并在 `walkIdentifier` 中将它们作为 Function params 搜索．

```ts
// 将 asParams 转换为类似函数参数的形式
const source = `(${rawExp})${asParams ? `=>{}` : ``}`

// walkIdentifiers 稍微复杂一些。
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
        // 稍后解释（在此函数内的 knownIds 中收集标识符）
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

我们在这里做的只是如果 node 是函数则遍历参数，并将标识符收集到 `identifiers` 中．

在 `walkIdentifiers` 的调用者中，我们定义 `knownIds` 并将其与 `knownIds` 一起传递给 `walkIdentifiers` 以收集标识符．

在 `walkIdentifiers` 中收集后，最后，在生成 CompoundExpression 时基于 `knownIds` 生成标识符．

```ts
const knownIds: Record<string, number> = Object.create(ctx.identifiers)

walkIdentifiers(
  ast,
  node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  },
  knownIds, // 传递
  parentStack,
)

// .
// .
// .

ret.identifiers = Object.keys(knownIds) // 基于 knownIds 生成标识符
return ret
```

虽然文件有点乱序，但 `walkFunctionParams` 和 `markScopeIdentifier` 只是遍历参数并将 `Node.name` 添加到 `knownIds`．

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

有了这个，我们应该能够收集标识符．让我们使用这个实现 `transformFor` 并完成 v-for 指令！

### transformFor

现在我们已经克服了障碍，让我们像往常一样使用我们拥有的东西实现转换器．
还有一点点，让我们加油！

像 v-if 一样，这也涉及结构，所以让我们使用 `createStructuralDirectiveTransform` 来实现它．

我认为如果我用代码写解释会更容易理解，所以我将在下面提供带有解释的代码．但是，请在查看这个之前尝试通过阅读源代码自己实现它！

```ts
// 这是主要结构的实现，类似于 v-if。
// 它在适当的地方执行 processFor 并在适当的地方生成 codegenNode。
// processFor 是最复杂的实现。
export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    return processFor(node, dir, context, forNode => {
      // 如预期的那样，生成调用 renderList 的代码。
      const renderExp = createCallExpression(context.helper(RENDER_LIST), [
        forNode.source,
      ]) as ForRenderListExpression

      // 为作为 v-for 容器的 Fragment 生成 codegenNode。
      forNode.codegenNode = createVNodeCall(
        context,
        context.helper(FRAGMENT),
        undefined,
        renderExp,
      ) as ForCodegenNode

      // codegen 过程（在 processFor 中的解析和标识符收集之后执行）
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
  // 解析 v-for 的表达式。
  // 在 parseResult 阶段，每个 Node 的标识符已经被收集。
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

  // 用 forNode 替换 Node。
  context.replaceNode(forNode)

  if (!context.isBrowser) {
    // 将收集的标识符添加到上下文中。
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  // 生成代码（这允许跳过向局部变量添加前缀）
  const onExit = processCodegen && processCodegen(forNode)

  return () => {
    value && removeIdentifiers(value)
    key && removeIdentifiers(key)
    index && removeIdentifiers(index)

    if (onExit) onExit()
  }
}

// 使用正则表达式解析给定给 v-for 的表达式。
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
        // 如果不在浏览器模式下，将 asParams 设置为 true 并收集 key 的标识符。
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
          // 如果不在浏览器模式下，将 asParams 设置为 true 并收集 index 的标识符。
          result.index = processExpression(result.index, context, true)
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    if (!context.isBrowser) {
      // 如果不在浏览器模式下，将 asParams 设置为 true 并收集 value 的标识符。
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

现在，剩下的部分是实际包含在编译代码中的 renderList 的实现，以及注册转换器的实现．如果我们能实现这些，v-for 应该就能工作了！

让我们尝试运行它！

![v_for](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/v_for.png)

看起来进展顺利．

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/050_v_for)
