# Type-based defineProps / defineEmits

::: info About this chapter
This chapter explains how to implement `defineProps` and `defineEmits` using TypeScript type arguments.\
Learn how to generate runtime definitions from type definitions.
:::

## What are Type-based Declarations?

In Vue 3, you can declare `defineProps` and `defineEmits` using TypeScript generics.

```vue
<script setup lang="ts">
// Type-based defineProps
const props = defineProps<{
  count: number
  message?: string
}>()

// Type-based defineEmits
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

<KawaikoNote variant="question" title="Why are type-based declarations convenient?">

Runtime declarations use `Number`, `String`, etc.,\
but with type-based declarations, you can use TypeScript's type system directly!\
IDE completion and error checking become more powerful.

</KawaikoNote>

## How It Works

Type-based macros are processed through these steps:

1. **Type argument detection**: Detect generics in `defineProps<T>()`
2. **Type parsing**: Parse TypeScript type definitions
3. **Runtime definition generation**: Generate runtime props/emits from types
4. **Code output**: Output as regular runtime declarations

### Transformation Example

```vue
<!-- Input -->
<script setup lang="ts">
const props = defineProps<{
  count: number
  message?: string
}>()
</script>
```

```ts
// Output
export default {
  props: {
    count: { type: Number, required: true },
    message: { type: String, required: false }
  },
  setup(__props) {
    // ...
  }
}
```

## Detecting Type Arguments

Detect if `defineProps` or `defineEmits` has type arguments.

```ts
// packages/compiler-sfc/src/compileScript.ts

let propsTypeDecl: TSTypeLiteral | TSInterfaceBody | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  const callExpr = node as CallExpression

  // Check type arguments
  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    if (typeArg) {
      propsTypeDecl = resolveTypeElements(typeArg)
    }
  } else {
    // Runtime declaration
    propsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}
```

## Parsing Types

Parse TypeScript type literals to extract property information.

```ts
interface PropTypeData {
  type: string[]      // Array of types (for Union support)
  required: boolean   // Whether required
}

function extractPropsFromType(
  typeDecl: TSTypeLiteral | TSInterfaceBody
): Record<string, PropTypeData> {
  const props: Record<string, PropTypeData> = {}

  const members = typeDecl.type === "TSTypeLiteral"
    ? typeDecl.members
    : typeDecl.body

  for (const member of members) {
    if (member.type === "TSPropertySignature") {
      const key = member.key
      if (key.type !== "Identifier") continue

      const propName = key.name
      const isOptional = !!member.optional

      // Parse type
      const types = member.typeAnnotation
        ? resolveType(member.typeAnnotation.typeAnnotation)
        : ["null"]

      props[propName] = {
        type: types,
        required: !isOptional
      }
    }
  }

  return props
}
```

## Converting Types to Constructors

Convert TypeScript types to JavaScript constructors.

```ts
function resolveType(node: TSType): string[] {
  switch (node.type) {
    case "TSStringKeyword":
      return ["String"]

    case "TSNumberKeyword":
      return ["Number"]

    case "TSBooleanKeyword":
      return ["Boolean"]

    case "TSArrayType":
      return ["Array"]

    case "TSFunctionType":
      return ["Function"]

    case "TSObjectKeyword":
    case "TSTypeLiteral":
      return ["Object"]

    case "TSUnionType":
      // Union types return multiple constructors
      const types: string[] = []
      for (const t of node.types) {
        // Exclude null/undefined
        if (t.type === "TSNullKeyword" || t.type === "TSUndefinedKeyword") {
          continue
        }
        types.push(...resolveType(t))
      }
      return types

    case "TSTypeReference":
      // Custom types and references
      if (node.typeName.type === "Identifier") {
        const name = node.typeName.name
        // Built-in type mapping
        if (name === "Array") return ["Array"]
        if (name === "Function") return ["Function"]
        if (name === "Object") return ["Object"]
        // Others as-is
        return [name]
      }
      return ["Object"]

    default:
      return ["null"]
  }
}
```

## Generating Runtime Definition

Generate runtime props definition from parsed type information.

```ts
function genRuntimePropsFromType(
  propsDecl: Record<string, PropTypeData>
): string {
  const props: string[] = []

  for (const [key, { type, required }] of Object.entries(propsDecl)) {
    const typeStr = type.length === 1
      ? type[0]
      : `[${type.join(", ")}]`

    if (required) {
      props.push(`${key}: { type: ${typeStr}, required: true }`)
    } else {
      props.push(`${key}: { type: ${typeStr}, required: false }`)
    }
  }

  return `{ ${props.join(", ")} }`
}
```

## defineEmits Type Processing

`defineEmits` processes type arguments similarly.

```ts
let emitsTypeDecl: TSFunctionType[] | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  const callExpr = node as CallExpression

  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    emitsTypeDecl = resolveEmitsTypeElements(typeArg)
  } else {
    emitsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}

function resolveEmitsTypeElements(
  typeArg: TSType
): TSFunctionType[] | undefined {
  // Function overload format
  if (typeArg.type === "TSTypeLiteral") {
    return typeArg.members
      .filter((m): m is TSCallSignatureDeclaration =>
        m.type === "TSCallSignatureDeclaration"
      )
      .map(m => m as unknown as TSFunctionType)
  }
  return undefined
}
```

## Generating emits Runtime Definition

```ts
function genRuntimeEmitsFromType(
  emitsDecl: TSFunctionType[]
): string {
  const events: string[] = []

  for (const sig of emitsDecl) {
    // First argument is event name
    const firstParam = sig.parameters?.[0]
    if (firstParam?.type === "Identifier" && firstParam.typeAnnotation) {
      const typeAnn = firstParam.typeAnnotation.typeAnnotation
      if (typeAnn.type === "TSLiteralType" &&
          typeAnn.literal.type === "StringLiteral") {
        events.push(`"${typeAnn.literal.value}"`)
      }
    }
  }

  return `[${events.join(", ")}]`
}
```

### Transformation Example

```vue
<!-- Input -->
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

```ts
// Output
export default {
  emits: ['change', 'update'],
  setup(__props, { emit }) {
    // ...
  }
}
```

## withDefaults Support

To specify default values with type-based props, use `withDefaults`.

```vue
<script setup lang="ts">
interface Props {
  count: number
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: 'default message'
})
</script>
```

```ts
const WITH_DEFAULTS = "withDefaults"

function processWithDefaults(node: Node): boolean {
  if (!isCallOf(node, WITH_DEFAULTS)) {
    return false
  }

  const [propsCall, defaultsArg] = node.arguments

  // Process defineProps
  if (isCallOf(propsCall, DEFINE_PROPS)) {
    processDefineProps(propsCall)
  }

  // Save default values
  if (defaultsArg) {
    propsDefaults = defaultsArg
  }

  return true
}
```

## Testing

```vue
<!-- TypedComponent.vue -->
<script setup lang="ts">
interface Props {
  id: number
  name: string
  active?: boolean
}

interface Emits {
  (e: 'select', id: number): void
  (e: 'update', name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleClick() {
  emit('select', props.id)
}
</script>

<template>
  <div @click="handleClick">
    {{ name }} ({{ active ? 'active' : 'inactive' }})
  </div>
</template>
```

## Future Enhancements

These features could also be considered:

- **Interface references**: Referencing types defined in other files
- **Mapped Types**: Transform types like `Partial<T>`
- **Generic components**: Components with generic type parameters
- **Type-only imports**: Processing `import type`

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/060_type_based_macros)

## Summary

- Type-based defineProps/defineEmits use TypeScript type arguments
- Compiler parses types and generates runtime definitions
- TypeScript types are mapped to JavaScript constructors
- Default values can be specified with withDefaults

## References

- [Vue.js - TypeScript with Composition API](https://vuejs.org/guide/typescript/composition-api.html) - Vue Official Documentation
- [Vue.js - Type-only props/emit declarations](https://vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations) - Vue Official Documentation
