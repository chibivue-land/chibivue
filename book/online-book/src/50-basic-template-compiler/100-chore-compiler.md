# Compiler Refinements

In this chapter, we will make several adjustments to improve the quality of the template compiler.\
We will cover two main topics:

1. **Whitespace Handling** - Remove and condense unnecessary whitespace
2. **Text Node Merging** - Efficiently merge adjacent text nodes

These are optimizations to improve the quality of the generated code rather than visible features.

## Whitespace Handling

### The Problem

In the current implementation, all whitespace in templates is preserved as-is.\
Consider the following template:

```html
<div>
  <span>Hello</span>
  <span>World</span>
</div>
```

In the current implementation, newlines and indentation between `<div>` and `<span>` are preserved as text nodes.\
This generates unnecessary nodes and can affect performance.

### Vue.js's Approach

Vue.js uses the `whitespace` option to control how whitespace is handled.

```ts
type WhitespaceStrategy = 'preserve' | 'condense'
```

- **`'condense'`** (default): Condense consecutive whitespace and remove unnecessary whitespace
- **`'preserve'`**: Preserve whitespace as-is

### Condense Mode Behavior

In condense mode, whitespace is processed according to the following rules:

1. **Whitespace-only text nodes at the start/end** → Remove
2. **Whitespace between elements containing newlines** → Remove
3. **Consecutive whitespace** → Condense to a single space
4. **Whitespace between elements without newlines** → Preserve (condensed to single space)

Examples:

```html
<div>   <span/>    </div>
<!-- Result: Only <span/> as child node (surrounding spaces removed) -->

<div/>
<div/>
<div/>
<!-- Result: Only 3 div elements (whitespace with newlines removed) -->

<span>foo</span>  <span>bar</span>
<!-- Result: Space between elements is preserved (no newlines) -->
```

### Implementation

First, add the `whitespace` option to `ParserOptions`.

`packages/compiler-core/src/options.ts`:

```ts
export interface ParserOptions {
  // ... existing options ...
  whitespace?: 'preserve' | 'condense' // [!code ++]
}
```

Add whitespace processing functions to `packages/compiler-core/src/parse.ts`.

```ts
function isAllWhitespace(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (
      c !== 0x20 && // space
      c !== 0x09 && // tab
      c !== 0x0a && // newline
      c !== 0x0c && // form feed
      c !== 0x0d    // carriage return
    ) {
      return false
    }
  }
  return true
}

function hasNewlineChar(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (c === 0x0a || c === 0x0d) {
      return true
    }
  }
  return false
}

function condense(content: string): string {
  let result = ''
  let prevIsWhitespace = false
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    const isWhitespace =
      c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d
    if (isWhitespace) {
      if (!prevIsWhitespace) {
        result += ' '
        prevIsWhitespace = true
      }
    } else {
      result += content[i]
      prevIsWhitespace = false
    }
  }
  return result
}

function condenseWhitespace(
  nodes: TemplateChildNode[],
  context: ParserContext,
): TemplateChildNode[] {
  const shouldCondense = context.options.whitespace !== 'preserve'
  let removedWhitespace = false

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === NodeTypes.TEXT) {
      if (!context.inPre) {
        if (isAllWhitespace(node.content)) {
          const prev = nodes[i - 1]?.type
          const next = nodes[i + 1]?.type
          // Remove if:
          // - First or last whitespace
          // - (condense mode) Whitespace between comments
          // - (condense mode) Whitespace between comment and element
          // - (condense mode) Whitespace between elements containing newlines
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              ((prev === NodeTypes.COMMENT &&
                (next === NodeTypes.COMMENT || next === NodeTypes.ELEMENT)) ||
                (prev === NodeTypes.ELEMENT &&
                  (next === NodeTypes.COMMENT ||
                    (next === NodeTypes.ELEMENT &&
                      hasNewlineChar(node.content))))))
          ) {
            removedWhitespace = true
            nodes[i] = null as any
          } else {
            // Otherwise, condense to single space
            node.content = ' '
          }
        } else if (shouldCondense) {
          // In condense mode, condense consecutive whitespace
          node.content = condense(node.content)
        }
      }
    }
  }

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}
```

Then call this function when parsing elements.

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // ... existing code ...

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = condenseWhitespace(children, context) // [!code ++]
    // element.children = children // [!code --]

    // ...
  }

  return element
}
```

Also apply the same processing to the root node.

```ts
export const baseParse = (
  content: string,
  options: ParserOptions = {},
): RootNode => {
  const context = createParserContext(content, options)
  const children = parseChildren(context, [])
  return createRoot(condenseWhitespace(children, context)) // [!code ++]
  // return createRoot(children) // [!code --]
}
```

## Text Node Merging (transformText)

### The Problem

In the current implementation, text nodes and mustache syntax (`{{ }}`) are treated as separate nodes.

```html
<div>abc {{ d }} {{ e }}</div>
```

This template has the following child nodes:
- `TEXT`: "abc "
- `INTERPOLATION`: d
- `TEXT`: " "
- `INTERPOLATION`: e

Processing these individually during code generation is inefficient.

### Vue.js's Approach

Vue.js uses a transformer called `transformText` to merge adjacent text nodes and mustache syntax into a single `CompoundExpression`.

After merging:
```ts
// "abc " + d + " " + e
createCompoundExpression(['abc ', d, ' ', e])
```

This allows efficient concatenation operations during code generation.

### Implementation

Create `packages/compiler-core/src/transforms/transformText.ts`.

```ts
import type { NodeTransform } from '../transform'
import {
  type CompoundExpressionNode,
  ElementTypes,
  NodeTypes,
  createCallExpression,
  createCompoundExpression,
} from '../ast'
import { isText } from '../utils'
import { CREATE_TEXT } from '../runtimeHelpers'
import { PatchFlags } from '@chibivue/shared'

// Merge adjacent text nodes and mustaches into a single expression
// e.g. <div>abc {{ d }} {{ e }}</div> should have a single child node
export const transformText: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // Execute after child processing is complete
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc,
                )
              }
              // Merge adjacent text nodes
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }

      if (
        !hasText ||
        // Leave plain elements with a single text child as-is
        // Runtime has optimized fast path for directly setting textContent
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              !node.props.find(
                p =>
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name],
              ))))
      ) {
        return
      }

      // Convert text nodes to createTextVNode(text) calls
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: any[] = []
          // createTextVNode defaults to single space,
          // so we can omit the argument for single space
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // Mark dynamic text with flag for patching inside a block
          if (!context.ssr && !isStaticNode(child)) {
            callArgs.push(PatchFlags.TEXT)
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs,
            ),
          }
        }
      }
    }
  }
}

function isStaticNode(node: any): boolean {
  if (node.type === NodeTypes.TEXT) {
    return true
  }
  if (node.type === NodeTypes.INTERPOLATION) {
    return node.content.isStatic
  }
  if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
    return node.children.every((child: any) => {
      if (typeof child === 'string') return true
      return isStaticNode(child)
    })
  }
  return false
}
```

Add the `isText` helper to `packages/compiler-core/src/utils.ts`.

```ts
export function isText(
  node: TemplateChildNode,
): node is TextNode | InterpolationNode {
  return node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION
}
```

Add `TEXT_CALL` node type and `createCallExpression` to `packages/compiler-core/src/ast.ts`.

```ts
export const enum NodeTypes {
  // ... existing types ...
  TEXT_CALL, // [!code ++]
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression
}

export function createCallExpression(
  callee: string,
  args: CallExpression['arguments'] = [],
  loc: SourceLocation = locStub,
): CallExpression {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  }
}
```

Add `CREATE_TEXT` to `packages/compiler-core/src/runtimeHelpers.ts`.

```ts
export const CREATE_TEXT = Symbol('createTextVNode')

export const helperNameMap: Record<symbol, string> = {
  // ... existing helpers ...
  [CREATE_TEXT]: 'createTextVNode',
}
```

### Registering the Transformer

Register the transformer in `packages/compiler-core/src/compile.ts`.

```ts
import { transformText } from './transforms/transformText'

export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformElement,
      transformSlotOutlet,
      transformText, // [!code ++]
    ],
    {
      on: transformOn,
      bind: transformBind,
      if: transformIf,
      for: transformFor,
      model: transformModel,
    },
  ]
}
```

### Updating Code Generation

Add `TEXT_CALL` node handling to `packages/compiler-core/src/codegen.ts`.

```ts
function genNode(node: any, context: CodegenContext) {
  switch (node.type) {
    // ... existing cases ...
    case NodeTypes.TEXT_CALL: // [!code ++]
      genNode(node.codegenNode, context) // [!code ++]
      break // [!code ++]
  }
}
```

### Updating the Runtime

Add `createTextVNode` to `packages/runtime-core/src/vnode.ts`.

```ts
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}
```

Export this from `packages/runtime-core/src/index.ts`.

```ts
export { createTextVNode } from './vnode'
```

## Testing

Let's verify with the following template:

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const name = ref('World')
    return { name }
  },
}
</script>

<template>
  <div>
    <p>Hello {{ name }}!</p>
  </div>
</template>
```

When you check the compilation result, you should see:
- Unnecessary whitespace (newlines and indentation) has been removed
- `Hello `, `{{ name }}`, and `!` have been merged

The compiler quality has now been improved!

Source code up to this point:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/100_chore_compiler)
