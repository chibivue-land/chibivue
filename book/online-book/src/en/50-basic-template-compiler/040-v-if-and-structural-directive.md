# v-if and structural directives

Now let's continue implementing directives!

Finally, we will implement v-if.

## Difference between v-if directive and previous directives

So far, we have implemented directives such as v-bind and v-on.

Now let's implement v-if, but v-if is slightly different from these directives.

According to the excerpt from the official Vue.js documentation on compile-time optimization,

> In this case, the entire template has a single block because it does not contain any structural directives like v-if and v-for.

https://vuejs.org/guide/extras/rendering-mechanism.html#tree-flattening

As you can see, the words "structural directives" can be found. (You don't have to worry about what Tree Flattening is, as it will be explained separately.)

As mentioned, v-if and v-for are called "structural directives" and are directives that involve the structure.

In Angular's documentation, they are explicitly mentioned as well.

https://angular.jp/guide/structural-directives

v-if and v-for are directives that not only change the attributes (and behavior for events) of elements, but also change the structure of elements by toggling their existence or generating/removing elements based on the number of items in a list.

## Desired developer interface

Let's think about how to combine v-if / v-else-if / v-else to implement FizzBuzz.

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

First, let's think about the code we want to generate.

To put it simply, v-if and v-else are converted into conditional expressions as follows:

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

As you can see, we are adding a structure to the code we have implemented so far.

To implement a transformer that transforms the AST into such code, we need to make some modifications.

::: warning

The current implementation does not handle whitespace and other skipping, so there may be unnecessary text nodes in between.

However, there is no problem with the implementation of v-if (you will see later), so please ignore it for now.

:::

## Implementation of structural directives

### Implement methods related to structure

Before implementing v-if, let's do some preparation.

As mentioned earlier, v-if and v-for are structural directives that modify the structure of AST nodes.

To achieve this, we need to implement several methods in the base transformer.

Specifically, we will implement the following three methods in TransformContext:

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  // .
  // .
  replaceNode(node: TemplateChildNode): void // Added
  removeNode(node?: TemplateChildNode): void // Added
  onNodeRemoved(): void // Added
}
```

Since you are already implementing traverseChildren, I think you are already keeping track of the current parent and the index of the children. You can use them to implement the above methods.

<!-- NOTE: You may not need to implement this chapter yet. -->

::: details Just in case

This part:

I think you have already implemented it, but I will explain it just in case because I didn't explain it in detail in the chapter where it was implemented.

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent // This
    context.childIndex = i // This
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

    // Replaces the current node and the corresponding parent's children with the given node
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    },

    // Removes the given node from the current node's parent's children
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

    // This is registered when using replaceNode, etc.
    onNodeRemoved: () => {},
  }

  return context
}
```

Some modifications are also needed in the existing implementation. Adjust traverseChildren to handle the case where removeNode is called.

Since the index changes when a node is removed, decrease the index when a node is removed.

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  let i = 0 // This
  const nodeRemoved = () => {
    i-- // This
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved // This
    traverseNode(child, context)
  }
}
```

### Implementation of createStructuralDirectiveTransform

To implement directives such as v-if and v-for, we will implement a helper function called createStructuralDirectiveTransform.

These transformers only act on NodeTypes.ELEMENT and apply the implementation of each transformer to the DirectiveNode that the Node has.

Well, the implementation itself is not big, so I think it would be easier to understand if you actually see it. It looks like this:

```ts
// Each transformer (v-if/v-for, etc.) is implemented according to this interface.
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void)

export function createStructuralDirectiveTransform(
  // The name also supports regular expressions.
  // For example, in the transformer for v-if, it is assumed to receive something like /^(if|else|else-if)$/.
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      // Only act on NodeTypes.ELEMENT
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // Execute the transformer for NodeTypes.DIRECTIVE that matches the name
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

## Implementing v-if

### AST Implementation

Preparations are complete up to this point. From here, let's implement v-if.

As usual, let's start with the definition of the AST and implement the parser.

I would like to say that, but it seems that we don't need a parser this time.

Rather, this time we will think about how we want the transformed AST to look like and implement transformers to transform it accordingly.

Let's take a look at the compiled code that was assumed at the beginning.

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

It can be seen that it is ultimately converted to a conditional expression (ternary operator).

Since we have never dealt with conditional expressions before, it seems that we need to handle this in the AST side for Codegen.
Basically, we want to consider three pieces of information (because it's a "ternary" operator).

- **Condition**  
  This is the part that corresponds to A in A ? B : C.  
  It is represented by the name "condition".
- **Node when the condition matches**  
  This is the part that corresponds to B in A ? B : C.  
  It is represented by the name "consequent".
- **Node when the condition does not match**  
  This is the part that corresponds to C in A ? B : C.  
  It is represented by the name "alternate".

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
  newline: boolean
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ConditionalExpression
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

We will implement an AST to represent the VIf node using these.

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
  condition: ExpressionNode | undefined
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
}

export type ParentNode = RootNode | ElementNode | IfBranchNode
```

### Implementation of the transformer

Now that we have the AST, let's implement the transformer that generates this AST.

The idea is to generate an `IfNode` based on several `ElementNode`s.

By "several", in this case, it means that if there are multiple `ElementNode`s, we need to generate a single `IfNode` that includes `v-if` to `v-else` statements.

If the first `v-if` matches, we need to generate the `IfNode` while checking if the subsequent nodes are `v-else-if` or `v-else`.

Let's start by implementing the overall structure, using the `createStructuralDirectiveTransform` we implemented earlier.

Specifically, since we want to eventually fill the `codegenNode` with the AST we implemented earlier, we will generate the Node in the `onExit` of this transformer.

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
/// Functions used to generate codegenNode

// Generate codegenNode for branch
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      // The alternate is temporarily set to be generated as a comment.
      // It will be replaced with the target Node when v-else-if or v-else is encountered.
      // This is the part where `parentCondition.alternate = createCodegenNodeForBranch(branch, context);` is written.
      // If v-else-if or v-else is not encountered, it will remain as a CREATE_COMMENT Node.
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
  // Just extract vnode call from the branch
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  // Get the end Node by tracing from the node
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

In `processIf`, more specific AST node transformations are performed.

There are cases for if / else-if / else, but let's first consider the case for `if`.

This is quite simple. We create an IfNode and execute the codegenNode generation.
At this time, we generate the current Node as an IfBranch and assign it to IfNode, then replace it with IfNode.

```
- parent
  - currentNode

↓

- parent
  - IfNode
    - IfBranch (currentNode)
```

This is the image of changing the structure.

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
  // We will run processExpression on exp in advance.
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

Let's consider the case other than v-if.

We will traverse from the parent's children through the context to obtain the siblings.  
We will loop through the nodes (starting from the current node itself) and generate IfBranch based on itself, pushing them into branches.  
During this process, comments and empty texts will be removed.

```ts
if (dir.name === 'if') {
  /** omitted */
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

As you can see, actually else-if and else are not distinguished.

Even in the AST, if there is no condition, it is defined as else, so there is nothing special to consider.  
(Absorbed in the part of `createIfBranch` with `dir.name === "else" ? undefined : dir.exp`)

What is important is to generate `IfNode` when it is an `if`, and for other cases, just push them into the branches of that Node.

With this, the implementation of transformIf is complete. We just need to make a few adjustments around it.

In traverseNode, we will execute traverseNode for the branches that IfNode has.

We will also include IfBranch as a target for traverseChildren.

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
    // Added
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break

    case NodeTypes.IF_BRANCH: // Added
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }
}
```

Finally, we just need to register transformIf as an option in the compiler.

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformElement],
    { bind: transformBind, on: transformOn },
  ]
}
```

With this, the transformer is implemented!

All that's left is to implement codegen, and v-if will be complete. We're almost there, let's do our best!

### Implementation of codegen

The rest is easy. Just generate code based on the Node of ConditionalExpression.

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF: // Don't forget to add this!
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

As usual, we are simply generating the conditional expression based on the AST, so there is nothing particularly difficult.

## Done!!

Well, it's been a while since we had a slightly fat chapter, but with this, the implementation of v-if is complete! (Good job!)

Let's try running it for real!!

It's working properly!

![vif_fizzbuzz](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/vif_fizzbuzz.png)

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/040_v_if_and_structural_directive)
