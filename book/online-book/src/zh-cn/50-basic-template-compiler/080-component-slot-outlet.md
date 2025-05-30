# 组件插槽

## 期望的开发者接口

我们已经有了基本组件系统插槽实现的运行时实现。\
但是，我们仍然无法在模板中处理插槽。

我们希望处理如下的 SFC：\
（虽然我们说 SFC，但实际上是模板编译器的实现。）

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

Vue.js 中有几种类型的插槽：

- 默认插槽
- 具名插槽
- 作用域插槽

但是，正如您可能已经从运行时实现中了解到的，这些都只是回调函数。让我们回顾一下以防万一。

像上面这样的组件被转换为如下的渲染函数。

```js
h(Comp, null, {
  default: () =>
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
})

```

在模板中，`name="default"` 属性可以省略，但在运行时，它仍然会被视为名为 `default` 的插槽。我们将在完成具名插槽的实现后实现默认插槽的编译器。

## 实现编译器（插槽定义）

像往常一样，我们将实现解析和代码生成过程，但这次我们将处理插槽定义和插槽插入。

首先，让我们专注于插槽定义。这是在子组件端表示为 `<slot name="my-slot"/>` 的部分。

在运行时，我们将准备一个名为 `renderSlot` 的辅助函数，它将通过组件实例（通过 `ctx.$slot`）插入的插槽及其名称作为参数。源代码将被编译为如下内容：

```js
_renderSlot(_ctx.$slots, "my-slot")
```

我们将在 AST 中将插槽定义表示为名为 `SlotOutletNode` 的节点。\
将以下定义添加到 `ast.ts`。

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

让我们编写解析过程来生成这个 AST。

在 `parse.ts` 中，任务很简单：在解析标签时，如果是 `"slot"`，将其更改为 `ElementTypes.SLOT`。

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

现在我们已经到了这一点，下一步是实现转换器来生成 `codegenNode`。\
我们需要为辅助函数创建一个 `JS_CALL_EXPRESSION`。

作为预备步骤，将 `RENDER_SLOT` 添加到 `runtimeHelper.ts`。

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

我们将实现一个名为 `transformSlotOutlet` 的新转换器。\
任务非常简单：当遇到 `ElementType.SLOT` 时，我们在 `node.props` 中搜索 `name` 并为 `RENDER_SLOT` 生成一个 `JS_CALL_EXPRESSION`。\
我们还考虑名称被绑定的情况，例如 `:name="slotName"`。

由于它很直接，这里是完整的转换器代码（请通读）。

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

将来，我们还将在这里添加作用域插槽的属性探索。

需要注意的一点是 `<slot />` 元素也会被 `transformElement` 捕获，所以我们将添加一个实现，在遇到 `ElementTypes.SLOT` 时跳过它。

这是 `transformElement.ts`。

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
最后，通过在 `compile.ts` 中注册 `transformSlotOutlet`，应该可以进行编译。

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

我们还没有实现运行时函数 `renderSlot`，所以我们将最后做这件事来完成插槽定义的实现。

让我们实现 `packages/runtime-core/helpers/renderSlot.ts`。

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

插槽定义的实现现在已完成。\
接下来，让我们实现插槽插入端的编译器！

到此为止的源代码：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/080_component_slot_outlet)

## 插槽插入

TBD
