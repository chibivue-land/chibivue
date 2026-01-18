# 基于类型的 defineProps / defineEmits

::: info 关于本章
本章介绍如何使用 TypeScript 类型参数实现 `defineProps` 和 `defineEmits`．\
学习如何从类型定义生成运行时定义．
:::

## 什么是基于类型的声明？

在 Vue 3 中，你可以使用 TypeScript 泛型声明 `defineProps` 和 `defineEmits`．

```vue
<script setup lang="ts">
// 基于类型的 defineProps
const props = defineProps<{
  count: number
  message?: string
}>()

// 基于类型的 defineEmits
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

<KawaikoNote variant="question" title="为什么基于类型更方便？">

运行时声明使用 `Number`，`String` 等，\
但基于类型的声明可以直接使用 TypeScript 的类型系统！\
IDE 的补全和错误检查也更加强大．

</KawaikoNote>

## 工作原理

基于类型的宏通过以下步骤处理：

1. **类型参数检测**：检测 `defineProps<T>()` 中的泛型
2. **类型解析**：解析 TypeScript 类型定义
3. **运行时定义生成**：从类型生成运行时 props/emits
4. **代码输出**：作为普通运行时声明输出

### 转换示例

```vue
<!-- 输入 -->
<script setup lang="ts">
const props = defineProps<{
  count: number
  message?: string
}>()
</script>
```

```ts
// 输出
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

## 检测类型参数

检测 `defineProps` 或 `defineEmits` 是否有类型参数．

```ts
// packages/compiler-sfc/src/compileScript.ts

let propsTypeDecl: TSTypeLiteral | TSInterfaceBody | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  const callExpr = node as CallExpression

  // 检查类型参数
  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    if (typeArg) {
      propsTypeDecl = resolveTypeElements(typeArg)
    }
  } else {
    // 运行时声明
    propsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}
```

## 解析类型

解析 TypeScript 类型字面量以提取属性信息．

```ts
interface PropTypeData {
  type: string[]      // 类型数组（支持联合类型）
  required: boolean   // 是否必需
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

      // 解析类型
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

## 类型到构造函数的转换

将 TypeScript 类型转换为 JavaScript 构造函数．

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
      // 联合类型返回多个构造函数
      const types: string[] = []
      for (const t of node.types) {
        // 排除 null/undefined
        if (t.type === "TSNullKeyword" || t.type === "TSUndefinedKeyword") {
          continue
        }
        types.push(...resolveType(t))
      }
      return types

    case "TSTypeReference":
      // 自定义类型和引用
      if (node.typeName.type === "Identifier") {
        const name = node.typeName.name
        // 内置类型映射
        if (name === "Array") return ["Array"]
        if (name === "Function") return ["Function"]
        if (name === "Object") return ["Object"]
        // 其他保持原样
        return [name]
      }
      return ["Object"]

    default:
      return ["null"]
  }
}
```

## 生成运行时定义

从解析的类型信息生成运行时 props 定义．

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

<KawaikoNote variant="surprise" title="编译时类型擦除！">

TypeScript 类型在编译为 JavaScript 时会消失．\
Vue 的编译器将类型信息转换为运行时定义，\
使你可以在运行时也受益于类型！

</KawaikoNote>

## defineEmits 的类型处理

`defineEmits` 同样处理类型参数．

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
  // 函数重载形式
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

## 生成 emits 运行时定义

```ts
function genRuntimeEmitsFromType(
  emitsDecl: TSFunctionType[]
): string {
  const events: string[] = []

  for (const sig of emitsDecl) {
    // 第一个参数是事件名
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

### 转换示例

```vue
<!-- 输入 -->
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

```ts
// 输出
export default {
  emits: ['change', 'update'],
  setup(__props, { emit }) {
    // ...
  }
}
```

## withDefaults 支持

要为基于类型的 props 指定默认值，使用 `withDefaults`．

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

  // 处理 defineProps
  if (isCallOf(propsCall, DEFINE_PROPS)) {
    processDefineProps(propsCall)
  }

  // 保存默认值
  if (defaultsArg) {
    propsDefaults = defaultsArg
  }

  return true
}
```

## 测试

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

## 未来扩展

当前 chibivue 未实现基于类型的宏，但可以考虑以下功能：

- **接口引用**：引用其他文件中定义的类型
- **映射类型**：`Partial<T>` 等变换类型
- **泛型组件**：带有泛型类型参数的组件
- **仅类型导入**：处理 `import type`

<KawaikoNote variant="base" title="尝试实现！">

参考本章介绍的原理，尝试自己实现基于类型的宏！\
这是学习 TypeScript AST 操作的好机会．

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/060_type_based_macros)

## 总结

- 基于类型的 defineProps/defineEmits 使用 TypeScript 类型参数
- 编译器解析类型并生成运行时定义
- TypeScript 类型映射到 JavaScript 构造函数
- 可以使用 withDefaults 指定默认值

## 参考链接

- [Vue.js - 组合式 API 与 TypeScript](https://cn.vuejs.org/guide/typescript/composition-api.html) - Vue 官方文档
- [Vue.js - 仅类型 props/emit 声明](https://cn.vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations) - Vue 官方文档
