# スロットに対応する (利用編)

## スロットの挿入

続いてスロットの挿入側の実装です．\
こちらは親コンポーネント側で `<template #slot-name>` として表現される部分のコンパイルです．

冒頭で説明した通り，スロットは以下のようにコンパイルされます．

```js
h(Comp, null, {
  default: _withCtx(() => [
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
  ]),
})
```

つまり，コンポーネントの子要素は `SlotsExpression` (ObjectExpression) として扱われ，各スロットは `FunctionExpression` として生成され，`withCtx` でラップされます．

## withCtx の役割

`withCtx` はスロット関数を正しいコンポーネントインスタンスのコンテキストで実行するためのヘルパー関数です．これにより，スロット内のリアクティブな依存関係が正しいコンポーネントに追跡されます．

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

## AST の更新

まずは AST の定義を更新します．\
`SlotsExpression` という型を追加し，スロット関数であることを示すために `FunctionExpression` に `isSlot` フラグを追加します．

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

また，`VNodeCall` の `children` 型に `SlotsExpression` を追加します．

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

## ヘルパーの追加

`runtimeHelpers.ts` に `WITH_CTX` を追加します．

```ts
export const WITH_CTX = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_CTX]: 'withCtx',
}
```

## ユーティリティ関数の追加

`utils.ts` に `findDir` と `isTemplateNode` というユーティリティ関数を追加します．

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

`isTemplateNode` は `<template>` タグであるかを判定し，`findDir` は指定した名前のディレクティブを探します．

## buildSlots の実装

スロットの挿入を処理する `buildSlots` 関数を `transforms/vSlot.ts` に実装します．

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

`buildSlots` 関数は以下の 3 つのパターンを処理します:

1. **コンポーネント自体に v-slot がある場合** (`<Comp v-slot="{ prop }"/>`)
2. **template タグで名前付きスロットを定義する場合** (`<template #foo>`)
3. **暗黙のデフォルトスロット** (名前付きスロットがない場合の子要素)

## transformElement の更新

最後に `transformElement.ts` を更新して，コンポーネントの子要素を `buildSlots` で処理するようにします．

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

これでスロットの挿入側のコンパイルが完了です．\
コンポーネントの子要素は自動的にスロットオブジェクトに変換され，以下のようなコードが生成されます．

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

これで基本的なスロットのコンパイラ実装は完了です！

ここまでのソースコード:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/085_component_slot_insert)
