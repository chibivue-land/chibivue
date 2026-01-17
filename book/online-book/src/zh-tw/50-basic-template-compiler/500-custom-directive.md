# 自訂指令

::: info 關於本章
本章實現 Vue 的自訂指令功能。\
您將學習如何定義像 `v-focus` 這樣的自訂指令，並對元素執行直接操作。
:::

## 什麼是自訂指令？

Vue 的自訂指令是用於對 DOM 元素執行低階操作的功能。當需要進行元件抽象無法處理的直接 DOM 操作時使用。

典型用例：

- 元素自動聚焦（`v-focus`）
- 點擊外部檢測（`v-click-outside`）
- 元素延遲載入（`v-lazy`）
- 工具提示顯示（`v-tooltip`）

```vue
<script setup>
// 定義自訂指令
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

<KawaikoNote variant="question" title="什麼時候使用？">

自訂指令用於「想直接操作 DOM」的場景。\
建議盡量用元件處理能用元件處理的事情，只在真正需要直接 DOM 操作時才使用指令！

</KawaikoNote>

## 指令生命週期

指令有類似於元件的生命週期鉤子：

```ts
const myDirective = {
  // 在元素的屬性或事件監聽器套用之前
  created(el, binding, vnode, prevVnode) {},

  // 在元素插入 DOM 之前
  beforeMount(el, binding, vnode, prevVnode) {},

  // 在元素插入 DOM 之後
  mounted(el, binding, vnode, prevVnode) {},

  // 在父元件更新之前
  beforeUpdate(el, binding, vnode, prevVnode) {},

  // 在父元件和子元件更新之後
  updated(el, binding, vnode, prevVnode) {},

  // 在父元件卸載之前
  beforeUnmount(el, binding, vnode, prevVnode) {},

  // 在父元件卸載之後
  unmounted(el, binding, vnode, prevVnode) {},
}
```

每個鉤子接收以下參數：

- `el`：指令綁定的元素
- `binding`：傳遞給指令的資訊（值、參數等）
- `vnode`：對應 el 的 VNode
- `prevVnode`：更新前的 VNode（僅 beforeUpdate、updated）

## 實現概述

自訂指令的實現由三部分組成：

1. **執行時端**：指令類型定義和 `withDirectives` 輔助函數
2. **渲染器端**：在每個生命週期呼叫鉤子
3. **編譯器端**：從模板生成 `withDirectives`

## 執行時實現

### 指令類型定義

首先，定義指令類型：

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

### withDirectives 輔助函數

編譯器生成將帶有指令的元素用 `withDirectives` 包裝的程式碼：

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
      // 將函數形式的指令轉換為物件形式
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

<KawaikoNote variant="funny" title="簡單！">

`withDirectives` 只是給 VNode 新增 `dirs` 屬性。\
實際的鉤子呼叫由渲染器完成，所以這個實現只是簡單地將資訊附加到 VNode 上！

</KawaikoNote>

### 呼叫指令鉤子

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
    // 更新時設定舊值
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

## 渲染器實現

渲染器在元素掛載和更新的各個時機呼叫 `invokeDirectiveHook`：

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

  // 掛載子元素
  if (typeof children === 'string') {
    hostSetElementText(el, children)
  } else if (isArray(children)) {
    mountChildren(children as VNodeArrayChildren, el, null, parentComponent)
  }

  // 指令：created 鉤子
  dirs && invokeDirectiveHook(vnode, null, 'created')

  // 設定 props
  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }
  }

  // 指令：beforeMount 鉤子
  dirs && invokeDirectiveHook(vnode, null, 'beforeMount')

  // 插入 DOM
  hostInsert(el, container, anchor!)

  // 指令：mounted 鉤子
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

  // 指令：beforeUpdate 鉤子
  dirs && invokeDirectiveHook(n2, n1, 'beforeUpdate')

  // 更新子元素和 props
  patchChildren(n1, n2, el, null, parentComponent)
  patchProps(el, oldProps, newProps)

  // 指令：updated 鉤子
  dirs && invokeDirectiveHook(n2, n1, 'updated')
}
```

## 向 VNode 新增 dirs 屬性

向 VNode 類型定義新增 `dirs`：

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
  dirs?: DirectiveBinding[] | null  // 新增
}
```

## 編譯器實現

### 註冊 WITH_DIRECTIVES 輔助函數

```ts
// packages/compiler-core/src/runtimeHelpers.ts

export const WITH_DIRECTIVES: unique symbol = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_DIRECTIVES]: 'withDirectives',
}
```

### 程式碼生成

當 VNode 有指令時，用 `withDirectives` 包裝：

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper } = context
  const { tag, props, children, directives } = node

  // 如果有指令，用 withDirectives 包裝
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

生成程式碼範例：

```ts
// 模板：<input v-focus />

// 生成的程式碼
withDirectives(
  createElementVNode('input'),
  [[vFocus]]
)

// 模板：<div v-my-directive:arg.modifier="value" />

// 生成的程式碼
withDirectives(
  createElementVNode('div'),
  [[vMyDirective, value, 'arg', { modifier: true }]]
)
```

## 測試

```vue
<script setup>
import { ref } from 'chibivue'

// v-focus 指令
const vFocus = {
  mounted(el) {
    el.focus()
  }
}

// v-color 指令
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
  <input v-focus placeholder="自動聚焦" />

  <p v-color="color">這段文字是 {{ color }} 色</p>

  <button @click="color = 'blue'">變藍</button>
  <button @click="color = 'green'">變綠</button>
</template>
```

<KawaikoNote variant="base" title="實現完成！">

自訂指令的實現完成了！\
透過執行時、渲染器和編譯器的協同工作，現在可以使用像 `v-focus` 這樣的自訂指令了。\
v-model 內部也是作為指令實現的，請務必查看！

</KawaikoNote>

## 總結

- 自訂指令是用於直接 DOM 操作的低階 API
- `withDirectives` 將指令資訊附加到 VNode
- 渲染器在每個生命週期呼叫鉤子
- 編譯器從模板生成 `withDirectives`

## 參考連結

- [Vue.js - 自訂指令](https://vuejs.org/guide/reusability/custom-directives.html) - Vue 官方文件
