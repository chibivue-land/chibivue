# Supporting defineProps

::: info About this chapter
This chapter explains how to implement the `defineProps` macro used in `<script setup>`.\
Learn how compiler macros work and how props declarations are processed.
:::

## What is defineProps?

`defineProps` is a compiler macro for declaring component props inside `<script setup>`.

```vue
<script setup>
// Runtime declaration
const props = defineProps({
  title: String,
  count: {
    type: Number,
    default: 0
  }
})

console.log(props.title)
</script>
```

<KawaikoNote variant="question" title="What's a compiler macro?">

`defineProps` is not a regular function. It's a **compiler macro**.\
It gets special treatment at compile time and is erased at runtime.\
That's why you can use it without importing!

</KawaikoNote>

## Implementation Overview

Processing defineProps involves the following steps:

1. **Detect macro calls**: Find `defineProps()` calls in the AST
2. **Extract arguments**: Get the props definition object
3. **Remove code**: Delete the original `defineProps()` call
4. **Add to options**: Add as `props` option to the output
5. **Register bindings**: Register props as `PROPS` type

## The processDefineProps Function

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_PROPS = "defineProps"

let propsRuntimeDecl: Node | undefined
let propsIdentifier: string | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  // Save the argument (props definition object)
  propsRuntimeDecl = node.arguments[0]

  // Save the identifier if assigned to a variable
  // The "props" part in const props = defineProps(...)
  if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST Traversal

We traverse the `<script setup>` body to detect `defineProps`.

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  // Expression statement (defineProps() called standalone)
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr)) {
      // Remove the macro call
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  // Variable declaration (const props = defineProps(...))
  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        if (processDefineProps(init, declId)) {
          // Remove the declaration
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## Registering Props Bindings

Variables declared as props are registered in binding metadata so they can be referenced from the template.

```ts
// 7. analyze binding metadata
if (propsRuntimeDecl) {
  for (const key of getObjectExpressionKeys(propsRuntimeDecl as ObjectExpression)) {
    bindingMetadata[key] = BindingTypes.PROPS
  }
}
```

By registering as `BindingTypes.PROPS`, the template compiler can correctly handle access to props.

## Handling Props Identifier

When assigned to a variable like `const props = defineProps(...)`, we make that variable accessible.

```ts
// 9. finalize setup() argument signature
let args = `__props`
if (propsIdentifier) {
  // Add const props = __props;
  s.prependLeft(startOffset, `\nconst ${propsIdentifier} = __props;\n`)
}
```

## Adding to Options

Finally, the props definition is output as a component option.

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  let declCode = scriptSetup.content
    .slice(propsRuntimeDecl.start!, propsRuntimeDecl.end!)
    .trim()
  runtimeOptions += `\n  props: ${declCode},`
}

s.prependLeft(
  startOffset,
  `\nexport default {\n${runtimeOptions}\nsetup(${args}) {\n`
)
```

## Transformation Example

```vue
<!-- Input -->
<script setup>
const props = defineProps({
  title: String,
  count: Number
})
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

```ts
// Output
export default {
  props: {
    title: String,
    count: Number
  },
  setup(__props) {
    const props = __props;

    return (_ctx) => {
      return h('h1', _ctx.title)
    }
  }
}
```

<KawaikoNote variant="funny" title="Simple!">

`defineProps` may look complex, but what it does is simple:
1. Move arguments to `props` option
2. Remove the `defineProps()` call
3. If there's a variable, replace with reference to `__props`

</KawaikoNote>

## Testing

```vue
<script setup>
import { computed } from 'chibivue'

const props = defineProps({
  firstName: String,
  lastName: String
})

const fullName = computed(() => `${props.firstName} ${props.lastName}`)
</script>

<template>
  <div>
    <p>First: {{ firstName }}</p>
    <p>Last: {{ lastName }}</p>
    <p>Full: {{ fullName }}</p>
  </div>
</template>
```

Parent component:

```vue
<script setup>
import ChildComponent from './ChildComponent.vue'
</script>

<template>
  <ChildComponent firstName="John" lastName="Doe" />
</template>
```

<KawaikoNote variant="base" title="Implementation Complete!">

The defineProps implementation is complete!\
You now understand the basic mechanism of compiler macros.\
In the next chapter, we'll learn how to implement the `defineEmits` macro.

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/020_define_props)

## Summary

- `defineProps` is a compiler macro processed at compile time
- Traverse the AST to detect `defineProps()` calls
- Arguments are converted to `props` option, and the call itself is removed
- Props are registered as `BindingTypes.PROPS` for template access

## References

- [Vue.js - defineProps](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue Official Documentation
