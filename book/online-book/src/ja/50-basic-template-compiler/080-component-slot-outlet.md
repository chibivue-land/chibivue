# コンポーネントのスロット

## 目指したい開発者インターフェース

Basic Component System のスロットの実装で，すでにランタイムの実装はあります．\
しかし，私たちはまだ template でスロットを扱うことができていません．

以下のような SFC を扱えるようにしたいです．\
(SFC とは言ってますが，実際には template のコンパイラの実装です．)

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

Vue.js のスロットには，いくつかの種類があります．

- デフォルトスロット
- 名前付きスロット
- スコープ付きスロット

しかし，すでにランタイムの実装を皆さんならわかると思いますが，これらは全てただの callback 関数です．\
念の為おさらいしておきましょう．

上記のようなコンポーネントは，以下のような render 関数に変換されます．

```js
h(Comp, null, {
  default: () =>
    h('button', { onClick: () => count.value++ }, `count is: ${count.value}`),
})

```

template 上では `name="default"` を省略することが可能ですが，依然としてそうであってもランタイム上は `default` という名前のスロットになります．\
この実装は名前付きスロットのコンパイラの実装が終わった後で，デフォルトスロットのコンパイラの実装を行うことにしましょう．

## コンパイラを実装していく (スロットの定義)

例の如く，parse と codegen の処理を実装していくのですが，今回はスロットの定義の方と，スロットの挿入の方の処理を実装していきます．

まずはスロットの定義の方です．\
子コンポーネント側で `<slot name="my-slot"/>` として表現される部分のコンパイルです．

ランタイムの方では，`renderSlot` というヘルパー関数を用意し，コンポーネントのインスタンスを通じて (`ctx.$slot` を通じて) 挿入されるスロットと，その名前を引数に渡してあげるような形にします．\
ソースコード的には概ね以下のような形にコンパイルします．

```js
_renderSlot(_ctx.$slots, "my-slot")
```

slot の定義は AST 上は `SlotOutletNode` というノードで表現することにします．\
`ast.ts` に以下のような定義を追加します．

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

それでは，この AST を生成するために parse の処理を書いていきましょう．

`parse.ts` です．やることは簡単で，tag をパースする際に `"slot"` であれば `ElementTypes.SLOT` に変更するだけです．

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

ここまでできたら次は transformer を実装して codegenNode を生成していきます．\
ヘルパー関数の `JS_CALL_EXPRESSION` にしてあげれば OK です．

下準備として，`runtimeHelper.ts` に `RENDER_SLOT` を追加しておきます．

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

新たに `transformSlotOutlet` という transformer を実装します．\
やることはとても簡単で，`ElementType.SLOT` である時に `node.props` から `name` を探しつつ，`RENDER_SLOT` の `JS_CALL_EXPRESSION` を生成してあげます．\
`:name="slotName"` のようにバインディングであった場合も考慮してあげます．

シンプルなので，transformer の全貌を以下に貼っておきます．(読んでみてください．)

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

ゆくゆくはここにスコープ付きスロットのための props 探索等も追加していくことになるでしょう．

一点，注意点としては，`<slot />` という要素は transformElement の方でも引っかかってしまうので，`ElementTypes.SLOT` である時はそちらはスキップするように実装を追加しておきます．

`transformElement.ts` です．

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

あとは `compile.ts` で `transformSlotOutlet` を登録してあげればコンパイルはできるようになるはずです．

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

まだ，`renderSlot` というランタイムの関数は実装できていないので，そちらを最後に行ってスロットの定義の実装は終わりです．

`packages/runtime-core/helpers/renderSlot.ts` を実装します．

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

ここまででスロットの定義の実装は終わりです．\
次はスロットの挿入側のコンパイラを実装していきましょう！

ここまでのソースコード:\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/080_component_slot_outlet)