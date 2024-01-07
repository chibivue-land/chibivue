# transformExpression

## Developer Interface to Aim for and Current Challenges

First, take a look at this component.

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

There are several issues with this component.  
Since this component is written in SFC, the `with` statement is not used.  
In other words, the bindings are not working properly.

Let's take a look at the compiled code.

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

- Issue 1: The `increment` registered as the event handler cannot access `_ctx`.  
  This is because the prefix was not added in the previous implementation of `v-bind`.
- Issue 2: The expression `count + count` cannot access `_ctx`.  
  Regarding the mustache syntax, it only adds `_ctx.` to the beginning, and cannot handle other identifiers.  
  Therefore, all identifiers that appear in the middle of an expression need to be prefixed with `_ctx.`. This applies to all parts, not just mustaches.

It seems that a process is needed to add `_ctx.` to the identifiers that appear in the expressions.

::: details Desired Compilation Result

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

Actually, the original implementation takes a slightly different approach.

As you can see below, in the original implementation, anything bound from the `setup` function is resolved through `$setup`.

![resolve_bindings_original](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/resolve_bindings_original.png)

However, implementing this is a bit difficult, so we will simplify it and implement it by adding `_ctx.`. (All props and setup will be resolved from `_ctx`)

:::

## Implementation Approach

To put it simply, what we want to do is "add `_ctx.` to the beginning of every Identifier (name) on the ExpressionNode".

Let me explain it in a bit more detail.  
As a review, a program is represented as an AST by being parsed.  
And the AST representing the program has two main types of nodes: Expression and Statement.  
These are commonly known as expressions and statements.

```ts
1 // This is an Expression
ident // This is an Expression
func() // This is an Expression
ident + func() // This is an Expression

let a // This is a Statement
if (!a) a = 1 // This is a Statement
for (let i = 0; i < 10; i++) a++ // This is a Statement
```

What we want to consider here is Expression.  
There are various types of expressions. Identifier is one of them, which is an expression represented by an identifier.  
(You can think of it as a variable name in general)

Identifier appears in various places in an expression.

```ts
1 // None
ident // ident --- (1)
func() // func --- (2)
ident + func() // ident, func --- (3)
```

In this way, Identifier appears in various places in an expression.

You can observe various Identifiers on the ExpressionNode by entering the program on the following site, which allows you to observe the AST.  
https://astexplorer.net/#/gist/670a1bee71dbd50bec4e6cc176614ef8/9a9ff250b18ccd9000ed253b0b6970696607b774

## Searching for Identifiers

Now that we know what we want to do, how do we implement it?

It seems very difficult, but it is actually simple. We will use a library called estree-walker.  
https://github.com/Rich-Harris/estree-walker

We will use this library to walk through the AST obtained by parsing with babel.  
The usage is very simple. Just pass the AST to the `walk` function and describe the processing for each Node as the second argument.  
This `walk` function walks through the AST node by node, and the processing at the point when it reaches that Node is done with the `enter` option.  
In addition to `enter`, there are also options such as `leave` to process at the end of that Node. We will only use `enter` this time.

Create a new file called `compiler-core/babelUtils.ts` and implement utility functions that can perform operations on Identifiers.

First, install estree-walker.

```sh
npm install estree-walker

npm install -D @babel/types # Also install this
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

Then, generate the AST for the expression and pass it to this function to perform the transformation while rewriting the nodes.

## Implementation of transformExpression

### Changes to AST and Parser for InterpolationNode

We will implement the main body of the transformation process, transformExpression.

First, we will modify InterpolationNode so that it has a SimpleExpressionNode instead of a string as its content.

```ts
export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: string // [!code --]
  content: ExpressionNode // [!code ++]
}
```

With this change, we also need to modify parseInterpolation.

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

### Implementation of the transformer (main body)

To make the expression transformation usable in other transformers, we will extract it as a function called `processExpression`.
In transformExpression, we will process the ExpressionNode of INTERPOLATION and DIRECTIVE.

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

Next, let's explain the implementation of processExpression.
First, we will implement a function called rewriteIdentifier to rewrite Identifier within node.
If node is a single Identifier, we simply apply this function and return it.

One thing to note is that this processExpression is specific to SFC (Single File Component) cases (cases without using the with statement).
In other words, if the isBrowser flag is set, we implement it to simply return the node.
We modify the implementation to receive the flag via ctx.

Also, I want to leave literals like true and false as they are, so I'll create a whitelist for literals.

```ts
export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
): ExpressionNode {
  if (ctx.isBrowser) {
    // Do nothing for the browser
    return node
  }

  const rawExp = node.content

  const rewriteIdentifier = (raw: string) => {
    return `_ctx.${raw}`
  }

  if (isSimpleIdentifier(rawExp)) {
    node.content = rewriteIdentifier(rawExp)
    return node
  }

  // TODO:
}
```

`makeMap` is a helper function for existence checking implemented in vuejs/core, which returns a boolean indicating whether it matches the string defined with comma separation.

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

The problem lies in the next step, which is how to transform the SimpleExpressionNode (not a simple Identifier) and transform the node.
In the following discussion, please pay attention to the fact that we will be dealing with two different ASTs: the JavaScript AST generated by Babel and the AST defined by chibivue.
To avoid confusion, we will refer to the former as estree and the latter as AST in this chapter.

The strategy is divided into two stages.

1. Replace the estree node while collecting the node
2. Build the AST based on the collected node

First, let's start with stage 1.
This is relatively simple. If we can parse the original SimpleExpressionNode content (string) with Babel and obtain the estree, we can pass it through the utility function we created earlier and apply rewriteIdentifier.
At this point, we collect the estree node.

```ts
import { parse } from '@babel/parser'
import { Identifier } from '@babel/types'
import { walkIdentifiers } from '../babelUtils'

interface PrefixMeta {
  start: number
  end: number
}

export function processExpression(
  node: SimpleExpressionNode,
  ctx: TransformContext,
): ExpressionNode {
  // .
  // .
  // .
  const ast = parse(`(${rawExp})`).program // ※ This ast refers to estree.
  type QualifiedId = Identifier & PrefixMeta
  const ids: QualifiedId[] = []

  walkIdentifiers(ast, node => {
    node.name = rewriteIdentifier(node.name)
    ids.push(node as QualifiedId)
  })

  // TODO:
}
```

One thing to note is that up to this point, we have only manipulated the estree and have not manipulated the ast node.

### CompoundExpression

Next, let's move on to stage 2. Here, we will define a new AST Node called `CompoundExpressionNode`.
Compound implies "combination" or "complexity". This Node has children, which take slightly special values.
First, let's take a look at the definition of AST.

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

Children takes an array like the one shown above.
To understand what children in this Node represent, it would be easier to see specific examples, so let's give some examples.

The following expression will be parsed into the following CompoundExpressionNode:

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

It's quite a strange feeling. The reason why "children" takes the type of string is because it takes this form.  
In CompoundExpression, the Vue compiler divides it into the necessary granularity and expresses it partially as a string or partially as a Node.  
Specifically, in cases like this where an Identifier existing in Expression is rewritten, only the Identifier part is divided into another SimpleExpressionNode.

In other words, what we are going to do is to generate this CompoundExpression based on the collected estree's Identifier Node and source.  
The following code is the implementation for that.

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

The Node parsed by Babel has start and end (location information of where it corresponds to the original string), so we extract the corresponding part from rawExp based on that and divide it diligently.  
Please take a close look at the source code for more details. If you understand the policy so far, you should be able to read it. (Also, please take a look at the implementation of advancePositionWithClone, etc., as they are newly implemented.)

Now that we can generate CompoundExpressionNode, let's also support it in Codegen.

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
      // If it is a string, push it as it is
      context.push(child)
    } else {
      // For anything else, generate codegen for the Node
      genNode(child, context, option)
    }
  }
}
```

(genInterpolation has become just genNode, but I'll leave it for now.)

## Try it out

Now that we have implemented this far, let's complete the compiler and try running it!

```ts
// Add transformExpression
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

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/022_transform_expression)
