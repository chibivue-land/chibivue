# Custom Directives

::: info About this chapter
This chapter implements Vue's custom directive feature.\
You will learn how to define custom directives like `v-focus` and perform direct operations on elements.
:::

## What are Custom Directives?

Vue's custom directives are a feature for performing low-level operations on DOM elements. They are used when direct DOM manipulation is needed that cannot be handled through component abstraction.

Typical use cases:

- Auto-focus on elements (`v-focus`)
- Click outside detection (`v-click-outside`)
- Lazy loading of elements (`v-lazy`)
- Tooltip display (`v-tooltip`)

```vue
<script setup>
// Define a custom directive
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

<KawaikoNote variant="warning" title="Honestly, rarely used">

Custom directives are used when you "want to directly touch the DOM", but honestly they're not used very often.\
Due to implementation changes in Vapor Mode and poor compatibility with static analysis, **if you don't need to use them, don't use them**.\
Handle things with components whenever possible!

</KawaikoNote>

## Directive Lifecycle

Directives have lifecycle hooks similar to components:

```ts
const myDirective = {
  // Before element's attributes or event listeners are applied
  created(el, binding, vnode, prevVnode) {},

  // Right before element is inserted into DOM
  beforeMount(el, binding, vnode, prevVnode) {},

  // After element is inserted into DOM
  mounted(el, binding, vnode, prevVnode) {},

  // Before parent component is updated
  beforeUpdate(el, binding, vnode, prevVnode) {},

  // After parent and children have updated
  updated(el, binding, vnode, prevVnode) {},

  // Before parent component is unmounted
  beforeUnmount(el, binding, vnode, prevVnode) {},

  // After parent component is unmounted
  unmounted(el, binding, vnode, prevVnode) {},
}
```

Each hook receives the following arguments:

- `el`: The element the directive is bound to
- `binding`: Information passed to the directive (value, argument, etc.)
- `vnode`: The VNode corresponding to el
- `prevVnode`: The previous VNode (only for beforeUpdate, updated)

## Implementation Overview

The custom directive implementation consists of three parts:

1. **Runtime side**: Directive type definitions and `withDirectives` helper
2. **Renderer side**: Hook invocation at each lifecycle
3. **Compiler side**: Generate `withDirectives` from templates

## Runtime Implementation

### Directive Type Definitions

First, define the directive types:

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

### withDirectives Helper

The compiler generates code that wraps directive-bound elements with `withDirectives`:

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
      // Convert function-style directive to object style
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

<KawaikoNote variant="funny" title="Simple!">

`withDirectives` just adds the `dirs` property to the VNode.\
The actual hook invocation is done by the renderer, so this implementation simply attaches information to the VNode!

</KawaikoNote>

### Invoking Directive Hooks

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
    // Set old value on update
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

## Renderer Implementation

The renderer calls `invokeDirectiveHook` at each timing during element mounting and updating:

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

  // Mount children
  if (typeof children === 'string') {
    hostSetElementText(el, children)
  } else if (isArray(children)) {
    mountChildren(children as VNodeArrayChildren, el, null, parentComponent)
  }

  // Directive: created hook
  dirs && invokeDirectiveHook(vnode, null, 'created')

  // Set props
  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }
  }

  // Directive: beforeMount hook
  dirs && invokeDirectiveHook(vnode, null, 'beforeMount')

  // Insert into DOM
  hostInsert(el, container, anchor!)

  // Directive: mounted hook
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

  // Directive: beforeUpdate hook
  dirs && invokeDirectiveHook(n2, n1, 'beforeUpdate')

  // Update children and props
  patchChildren(n1, n2, el, null, parentComponent)
  patchProps(el, oldProps, newProps)

  // Directive: updated hook
  dirs && invokeDirectiveHook(n2, n1, 'updated')
}
```

## Adding dirs Property to VNode

Add `dirs` to the VNode type definition:

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
  dirs?: DirectiveBinding[] | null  // Added
}
```

## Compiler Implementation

### Registering WITH_DIRECTIVES Helper

```ts
// packages/compiler-core/src/runtimeHelpers.ts

export const WITH_DIRECTIVES: unique symbol = Symbol()

export const helperNameMap: Record<symbol, string> = {
  // ...
  [WITH_DIRECTIVES]: 'withDirectives',
}
```

### Code Generation

When a VNode has directives, wrap it with `withDirectives`:

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper } = context
  const { tag, props, children, directives } = node

  // Wrap with withDirectives if directives exist
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

Example of generated code:

```ts
// Template: <input v-focus />

// Generated code
withDirectives(
  createElementVNode('input'),
  [[vFocus]]
)

// Template: <div v-my-directive:arg.modifier="value" />

// Generated code
withDirectives(
  createElementVNode('div'),
  [[vMyDirective, value, 'arg', { modifier: true }]]
)
```

## Testing

```vue
<script setup>
import { ref } from 'chibivue'

// v-focus directive
const vFocus = {
  mounted(el) {
    el.focus()
  }
}

// v-color directive
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
  <input v-focus placeholder="Auto focus" />

  <p v-color="color">This text is {{ color }}</p>

  <button @click="color = 'blue'">Make Blue</button>
  <button @click="color = 'green'">Make Green</button>
</template>
```

<KawaikoNote variant="base" title="Implementation Complete!">

The custom directive implementation is complete!\
With the runtime, renderer, and compiler working together, you can now use custom directives like `v-focus`.\
v-model is also implemented internally as a directive, so check it out!

</KawaikoNote>

## Summary

- Custom directives are a low-level API for direct DOM manipulation
- `withDirectives` attaches directive information to VNodes
- The renderer calls hooks at each lifecycle
- The compiler generates `withDirectives` from templates

## References

- [Vue.js - Custom Directives](https://vuejs.org/guide/reusability/custom-directives.html) - Vue Official Documentation
