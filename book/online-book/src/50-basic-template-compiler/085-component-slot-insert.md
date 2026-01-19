# Supporting Slots (Usage)

## Slot Insertion

Next, let's implement the slot insertion side.
This is the compilation of the `<template #slot-name>` part expressed in the parent component.

As explained at the beginning, slots are compiled as follows:

```js
h(Comp, null, {
  default: _withCtx(() => [
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
  ]),
})
```

In other words, the component's children are treated as `SlotsExpression` (ObjectExpression), each slot is generated as `FunctionExpression`, and wrapped with `withCtx`.

## The Role of withCtx

`withCtx` is a helper function that executes slot functions in the context of the correct component instance. This ensures that reactive dependencies within slots are tracked to the correct component.

```ts
export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance,
) {
  if (!ctx) return fn;

  const renderFnWithContext = (...args: any[]) => {
    const prevInstance = setCurrentRenderingInstance(ctx);
    try {
      return fn(...args);
    } finally {
      setCurrentRenderingInstance(prevInstance);
    }
  };

  return renderFnWithContext;
}
```

## Updating the AST

First, let's update the AST definitions.
We'll add a type called `SlotsExpression` and add an `isSlot` flag to `FunctionExpression` to indicate it's a slot function.

```ts
// SlotsExpression is an ObjectExpression that represents the slots object
// passed to a component. e.g., { default: () => [...], header: () => [...] }
export interface SlotsExpression extends ObjectExpression {}

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  newline: boolean
  isSlot?: boolean // [!code ++]
}
```

Also, add `SlotsExpression` to the `children` type of `VNodeCall`.

```ts
export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL
  tag: string | symbol
  props: PropsExpression | undefined
  children:
    | TemplateChildNode[]
    | TemplateTextChildNode
    | ForRenderListExpression
    | SlotsExpression // [!code ++]
    | undefined
}
```

## Adding the Helper

Add `WITH_CTX` to `runtimeHelpers.ts`.

```ts
export const WITH_CTX = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_CTX]: 'withCtx',
}
```

## Adding Utility Functions

Add utility functions `findDir` and `isTemplateNode` to `utils.ts`.

```ts
export function isTemplateNode(
  node: RootNode | TemplateChildNode,
): node is PlainElementNode & { tag: 'template' } {
  return (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    node.tag === 'template'
  )
}

export function findDir(
  node: ElementNode,
  name: string | RegExp,
  allowEmpty: boolean = false,
): DirectiveNode | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (
      p.type === NodeTypes.DIRECTIVE &&
      (allowEmpty || p.exp) &&
      (typeof name === 'string' ? p.name === name : name.test(p.name))
    ) {
      return p
    }
  }
}
```

`isTemplateNode` determines if a node is a `<template>` tag, and `findDir` finds a directive with the specified name.

## Implementing buildSlots

Implement the `buildSlots` function in `transforms/vSlot.ts` to handle slot insertion.

```ts
import {
  type DirectiveNode,
  type ElementNode,
  type ExpressionNode,
  NodeTypes,
  type Property,
  type SlotsExpression,
  type TemplateChildNode,
  createCallExpression,
  createFunctionExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
} from '../ast'
import { WITH_CTX } from '../runtimeHelpers'
import type { TransformContext } from '../transform'
import { findDir, isStaticExp, isTemplateNode } from '../utils'

// Build slots object for a component
export function buildSlots(
  node: ElementNode,
  context: TransformContext,
): {
  slots: SlotsExpression
} {
  const { children } = node
  const slotsProperties: Property[] = []

  // 1. Check for slot with slotProps on component itself.
  //    <Comp v-slot="{ prop }"/>
  const onComponentSlot = findDir(node, 'slot', true)
  if (onComponentSlot) {
    const { arg, exp } = onComponentSlot
    slotsProperties.push(
      createObjectProperty(
        arg || createSimpleExpression('default', true),
        buildSlotFn(exp, children, node.loc, context),
      ),
    )
  }

  // 2. Iterate through children and check for template slots
  //    <template v-slot:foo="{ prop }">
  let hasTemplateSlots = false
  const implicitDefaultChildren: TemplateChildNode[] = []

  for (let i = 0; i < children.length; i++) {
    const slotElement = children[i]
    let slotDir: DirectiveNode | undefined

    if (
      !isTemplateNode(slotElement) ||
      !(slotDir = findDir(slotElement, 'slot', true))
    ) {
      // not a <template v-slot>, skip.
      if (slotElement.type !== NodeTypes.COMMENT) {
        implicitDefaultChildren.push(slotElement)
      }
      continue
    }

    hasTemplateSlots = true
    const { children: slotChildren, loc: slotLoc } = slotElement
    const {
      arg: slotName = createSimpleExpression(`default`, true),
      exp: slotProps,
    } = slotDir

    const slotFunction = buildSlotFn(slotProps, slotChildren, slotLoc, context)
    slotsProperties.push(createObjectProperty(slotName, slotFunction))
  }

  if (!onComponentSlot) {
    if (!hasTemplateSlots) {
      // implicit default slot (on component)
      slotsProperties.push(
        createObjectProperty(
          `default`,
          buildSlotFn(undefined, children, node.loc, context),
        ),
      )
    } else if (implicitDefaultChildren.length) {
      // implicit default slot (mixed with named slots)
      slotsProperties.push(
        createObjectProperty(
          `default`,
          buildSlotFn(undefined, implicitDefaultChildren, node.loc, context),
        ),
      )
    }
  }

  const slots = createObjectExpression(
    slotsProperties,
    node.loc,
  ) as SlotsExpression

  return {
    slots,
  }
}

function buildSlotFn(
  props: ExpressionNode | undefined,
  children: TemplateChildNode[],
  loc: any,
  context: TransformContext,
) {
  const fn = createFunctionExpression(
    props,
    children,
    false /* newline */,
    children.length ? children[0].loc : loc,
  )
  fn.isSlot = true
  return createCallExpression(context.helper(WITH_CTX), [fn], loc)
}
```

The `buildSlots` function handles three patterns:

1. **When v-slot is on the component itself** (`<Comp v-slot="{ prop }"/>`)
2. **When defining named slots with template tags** (`<template #foo>`)
3. **Implicit default slot** (child elements when there are no named slots)

## Updating transformElement

Finally, update `transformElement.ts` to process component children with `buildSlots`.

```ts
import { buildSlots } from './vSlot'

// ...

// children
if (node.children.length > 0) {
  if (isComponent) {
    // For components, build slots object // [!code ++]
    const { slots } = buildSlots(node, context) // [!code ++]
    vnodeChildren = slots as SlotsExpression // [!code ++]
  } else if (node.children.length === 1) {
    const child = node.children[0]
    const type = child.type
    const hasDynamicTextChild = type === NodeTypes.INTERPOLATION

    if (hasDynamicTextChild || type === NodeTypes.TEXT) {
      vnodeChildren = child as TemplateTextChildNode
    } else {
      vnodeChildren = node.children
    }
  } else {
    vnodeChildren = node.children
  }
}
```

This completes the slot insertion compilation.
Component children are automatically converted to slot objects, generating code like this:

```vue
<Comp>
  <template #header>
    <h1>Header</h1>
  </template>
  <template #default>
    <p>Content</p>
  </template>
</Comp>
```

↓

```js
_createVNode(_component_Comp, null, {
  header: _withCtx(() => [_createVNode('h1', null, 'Header')]),
  default: _withCtx(() => [_createVNode('p', null, 'Content')]),
})
```

This completes the basic slot compiler implementation!

Source code up to this point:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/085_component_slot_insert)
