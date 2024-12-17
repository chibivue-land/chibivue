# Component Slots

## Desired Developer Interface

We already have the runtime implementation for the slot implementation of the Basic Component System.\
However, we still cannot handle slots in templates.

We want to handle SFCs like the following:\
(Although we say SFC, it is actually the implementation of the template compiler.)

```vue
<!-- Comp.vue -->
<template>
  <p><slot name="default" /></p>
</template>
```

```vue
<!-- App.vue -->
<script>
import Comp from './Comp.vue'
export default {
  components: {
    Comp,
  },
  setup() {
    const count = ref(0)
    return { count }
  },
}
</script>

<template>
  <Comp>
    <template #default>
      <button @click="count++">count is: {{ count }}</button>
    </template>
  </Comp>
</template>
```

There are several types of slots in Vue.js:

- Default slots
- Named slots
- Scoped slots

However, as you may already understand from the runtime implementation, these are all just callback functions. Let's review them just in case.

Components like the ones above are transformed into render functions as follows.

```js
h(Comp, null, {
  default: () =>
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
})

```

In the template, the `name="default"` attribute can be omitted, but at runtime, it will still be treated as a slot named `default`. We will implement the compiler for default slots after completing the implementation for named slots.

## Implementing the Compiler (Slot Definition)

As usual, we will implement the parsing and code generation processes, but this time we will handle both the slot definition and slot insertion.

First, let's focus on the slot definition. This is the part that is represented as `<slot name="my-slot"/>` on the child component side.

In the runtime, we will prepare a helper function called `renderSlot`, which will take the slots inserted through the component instance (via `ctx.$slot`) and their names as arguments. The source code will be compiled into something like the following:

```js
_renderSlot(_ctx.$slots, "my-slot")
```

We will represent the slot definition as a node called `SlotOutletNode` in the AST.\
Add the following definition to `ast.ts`.

```ts
export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT, // [!code ++]
}

// ...

export type ElementNode = 
  | PlainElementNode 
  | ComponentNode 
  | SlotOutletNode // [!code ++]

// ...

export interface SlotOutletNode extends BaseElementNode { // [!code ++]
  tagType: ElementTypes.SLOT // [!code ++]
  codegenNode: RenderSlotCall | undefined // [!code ++]
} // [!code ++]

export interface RenderSlotCall extends CallExpression { // [!code ++]
  callee: typeof RENDER_SLOT // [!code ++]
  // $slots, name // [!code ++]
  arguments: [string, string | ExpressionNode] // [!code ++]
} // [!code ++]
```

Let's write the parsing process to generate this AST.

In `parse.ts`, the task is simple: when parsing the tag, if it is `"slot"`, change it to `ElementTypes.SLOT`.

```ts
function parseTag(context: ParserContext, type: TagType): ElementNode {
  // ...
  let tagType = ElementTypes.ELEMENT
  if (tag === 'slot') { // [!code ++]
    tagType = ElementTypes.SLOT // [!code ++]
  } else if (isComponent(tag, context)) {
    tagType = ElementTypes.COMPONENT
  }
}
```

Now that we have reached this point, the next step is to implement the transformer to generate the `codegenNode`.\
We need to create a `JS_CALL_EXPRESSION` for the helper function.

As a preliminary step, add `RENDER_SLOT` to `runtimeHelper.ts`.

```ts
// ...
export const RENDER_LIST = Symbol()
export const RENDER_SLOT = Symbol() // [!code ++]
export const MERGE_PROPS = Symbol()
// ...

export const helperNameMap: Record<symbol, string> = {
  // ...
  [RENDER_LIST]: `renderList`,
  [RENDER_SLOT]: 'renderSlot', // [!code ++]
  [MERGE_PROPS]: 'mergeProps',
  // ...
}
```

We will implement a new transformer called `transformSlotOutlet`.\
The task is very simple: when the `ElementType.SLOT` is encountered, we search for the `name` in `node.props` and generate a `JS_CALL_EXPRESSION` for `RENDER_SLOT`.\
We also consider cases where the name is bound, such as `:name="slotName"`.

Since it is straightforward, here is the complete transformer code (please read through it).

```ts
import { camelize } from '../../shared'
import {
  type CallExpression,
  type ExpressionNode,
  NodeTypes,
  type SlotOutletNode,
  createCallExpression,
} from '../ast'
import { RENDER_SLOT } from '../runtimeHelpers'
import type { NodeTransform, TransformContext } from '../transform'
import { isSlotOutlet, isStaticArgOf, isStaticExp } from '../utils'

export const transformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { loc } = node
    const { slotName } = processSlotOutlet(node, context)
    const slotArgs: CallExpression['arguments'] = [
      context.isBrowser ? `$slots` : `_ctx.$slots`,
      slotName,
    ]

    node.codegenNode = createCallExpression(
      context.helper(RENDER_SLOT),
      slotArgs,
      loc,
    )
  }
}

interface SlotOutletProcessResult {
  slotName: string | ExpressionNode
}

function processSlotOutlet(
  node: SlotOutletNode,
  context: TransformContext,
): SlotOutletProcessResult {
  let slotName: string | ExpressionNode = `"default"`

  const nonNameProps = []
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.value) {
        if (p.name === 'name') {
          slotName = JSON.stringify(p.value.content)
        } else {
          p.name = camelize(p.name)
          nonNameProps.push(p)
        }
      }
    } else {
      if (p.name === 'bind' && isStaticArgOf(p.arg, 'name')) {
        if (p.exp) slotName = p.exp
      } else {
        if (p.name === 'bind' && p.arg && isStaticExp(p.arg)) {
          p.arg.content = camelize(p.arg.content)
        }
        nonNameProps.push(p)
      }
    }
  }

  return { slotName }
}
```

In the future, we will also add prop exploration for scoped slots here.

One point to note is that the `<slot />` element will also be caught by `transformElement`, so we will add an implementation to skip it when `ElementTypes.SLOT` is encountered.

Here is the `transformElement.ts`.

```ts
export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode!

    if ( // [!code ++]
      !( // [!code ++]
        node.type === NodeTypes.ELEMENT && // [!code ++]
        (node.tagType === ElementTypes.ELEMENT || // [!code ++]
          node.tagType === ElementTypes.COMPONENT) // [!code ++]
      ) // [!code ++]
    ) { // [!code ++]
      return // [!code ++]
    } // [!code ++]

    // ...
  }
}
```
Finally, by registering `transformSlotOutlet` in `compile.ts`, the compilation should be possible.

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformIf,
      transformFor,
      transformExpression,
      transformSlotOutlet, // [!code ++]
      transformElement,
    ],
    { bind: transformBind, on: transformOn },
  ]
}
```

We have not yet implemented the runtime function `renderSlot`, so we will do that last to complete the implementation of the slot definition.

Let's implement `packages/runtime-core/helpers/renderSlot.ts`.

```ts
import { Fragment, type VNode, createVNode } from '../vnode'
import type { Slots } from '../componentSlots'

export function renderSlot(slots: Slots, name: string): VNode {
  let slot = slots[name]
  if (!slot) {
    slot = () => []
  }

  return createVNode(Fragment, {}, slot())
}
```

The implementation of the slot definition is now complete.\
Next, let's implement the compiler for the slot insertion side!

Source code up to this point:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/080_component_slot_outlet)

## Slot Insertion

TBD
