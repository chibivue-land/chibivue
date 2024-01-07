# Supporting the v-for directive

## Developer Interface to Aim for

Now, let's continue with the directive implementation. This time, let's try to support v-for.

Well, I think it's a familiar directive for those of you who have used Vue.js before.

There are various syntaxes for v-for.
The most basic one is looping through an array, but you can also loop through other things such as strings, object keys, ranges, and so on.

https://vuejs.org/v2/guide/list.html

It's a bit long, but this time, let's aim for the following developer interface:

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

You might think, "Are we implementing so many things all of a sudden? It's impossible!" But don't worry, I will explain step by step.

## Implementation Approach

First, let's think about how we want to compile it roughly, and consider where the difficult points might be when implementing it.

First, let's take a look at the desired compilation result.

The basic structure is not so difficult. We will implement a helper function called renderList in the runtime-core to render the list, and compile it into an expression.

Example 1:

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

Example 2:

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

Example 3:

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

In the future, the values passed as the first argument to renderList are expected to be not only arrays but also numbers and objects. However, for now, let's assume that only arrays are expected. The implementation of the \_renderList function itself can be understood as something similar to Array.prototype.map. As for values other than arrays, you just need to normalize them in \_renderList, so let's forget about them for now (just focus on arrays).

Now, for those of you who have implemented various directives so far, implementing this kind of compiler (transformer) should not be too difficult.

## Key implementation points (difficult points)

The difficult point is when using it in SFC (Single File Components). Do you remember the difference between the compiler used in SFC and the one used in the browser? Yes, it's resolving expressions using `_ctx`.

In v-for, user-defined local variables appear in various forms, so you need to collect them properly and skip rewriteIdentifiers.

```ts
// Bad example
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // It's okay to have a prefix for fruits because it is bound from _ctx
    ({ name, id }) =>
      h(
        'li',
        { key: _ctx.id }, // It's not okay to have _ctx here
        _ctx.name, // It's not okay to have _ctx here
      ),
  ),
)
```

```ts
// Good example
h(
  _Fragment,
  null,
  _renderList(
    _ctx.fruits, // It's okay to have a prefix for fruits because it is bound from _ctx
    ({ name, id }) =>
      h(
        'li',
        { key: id }, // It's not okay to have _ctx here
        name, // It's not okay to have _ctx here
      ),
  ),
)
```

There are various definitions of local variables, from example 1 to 3.

You need to analyze each definition and collect the identifiers to be skipped.

Now, let's put aside how to achieve this and start implementing it from the big picture.

## Implementation of AST

For now, let's define the AST as usual.

As with v-if, we will consider the transformed AST (no need to implement the parser).

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
  parseResult: ForParseResult // To be explained later
  codegenNode?: ForCodegenNode
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST // To be explained later
  arguments: [ExpressionNode, ForIteratorExpression]
}

// Also support function expressions because callback functions are used as the second argument of renderList.
export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
}

// In the case of v-for, the return is fixed, so it is represented as an AST for that purpose.
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

Regarding `RENDER_LIST`, as usual, add it to `runtimeHelpers`.

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

As for `ForParseResult`, its definition is in `transform/vFor`.

```ts
export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}
```

To explain what each of them refers to,

In the case of `v-for="(fruit, i) in fruits"`,

- source: `fruits`
- value: `fruit`
- key: `i`
- index: `undefined`

`index` is the third argument when applying an object to `v-for`.

https://vuejs.org/v2/guide/list.html#v-for-with-an-object

![v_for_ast.drawio.png](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/v_for_ast.drawio.png)

Regarding `value`, if you use destructuring assignment like `{ id, name, color, }`, it will have multiple identifiers.

We collect the identifiers defined by `value`, `key`, and `index`, and skip adding the prefix.

## Implementation of codegen

Although the order is a bit out of order, let's implement codegen first because there is not much to talk about.
There are only two things to do: handling `NodeTypes.FOR` and codegen for function expressions (which turned out to be the first appearance).

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

There is nothing particularly difficult. That's the end of it.

## Implementation of transformer

### Preparation

Before implementing the transformer, there are also some preparations.

As we did with `v-on`, in the case of `v-for`, the timing to execute `processExpression` is a bit special (we need to collect local variables), so we skip it in `transformExpression`.

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

### Collecting Identifiers

Now, let's think about how to collect identifiers before we move on to the main implementation.

This time, we need to consider not only simple identifiers like `fruit`, but also destructuring assignments like `{ id, name, color }`.
For this purpose, it seems that we need to use TreeWalker as usual.

Currently, in the `processExpression` function, the implementation is to search for identifiers and add `_ctx` to them. However, this time we only need to collect identifiers without adding anything. Let's achieve this.

First, let's prepare a place to store the collected identifiers. Since it would be convenient for codegen and other purposes if each Node has them, let's add a property to the AST that can hold multiple identifiers on each Node.

The targets are `CompoundExpressionNode` and `SimpleExpressionNode`.

Simple identifiers like `fruit` will be added to `SimpleExpressionNode`,
and destructuring assignments like `{ id, name, color }` will be added to `CompoundExpressionNode`. (In terms of visualization, it will be a compound expression like `["{", simpleExpr("id"), ",", simpleExpr("name"), ",", simpleExpr("color"), "}"]`)

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

In the `processExpression` function, let's implement the logic to collect identifiers here and skip adding prefixes by adding the collected identifiers to the transformer's context.

Currently, the functions for adding/removing identifiers are configured to receive a single identifier as a string, so let's change it to a form that assumes `{ identifier: string[] }`.

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

Now, let's implement the logic to collect identifiers in the `processExpression` function.

In the `processExpression` function, define an option called `asParams`, and if it is set to true, implement the logic to skip adding prefixes and collect identifiers in `node.identifiers`.

`asParams` is intended to refer to the arguments (local variables) defined in the callback function of `renderList`.

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

This is the end for simple identifiers. The problem lies in other cases.

For this, we will use `walkIdentifiers` implemented in `babelUtils`.

Since we assume local variables defined as function arguments, we will convert them to "function arguments" in this function, and in `walkIdentifier`, we will search for them as Function params.

```ts
// Convert asParams like function arguments
const source = `(${rawExp})${asParams ? `=>{}` : ``}`

// walkIdentifiers is slightly more complex.
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
        // Explained later (collecting identifiers in knownIds within this function)
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

What we are doing here is simply walking the arguments if node is a function and collecting identifiers into `identifiers`.

In the caller of `walkIdentifiers`, we define `knownIds` and pass it to `walkIdentifiers` along with `knownIds` to collect identifiers.

After collecting in `walkIdentifiers`, finally, we generate identifiers based on `knownIds` when generating CompoundExpression.

```ts
const knownIds: Record<string, number> = Object.create(ctx.identifiers)

walkIdentifiers(
  ast,
  node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  },
  knownIds, // pass
  parentStack,
)

// .
// .
// .

ret.identifiers = Object.keys(knownIds) // generate identifiers based on knownIds
return ret
```

Although the file is a bit out of order, `walkFunctionParams` and `markScopeIdentifier` simply walk through the parameters and add `Node.name` to `knownIds`.

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

With this, we should be able to collect identifiers. Let's implement `transformFor` using this and complete the v-for directive!

### transformFor

Now that we have overcome the hurdle, let's implement the transformer using what we have as usual.
Just a little more, let's do our best!

Like v-if, this also involves the structure, so let's implement it using `createStructuralDirectiveTransform`.

I think it would be easier to understand if I write an explanation with code, so I will provide the code with explanations below. However, please try to implement it yourself by reading the source code before looking at this!

```ts
// This is the implementation of the main structure, similar to v-if.
// It executes processFor at the appropriate place and generates codegenNode at the appropriate place.
// processFor is the most complex implementation.
export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    return processFor(node, dir, context, forNode => {
      // As expected, generate code to call renderList.
      const renderExp = createCallExpression(context.helper(RENDER_LIST), [
        forNode.source,
      ]) as ForRenderListExpression

      // Generate codegenNode for the Fragment that serves as the container for v-for.
      forNode.codegenNode = createVNodeCall(
        context,
        context.helper(FRAGMENT),
        undefined,
        renderExp,
      ) as ForCodegenNode

      // codegen process (executed after parse and identifier collection in processFor)
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
  // Parse the expression of v-for.
  // At the parseResult stage, identifiers of each Node have already been collected.
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

  // Replace the Node with forNode.
  context.replaceNode(forNode)

  if (!context.isBrowser) {
    // Add the collected identifiers to the context.
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  // Generate code (this allows skipping the addition of the prefix to local variables)
  const onExit = processCodegen && processCodegen(forNode)

  return () => {
    value && removeIdentifiers(value)
    key && removeIdentifiers(key)
    index && removeIdentifiers(index)

    if (onExit) onExit()
  }
}

// Parse the expression given to v-for using regular expressions.
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
        // If not in browser mode, set asParams to true and collect identifiers of key.
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
          // If not in browser mode, set asParams to true and collect identifiers of index.
          result.index = processExpression(result.index, context, true)
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    if (!context.isBrowser) {
      // If not in browser mode, set asParams to true and collect identifiers of value.
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

Now, the remaining part is the implementation of renderList that is actually included in the compiled code, and the implementation of registering the transformer. If we can implement these, v-for should work!

Let's try running it!

![v_for](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/v_for.png)

It seems to be going well.

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/050_v_for)
