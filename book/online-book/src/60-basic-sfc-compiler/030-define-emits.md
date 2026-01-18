# Supporting defineEmits

::: info About this chapter
This chapter explains how to implement the `defineEmits` macro used in `<script setup>`.\
Learn how event emission from child to parent components works.
:::

## What is defineEmits?

`defineEmits` is a compiler macro for declaring events that a component emits inside `<script setup>`.

```vue
<script setup>
const emit = defineEmits(['change', 'update'])

function handleClick() {
  emit('change', 'new value')
}
</script>
```

<KawaikoNote variant="question" title="How is it different from defineProps?">

`defineProps` handles data flow from parent to child (Props Down),\
`defineEmits` handles event flow from child to parent (Events Up).\
They are the two wheels of Vue's bidirectional data flow!

</KawaikoNote>

## Implementation Overview

Processing defineEmits is very similar to defineProps:

1. **Detect macro calls**: Find `defineEmits()` calls in the AST
2. **Extract arguments**: Get the event definition array or object
3. **Remove code**: Delete the original `defineEmits()` call
4. **Add to options**: Add as `emits` option to the output
5. **Provide emit function**: Get `emit` from setup's context

## The processDefineEmits Function

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_EMITS = "defineEmits"

let emitsRuntimeDecl: Node | undefined
let emitIdentifier: string | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  // Save the event definition
  emitsRuntimeDecl = node.arguments[0]

  // Save the identifier if assigned to a variable
  // The "emit" part in const emit = defineEmits(...)
  if (declId) {
    emitIdentifier =
      declId.type === "Identifier"
        ? declId.name
        : scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST Traversal

Like defineProps, we traverse the `<script setup>` body to detect `defineEmits`.

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr) || processDefineEmits(expr)) {
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        const isDefineProps = processDefineProps(init, declId)
        const isDefineEmits = processDefineEmits(init, declId)
        if (isDefineProps || isDefineEmits) {
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## Setting Up the emit Function

The emit function obtained from `defineEmits` is retrieved from the setup function's second argument (SetupContext).

```ts
// 9. finalize setup() argument signature
let args = `__props`

const destructureElements: string[] = []
if (emitIdentifier) {
  destructureElements.push(
    emitIdentifier === `emit` ? `emit` : `emit: ${emitIdentifier}`
  )
}

if (destructureElements.length) {
  args += `, { ${destructureElements.join(", ")} }`
}
```

This generates code like:

```ts
// For const emit = defineEmits(['change'])
setup(__props, { emit }) {
  // ...
}

// For const emitFn = defineEmits(['change'])
setup(__props, { emit: emitFn }) {
  // ...
}
```

## Adding to Options

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  runtimeOptions += `\n  props: ${...},`
}
if (emitsRuntimeDecl) {
  runtimeOptions += `\n  emits: ${scriptSetup.content
    .slice(emitsRuntimeDecl.start!, emitsRuntimeDecl.end!)
    .trim()},`
}
```

## Transformation Example

```vue
<!-- Input -->
<script setup>
const emit = defineEmits(['update', 'delete'])

function handleUpdate(value) {
  emit('update', value)
}
</script>

<template>
  <button @click="handleUpdate('new')">Update</button>
</template>
```

```ts
// Output
export default {
  emits: ['update', 'delete'],
  setup(__props, { emit }) {
    function handleUpdate(value) {
      emit('update', value)
    }

    return (_ctx) => {
      return h('button', { onClick: _ctx.handleUpdate.bind(_ctx, 'new') }, 'Update')
    }
  }
}
```

<KawaikoNote variant="funny" title="Symmetrical with defineProps!">

The `defineEmits` implementation follows almost the same pattern as `defineProps`:
1. Detect macro call
2. Move arguments to `emits` option
3. If there's a variable, transform to get from SetupContext

Easy to remember!

</KawaikoNote>

## Testing

Child component:

```vue
<script setup>
const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue'])

function updateValue(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<template>
  <input :value="modelValue" @input="updateValue" />
</template>
```

Parent component:

```vue
<script setup>
import { ref } from 'chibivue'
import CustomInput from './CustomInput.vue'

const text = ref('')
</script>

<template>
  <CustomInput v-model="text" />
  <p>Input value: {{ text }}</p>
</template>
```

<KawaikoNote variant="base" title="Implementation Complete!">

The defineEmits implementation is complete!\
You can now use both props and emits compiler macros.\
In the next chapter, we'll learn how to implement scoped CSS.

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/030_define_emits)

## Summary

- `defineEmits` is a macro for declaring events from child to parent
- Processing pattern is very similar to `defineProps`
- emit function is destructured from SetupContext
- Added to component as `emits` option

## References

- [Vue.js - defineEmits](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue Official Documentation
