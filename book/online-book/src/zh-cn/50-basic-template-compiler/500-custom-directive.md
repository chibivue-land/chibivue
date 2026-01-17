# 自定义指令

::: info 关于本章
本章实现 Vue 的自定义指令功能。\
您将学习如何定义像 `v-focus` 这样的自定义指令，并对元素执行直接操作。
:::

## 什么是自定义指令？

Vue 的自定义指令是用于对 DOM 元素执行低级操作的功能。当需要进行组件抽象无法处理的直接 DOM 操作时使用。

典型用例：

- 元素自动聚焦（`v-focus`）
- 点击外部检测（`v-click-outside`）
- 元素延迟加载（`v-lazy`）
- 工具提示显示（`v-tooltip`）

```vue
<script setup>
// 定义自定义指令
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

<KawaikoNote variant="question" title="什么时候使用？">

自定义指令用于"想直接操作 DOM"的场景。\
建议尽量用组件处理能用组件处理的事情，只在真正需要直接 DOM 操作时才使用指令！

</KawaikoNote>

## 指令生命周期

指令有类似于组件的生命周期钩子：

```ts
const myDirective = {
  // 在元素的属性或事件监听器应用之前
  created(el, binding, vnode, prevVnode) {},

  // 在元素插入 DOM 之前
  beforeMount(el, binding, vnode, prevVnode) {},

  // 在元素插入 DOM 之后
  mounted(el, binding, vnode, prevVnode) {},

  // 在父组件更新之前
  beforeUpdate(el, binding, vnode, prevVnode) {},

  // 在父组件和子组件更新之后
  updated(el, binding, vnode, prevVnode) {},

  // 在父组件卸载之前
  beforeUnmount(el, binding, vnode, prevVnode) {},

  // 在父组件卸载之后
  unmounted(el, binding, vnode, prevVnode) {},
}
```

每个钩子接收以下参数：

- `el`：指令绑定的元素
- `binding`：传递给指令的信息（值、参数等）
- `vnode`：对应 el 的 VNode
- `prevVnode`：更新前的 VNode（仅 beforeUpdate、updated）

## 实现概述

自定义指令的实现由三部分组成：

1. **运行时端**：指令类型定义和 `withDirectives` 辅助函数
2. **渲染器端**：在每个生命周期调用钩子
3. **编译器端**：从模板生成 `withDirectives`

## 运行时实现

### 指令类型定义

首先，定义指令类型：

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

### withDirectives 辅助函数

编译器生成将带有指令的元素用 `withDirectives` 包装的代码：

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
      // 将函数形式的指令转换为对象形式
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

<KawaikoNote variant="funny" title="简单！">

`withDirectives` 只是给 VNode 添加 `dirs` 属性。\
实际的钩子调用由渲染器完成，所以这个实现只是简单地将信息附加到 VNode 上！

</KawaikoNote>

### 调用指令钩子

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
    // 更新时设置旧值
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

## 渲染器实现

渲染器在元素挂载和更新的各个时机调用 `invokeDirectiveHook`：

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

  // 挂载子元素
  if (typeof children === 'string') {
    hostSetElementText(el, children)
  } else if (isArray(children)) {
    mountChildren(children as VNodeArrayChildren, el, null, parentComponent)
  }

  // 指令：created 钩子
  dirs && invokeDirectiveHook(vnode, null, 'created')

  // 设置 props
  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }
  }

  // 指令：beforeMount 钩子
  dirs && invokeDirectiveHook(vnode, null, 'beforeMount')

  // 插入 DOM
  hostInsert(el, container, anchor!)

  // 指令：mounted 钩子
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

  // 指令：beforeUpdate 钩子
  dirs && invokeDirectiveHook(n2, n1, 'beforeUpdate')

  // 更新子元素和 props
  patchChildren(n1, n2, el, null, parentComponent)
  patchProps(el, oldProps, newProps)

  // 指令：updated 钩子
  dirs && invokeDirectiveHook(n2, n1, 'updated')
}
```

## 向 VNode 添加 dirs 属性

向 VNode 类型定义添加 `dirs`：

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
  dirs?: DirectiveBinding[] | null  // 添加
}
```

## 编译器实现

### 注册 WITH_DIRECTIVES 辅助函数

```ts
// packages/compiler-core/src/runtimeHelpers.ts

export const WITH_DIRECTIVES: unique symbol = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_DIRECTIVES]: 'withDirectives',
}
```

### 代码生成

当 VNode 有指令时，用 `withDirectives` 包装：

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper } = context
  const { tag, props, children, directives } = node

  // 如果有指令，用 withDirectives 包装
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

生成代码示例：

```ts
// 模板：<input v-focus />

// 生成的代码
withDirectives(
  createElementVNode('input'),
  [[vFocus]]
)

// 模板：<div v-my-directive:arg.modifier="value" />

// 生成的代码
withDirectives(
  createElementVNode('div'),
  [[vMyDirective, value, 'arg', { modifier: true }]]
)
```

## 测试

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
  <input v-focus placeholder="自动聚焦" />

  <p v-color="color">这段文字是 {{ color }} 色</p>

  <button @click="color = 'blue'">变蓝</button>
  <button @click="color = 'green'">变绿</button>
</template>
```

<KawaikoNote variant="base" title="实现完成！">

自定义指令的实现完成了！\
通过运行时、渲染器和编译器的协同工作，现在可以使用像 `v-focus` 这样的自定义指令了。\
v-model 内部也是作为指令实现的，请务必查看！

</KawaikoNote>

## 总结

- 自定义指令是用于直接 DOM 操作的低级 API
- `withDirectives` 将指令信息附加到 VNode
- 渲染器在每个生命周期调用钩子
- 编译器从模板生成 `withDirectives`

## 参考链接

- [Vue.js - 自定义指令](https://cn.vuejs.org/guide/reusability/custom-directives.html) - Vue 官方文档
