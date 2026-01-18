# カスタムディレクティブ

::: info この章について
この章では，Vue のカスタムディレクティブ機能を実装します．\
`v-focus` のような独自のディレクティブを定義し，要素に対して直接操作を行う方法を学びます．
:::

## カスタムディレクティブとは

Vue のカスタムディレクティブは，DOM 要素に対して低レベルの操作を行うための機能です．コンポーネントの抽象化では対応しきれないような，DOM の直接操作が必要な場面で使用されます．

典型的な使用例：

- 要素への自動フォーカス（`v-focus`）
- クリック外検出（`v-click-outside`）
- 要素の遅延読み込み（`v-lazy`）
- ツールチップの表示（`v-tooltip`）

```vue
<script setup>
// カスタムディレクティブの定義
const vFocus = {
  mounted(el) {
    el.focus()
  }
}
</script>

<template>
  <input v-focus />
</template>
```

<KawaikoNote variant="warning" title="正直あまり使わない">

カスタムディレクティブは「DOM を直接触りたいとき」に使いますが，正直あまり使われていません．\
Vapor Mode での実装変更や静的解析との相性の悪さもあり，**使わなくていいなら使わなくていい** という機能です．\
コンポーネントで対応できることは基本的にコンポーネントで行いましょう！

</KawaikoNote>

## ディレクティブのライフサイクル

ディレクティブにはコンポーネントと同様にライフサイクルフックがあります：

```ts
const myDirective = {
  // 要素の属性や イベントリスナーが適用される前
  created(el, binding, vnode, prevVnode) {},

  // 要素が DOM に挿入される直前
  beforeMount(el, binding, vnode, prevVnode) {},

  // 要素が DOM に挿入された後
  mounted(el, binding, vnode, prevVnode) {},

  // 親コンポーネントが更新される前
  beforeUpdate(el, binding, vnode, prevVnode) {},

  // 親コンポーネントと子の更新後
  updated(el, binding, vnode, prevVnode) {},

  // 親コンポーネントがアンマウントされる前
  beforeUnmount(el, binding, vnode, prevVnode) {},

  // 親コンポーネントがアンマウントされた後
  unmounted(el, binding, vnode, prevVnode) {},
}
```

各フックには以下の引数が渡されます：

- `el`: ディレクティブがバインドされた要素
- `binding`: ディレクティブに渡された情報（値，引数など）
- `vnode`: el に対応する VNode
- `prevVnode`: 更新前の VNode（beforeUpdate, updated のみ）

## 実装の概要

カスタムディレクティブの実装は 3 つの部分から構成されています：

1. **ランタイム側**: ディレクティブの型定義と `withDirectives` ヘルパー
2. **レンダラー側**: 各ライフサイクルでのフック呼び出し
3. **コンパイラ側**: テンプレートから `withDirectives` を生成

## ランタイムの実装

### ディレクティブの型定義

まず，ディレクティブの型を定義します：

```ts
// packages/runtime-core/src/directives.ts

export interface DirectiveBinding<V = any> {
  instance: ComponentPublicInstance | null
  value: V
  oldValue: V | null
  arg?: string
  dir: ObjectDirective<any>
}

export type DirectiveHook<T = any> = (
  el: T,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null
) => void

export interface ObjectDirective<T = any> {
  created?: DirectiveHook<T>
  beforeMount?: DirectiveHook<T>
  mounted?: DirectiveHook<T>
  beforeUpdate?: DirectiveHook<T>
  updated?: DirectiveHook<T>
  beforeUnmount?: DirectiveHook<T>
  unmounted?: DirectiveHook<T>
}
```

### withDirectives ヘルパー

コンパイラは，ディレクティブ付きの要素を `withDirectives` でラップしたコードを生成します：

```ts
// packages/runtime-core/src/directives.ts

export type DirectiveArguments = Array<
  | [ObjectDirective | undefined]
  | [ObjectDirective | undefined, any]
  | [ObjectDirective | undefined, any, string]
>

export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments
): T {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) return vnode

  const instance = internalInstance.proxy

  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg] = directives[i]
    if (dir) {
      // 関数形式のディレクティブをオブジェクト形式に変換
      if (isFunction(dir)) {
        dir = {
          mounted: dir,
          updated: dir,
        } as ObjectDirective
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
      })
    }
  }
  return vnode
}
```

<KawaikoNote variant="funny" title="シンプル！">

`withDirectives` は VNode に `dirs` プロパティを追加するだけです．\
実際のフック呼び出しはレンダラーが行うので，ここでは情報を VNode に付与するだけの単純な実装です！

</KawaikoNote>

### ディレクティブフックの呼び出し

```ts
// packages/runtime-core/src/directives.ts

export function invokeDirectiveHook(
  vnode: VNode,
  prevVNode: VNode | null,
  name: keyof ObjectDirective
): void {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!

  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    // 更新時は前の値を設定
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }

    const hook = binding.dir[name] as DirectiveHook | undefined
    if (hook) {
      hook(vnode.el, binding, vnode, prevVNode)
    }
  }
}
```

## レンダラーの実装

レンダラーでは，要素のマウントと更新の各タイミングで `invokeDirectiveHook` を呼び出します：

```ts
// packages/runtime-core/src/renderer.ts

const mountElement = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null
) => {
  const { type, props, children, dirs } = vnode

  const el = (vnode.el = hostCreateElement(type as string))

  // 子要素のマウント
  if (typeof children === 'string') {
    hostSetElementText(el, children)
  } else if (isArray(children)) {
    mountChildren(children as VNodeArrayChildren, el, null, parentComponent)
  }

  // ディレクティブ: created フック
  dirs && invokeDirectiveHook(vnode, null, 'created')

  // props の設定
  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }
  }

  // ディレクティブ: beforeMount フック
  dirs && invokeDirectiveHook(vnode, null, 'beforeMount')

  // DOM への挿入
  hostInsert(el, container, anchor!)

  // ディレクティブ: mounted フック
  dirs && invokeDirectiveHook(vnode, null, 'mounted')
}

const patchElement = (
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInternalInstance | null
) => {
  const el = (n2.el = n1.el!)
  const { dirs } = n2
  const oldProps = n1.props ?? {}
  const newProps = n2.props ?? {}

  // ディレクティブ: beforeUpdate フック
  dirs && invokeDirectiveHook(n2, n1, 'beforeUpdate')

  // 子要素と props の更新
  patchChildren(n1, n2, el, null, parentComponent)
  patchProps(el, oldProps, newProps)

  // ディレクティブ: updated フック
  dirs && invokeDirectiveHook(n2, n1, 'updated')
}
```

## VNode への dirs プロパティ追加

VNode の型定義に `dirs` を追加します：

```ts
// packages/runtime-core/src/vnode.ts

export interface VNode<ExtraProps = { [key: string]: any }> {
  type: VNodeTypes
  props: (VNodeProps & ExtraProps) | null
  children: VNodeNormalizedChildren
  el: RendererNode | null
  key: string | number | symbol | null
  ref: Ref | null
  shapeFlag: number
  dirs?: DirectiveBinding[] | null  // 追加
}
```

## コンパイラの実装

### WITH_DIRECTIVES ヘルパーの登録

```ts
// packages/compiler-core/src/runtimeHelpers.ts

export const WITH_DIRECTIVES: unique symbol = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_DIRECTIVES]: 'withDirectives',
}
```

### コード生成

VNode にディレクティブがある場合，`withDirectives` でラップします：

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper } = context
  const { tag, props, children, directives } = node

  // ディレクティブがある場合は withDirectives でラップ
  if (directives) {
    push(helper(WITH_DIRECTIVES) + `(`)
  }

  push(helper(CREATE_ELEMENT_VNODE) + `(`, node)
  genNodeList(genNullableArgs([tag, props, children]), context)
  push(`)`)

  if (directives) {
    push(`, `)
    genNode(directives, context)
    push(`)`)
  }
}
```

生成されるコードの例：

```ts
// テンプレート: <input v-focus />

// 生成されるコード
withDirectives(
  createElementVNode('input'),
  [[vFocus]]
)

// テンプレート: <div v-my-directive:arg.modifier="value" />

// 生成されるコード
withDirectives(
  createElementVNode('div'),
  [[vMyDirective, value, 'arg', { modifier: true }]]
)
```

## 動作確認

```vue
<script setup>
import { ref } from 'chibivue'

// v-focus ディレクティブ
const vFocus = {
  mounted(el) {
    el.focus()
  }
}

// v-color ディレクティブ
const vColor = {
  mounted(el, binding) {
    el.style.color = binding.value
  },
  updated(el, binding) {
    el.style.color = binding.value
  }
}

const color = ref('red')
</script>

<template>
  <input v-focus placeholder="自動フォーカス" />

  <p v-color="color">この文字は {{ color }} 色です</p>

  <button @click="color = 'blue'">青にする</button>
  <button @click="color = 'green'">緑にする</button>
</template>
```

<KawaikoNote variant="base" title="実装完了！">

カスタムディレクティブの実装が完了しました！\
ランタイム，レンダラー，コンパイラの 3 つが連携して動作することで，`v-focus` のような独自ディレクティブが使えるようになりました．\
v-model も内部的にはディレクティブとして実装されていますので，ぜひ確認してみてください！

</KawaikoNote>

## まとめ

- カスタムディレクティブは DOM を直接操作する低レベル API
- `withDirectives` で VNode にディレクティブ情報を付与
- レンダラーが各ライフサイクルでフックを呼び出し
- コンパイラはテンプレートから `withDirectives` を生成

## 参考リンク

- [Vue.js - カスタムディレクティブ](https://vuejs.org/guide/reusability/custom-directives.html) - Vue 公式ドキュメント
