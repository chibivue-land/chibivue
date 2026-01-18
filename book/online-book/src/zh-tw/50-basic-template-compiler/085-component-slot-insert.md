# 支援插槽（使用）

## 插槽插入

接下來是插槽插入端的實現．\
這是在父組件端表示為 `<template #slot-name>` 的部分的編譯．

正如開頭所解釋的，插槽被編譯為如下程式碼．

```js
h(Comp, null, {
  default: _withCtx(() => [
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
  ]),
})
```

也就是說，組件的子元素被作為 `SlotsExpression`（ObjectExpression）處理，每個插槽作為 `FunctionExpression` 產生，並用 `withCtx` 包裝．

## withCtx 的作用

`withCtx` 是一個輔助函式，用於在正確的組件實例上下文中執行插槽函式．這確保了插槽內的響應式依賴被追蹤到正確的組件．

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

## 更新 AST

首先，讓我們更新 AST 定義．\
新增一個名為 `SlotsExpression` 的類型，並在 `FunctionExpression` 中新增一個 `isSlot` 標誌來表示它是一個插槽函式．

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

此外，將 `SlotsExpression` 新增到 `VNodeCall` 的 `children` 類型中．

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

## 新增輔助函式

在 `runtimeHelpers.ts` 中新增 `WITH_CTX`．

```ts
export const WITH_CTX = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_CTX]: 'withCtx',
}
```

## 新增工具函式

在 `utils.ts` 中新增 `findDir` 和 `isTemplateNode` 工具函式．

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

`isTemplateNode` 判斷是否是 `<template>` 標籤，`findDir` 查詢指定名稱的指令．

## 實現 buildSlots

在 `transforms/vSlot.ts` 中實現處理插槽插入的 `buildSlots` 函式．

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

`buildSlots` 函式處理以下三種模式：

1. **組件本身有 v-slot 的情況**（`<Comp v-slot="{ prop }"/>`）
2. **使用 template 標籤定義具名插槽的情況**（`<template #foo>`）
3. **隱式預設插槽**（沒有具名插槽時的子元素）

## 更新 transformElement

最後，更新 `transformElement.ts`，使用 `buildSlots` 處理組件的子元素．

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

這樣，插槽插入端的編譯就完成了．\
組件的子元素會自動轉換為插槽物件，產生如下程式碼．

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

基本的插槽編譯器實現現在已完成！

到此為止的原始碼：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/085_component_slot_insert)
