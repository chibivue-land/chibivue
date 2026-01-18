# 支持插槽（使用）

## 插槽插入

接下来是插槽插入端的实现．\
这是在父组件端表示为 `<template #slot-name>` 的部分的编译．

正如开头所解释的，插槽被编译为如下代码．

```js
h(Comp, null, {
  default: _withCtx(() => [
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
  ]),
})
```

也就是说，组件的子元素被作为 `SlotsExpression`（ObjectExpression）处理，每个插槽作为 `FunctionExpression` 生成，并用 `withCtx` 包装．

## withCtx 的作用

`withCtx` 是一个辅助函数，用于在正确的组件实例上下文中执行插槽函数．这确保了插槽内的响应式依赖被追踪到正确的组件．

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

首先，让我们更新 AST 定义．\
添加一个名为 `SlotsExpression` 的类型，并在 `FunctionExpression` 中添加一个 `isSlot` 标志来表示它是一个插槽函数．

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

此外，将 `SlotsExpression` 添加到 `VNodeCall` 的 `children` 类型中．

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

## 添加辅助函数

在 `runtimeHelpers.ts` 中添加 `WITH_CTX`．

```ts
export const WITH_CTX = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_CTX]: 'withCtx',
}
```

## 添加工具函数

在 `utils.ts` 中添加 `findDir` 和 `isTemplateNode` 工具函数．

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

`isTemplateNode` 判断是否是 `<template>` 标签，`findDir` 查找指定名称的指令．

## 实现 buildSlots

在 `transforms/vSlot.ts` 中实现处理插槽插入的 `buildSlots` 函数．

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

`buildSlots` 函数处理以下三种模式：

1. **组件本身有 v-slot 的情况**（`<Comp v-slot="{ prop }"/>`）
2. **使用 template 标签定义具名插槽的情况**（`<template #foo>`）
3. **隐式默认插槽**（没有具名插槽时的子元素）

## 更新 transformElement

最后，更新 `transformElement.ts`，使用 `buildSlots` 处理组件的子元素．

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

这样，插槽插入端的编译就完成了．\
组件的子元素会自动转换为插槽对象，生成如下代码．

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

基本的插槽编译器实现现在已完成！

到此为止的源代码：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/085_component_slot_insert)
