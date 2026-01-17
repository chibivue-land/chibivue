# Supporting Props Destructure

::: info About this chapter
This chapter explains how to implement Vue 3.5's Reactive Props Destructure feature.\
Learn how to maintain reactivity while destructuring props.
:::

## What is Reactive Props Destructure?

Starting from Vue 3.5, you can destructure the return value of `defineProps` in `<script setup>`.

```vue
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

This feature makes accessing props simpler.

<KawaikoNote variant="question" title="Why is special handling needed?">

In regular JavaScript, destructuring an object copies values and breaks the connection to the original object.\
However, Vue's props need to be reactive.\
The compiler transforms destructured access to `__props.xxx` access to maintain reactivity!

</KawaikoNote>

## How It Works

Props destructure is implemented through these steps:

1. **Pattern detection**: Detect `const { ... } = defineProps(...)`
2. **Binding registration**: Register each destructured property as `PROPS`
3. **Default value handling**: Transform default values into `withDefaults` equivalent
4. **Code transformation**: Transform props access to `__props.xxx`

### Transformation Example

```vue
<!-- Input -->
<script setup>
const { count, message = 'hello' } = defineProps({
  count: Number,
  message: String
})

console.log(count, message)
</script>
```

```ts
// Output
export default {
  props: {
    count: Number,
    message: { type: String, default: 'hello' }
  },
  setup(__props) {
    console.log(__props.count, __props.message)

    return (_ctx) => {
      // ...
    }
  }
}
```

## Detecting Destructure Patterns

Detect if `defineProps` return value is assigned to an `ObjectPattern` (destructure pattern).

```ts
// packages/compiler-sfc/src/compileScript.ts

interface PropsDestructureBindings {
  [key: string]: {
    local: string      // Local variable name
    default?: string   // Default value
  }
}

let propsDestructuredBindings: PropsDestructureBindings = Object.create(null)

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  propsRuntimeDecl = node.arguments[0]

  // Handle destructure pattern
  if (declId && declId.type === "ObjectPattern") {
    processPropsDestructure(declId)
  } else if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## Processing Destructure

Extract each property from `ObjectPattern` and register as bindings.

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "ObjectProperty") {
      const key = prop.key
      const value = prop.value

      // Get property name
      let propKey: string
      if (key.type === "Identifier") {
        propKey = key.name
      } else if (key.type === "StringLiteral") {
        propKey = key.value
      } else {
        continue
      }

      // Process local variable name and default value
      let local: string
      let defaultValue: string | undefined

      if (value.type === "Identifier") {
        // const { count } = defineProps(...)
        local = value.name
      } else if (value.type === "AssignmentPattern") {
        // const { count = 0 } = defineProps(...)
        if (value.left.type === "Identifier") {
          local = value.left.name
          defaultValue = scriptSetup!.content.slice(
            value.right.start!,
            value.right.end!
          )
        } else {
          continue
        }
      } else {
        continue
      }

      // Register binding
      propsDestructuredBindings[propKey] = { local, default: defaultValue }
      bindingMetadata[local] = BindingTypes.PROPS
    }
  }
}
```

## Default Value Handling

When default values are specified in destructure, merge them into props definition.

```ts
function genRuntimeProps(): string | undefined {
  if (!propsRuntimeDecl) return undefined

  let propsString = scriptSetup!.content.slice(
    propsRuntimeDecl.start!,
    propsRuntimeDecl.end!
  )

  // Merge default values if present
  const defaults: Record<string, string> = {}
  for (const key in propsDestructuredBindings) {
    const binding = propsDestructuredBindings[key]
    if (binding.default) {
      defaults[key] = binding.default
    }
  }

  if (Object.keys(defaults).length > 0) {
    // Process equivalent to withDefaults
    propsString = mergeDefaults(propsString, defaults)
  }

  return propsString
}

function mergeDefaults(
  propsString: string,
  defaults: Record<string, string>
): string {
  // Actual implementation manipulates AST to merge defaults
  // Simplified example here
  const ast = parseExpression(propsString)
  // ... merge default values
  return generate(ast).code
}
```

## Transforming Props Access

Transform access to destructured variables into `__props.xxx` in templates and scripts.

```ts
function processPropsAccess(source: string): string {
  const s = new MagicString(source)

  // Walk identifiers and transform
  walk(scriptSetupAst, {
    enter(node: Node) {
      if (node.type === "Identifier") {
        const binding = propsDestructuredBindings[node.name]
        if (binding && binding.local === node.name) {
          // Transform to props access
          s.overwrite(node.start!, node.end!, `__props.${node.name}`)
        }
      }
    }
  })

  return s.toString()
}
```

<KawaikoNote variant="surprise" title="Compiler Magic!">

Destructuring normally loses reactivity in JavaScript,\
but the compiler transforms it to `__props.xxx` access,\
allowing you to use destructure syntax as syntactic sugar!

</KawaikoNote>

## Rest Pattern Support

Support for `...rest` patterns is also possible.

```vue
<script setup>
const { id, ...attrs } = defineProps(['id', 'class', 'style'])
</script>
```

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "RestElement") {
      // Handle rest pattern
      if (prop.argument.type === "Identifier") {
        const restName = prop.argument.name
        // rest requires special handling
        // Actually uses computed to get remaining props
        bindingMetadata[restName] = BindingTypes.SETUP_REACTIVE_CONST
      }
    }
    // ...
  }
}
```

## Testing

```vue
<!-- Parent.vue -->
<script setup>
import { ref } from 'chibivue'
import Child from './Child.vue'

const count = ref(0)
const message = ref('Hello')
</script>

<template>
  <Child :count="count" :message="message" />
  <button @click="count++">Increment</button>
</template>
```

```vue
<!-- Child.vue -->
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})

// count and message are transformed to __props.count, __props.message
console.log(count, message)
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

## Future Enhancements

Props Destructure is not yet implemented in chibivue, but these features could be considered:

- **Alias support**: Support for `const { count: c } = defineProps(...)`
- **Nested destructure**: Support for `const { user: { name } } = defineProps(...)`
- **Array patterns**: Combination with array-style props definition

<KawaikoNote variant="base" title="Try Implementing It!">

Use the concepts explained in this chapter to implement Props Destructure yourself!\
It's great practice for AST manipulation and transformation.

</KawaikoNote>

## Summary

- Props Destructure was introduced in Vue 3.5
- Detect destructure patterns and register each property as `PROPS` binding
- Default values are merged into props definition
- Transform variable access to `__props.xxx` to maintain reactivity

## References

- [Vue.js - Reactive Props Destructure](https://vuejs.org/guide/components/props.html#reactive-props-destructure) - Vue Official Documentation
- [RFC - Reactive Props Destructure](https://github.com/vuejs/rfcs/discussions/502) - Vue RFC
