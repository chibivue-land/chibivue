# 組件插槽

## 期望的開發者介面

我們已經有了基本組件系統插槽實現的執行時實現．\
但是，我們仍然無法在模板中處理插槽．

我們希望處理如下的 SFC：\
（雖然我們說 SFC，但實際上是模板編譯器的實現．）

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

Vue.js 中有幾種類型的插槽：

- 預設插槽
- 具名插槽
- 作用域插槽

但是，正如您可能已經從執行時實現中了解到的，這些都只是回呼函式．讓我們回顧一下以防萬一．

像上面這樣的組件被轉換為如下的渲染函式．

```js
h(Comp, null, {
  default: () =>
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
})

```

在模板中，`name="default"` 屬性可以省略，但在執行時，它仍然會被視為名為 `default` 的插槽．我們將在完成具名插槽的實現後實現預設插槽的編譯器．

## 實現編譯器（插槽定義）

像往常一樣，我們將實現解析和程式碼產生過程，但這次我們將處理插槽定義和插槽插入．

首先，讓我們專注於插槽定義．這是在子組件端表示為 `<slot name="my-slot"/>` 的部分．

在執行時，我們將準備一個名為 `renderSlot` 的輔助函式，它將透過組件實例（透過 `ctx.$slot`）插入的插槽及其名稱作為參數．原始碼將被編譯為如下內容：

```js
_renderSlot(_ctx.$slots, "my-slot")
```

我們將在 AST 中將插槽定義表示為名為 `SlotOutletNode` 的節點．\
將以下定義新增到 `ast.ts`．

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

讓我們編寫解析過程來產生這個 AST．

在 `parse.ts` 中，任務很簡單：在解析標籤時，如果是 `"slot"`，將其更改為 `ElementTypes.SLOT`．

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

現在我們已經到了這一點，下一步是實現轉換器來產生 `codegenNode`．\
我們需要為輔助函式建立一個 `JS_CALL_EXPRESSION`．

作為預備步驟，將 `RENDER_SLOT` 新增到 `runtimeHelper.ts`．

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

我們將實現一個名為 `transformSlotOutlet` 的新轉換器．\
任務非常簡單：當遇到 `ElementType.SLOT` 時，我們在 `node.props` 中搜尋 `name` 並為 `RENDER_SLOT` 產生一個 `JS_CALL_EXPRESSION`．\
我們還考慮名稱被繫結的情況，例如 `:name="slotName"`．

由於它很直接，這裡是完整的轉換器程式碼（請通讀）．

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

將來，我們還將在這裡新增作用域插槽的屬性探索．

需要注意的一點是 `<slot />` 元素也會被 `transformElement` 捕獲，所以我們將新增一個實現，在遇到 `ElementTypes.SLOT` 時跳過它．

這是 `transformElement.ts`．

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
最後，透過在 `compile.ts` 中註冊 `transformSlotOutlet`，應該可以進行編譯．

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

我們還沒有實現執行時函式 `renderSlot`，所以我們將最後做這件事來完成插槽定義的實現．

讓我們實現 `packages/runtime-core/helpers/renderSlot.ts`．

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

插槽定義的實現現在已完成．\
接下來，讓我們實現插槽插入端的編譯器！

到此為止的原始碼：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/080_component_slot_outlet)
