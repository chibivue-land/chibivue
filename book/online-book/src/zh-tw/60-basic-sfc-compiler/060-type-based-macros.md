# 基於類型的 defineProps / defineEmits

::: info 關於本章
本章介紹如何使用 TypeScript 類型參數實現 `defineProps` 和 `defineEmits`．\
學習如何從類型定義生成執行時定義．
:::

## 什麼是基於類型的宣告？

在 Vue 3 中，你可以使用 TypeScript 泛型宣告 `defineProps` 和 `defineEmits`．

```vue
<script setup lang="ts">
// 基於類型的 defineProps
const props = defineProps<{
  count: number
  message?: string
}>()

// 基於類型的 defineEmits
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

<KawaikoNote variant="question" title="為什麼基於類型更方便？">

執行時宣告使用 `Number`，`String` 等，\
但基於類型的宣告可以直接使用 TypeScript 的類型系統！\
IDE 的補全和錯誤檢查也更加強大．

</KawaikoNote>

## 工作原理

基於類型的巨集通過以下步驟處理：

1. **類型參數檢測**：檢測 `defineProps<T>()` 中的泛型
2. **類型解析**：解析 TypeScript 類型定義
3. **執行時定義生成**：從類型生成執行時 props/emits
4. **程式碼輸出**：作為普通執行時宣告輸出

### 轉換範例

```vue
<!-- 輸入 -->
<script setup lang="ts">
const props = defineProps<{
  count: number
  message?: string
}>()
</script>
```

```ts
// 輸出
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

## 檢測類型參數

檢測 `defineProps` 或 `defineEmits` 是否有類型參數．

```ts
// packages/compiler-sfc/src/compileScript.ts

let propsTypeDecl: TSTypeLiteral | TSInterfaceBody | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  const callExpr = node as CallExpression

  // 檢查類型參數
  if (callExpr.typeParameters) {
    const typeArg = callExpr.typeParameters.params[0]
    if (typeArg) {
      propsTypeDecl = resolveTypeElements(typeArg)
    }
  } else {
    // 執行時宣告
    propsRuntimeDecl = node.arguments[0]
  }

  // ...
  return true
}
```

## 解析類型

解析 TypeScript 類型字面量以提取屬性資訊．

```ts
interface PropTypeData {
  type: string[]      // 類型陣列（支援聯合類型）
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

      // 解析類型
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

## 類型到建構函數的轉換

將 TypeScript 類型轉換為 JavaScript 建構函數．

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
      // 聯合類型返回多個建構函數
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
      // 自訂類型和參照
      if (node.typeName.type === "Identifier") {
        const name = node.typeName.name
        // 內建類型對映
        if (name === "Array") return ["Array"]
        if (name === "Function") return ["Function"]
        if (name === "Object") return ["Object"]
        // 其他保持原樣
        return [name]
      }
      return ["Object"]

    default:
      return ["null"]
  }
}
```

## 生成執行時定義

從解析的類型資訊生成執行時 props 定義．

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

## defineEmits 的類型處理

`defineEmits` 同樣處理類型參數．

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
  // 函數多載形式
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

## 生成 emits 執行時定義

```ts
function genRuntimeEmitsFromType(
  emitsDecl: TSFunctionType[]
): string {
  const events: string[] = []

  for (const sig of emitsDecl) {
    // 第一個參數是事件名
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

### 轉換範例

```vue
<!-- 輸入 -->
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update', id: number): void
}>()
</script>
```

```ts
// 輸出
export default {
  emits: ['change', 'update'],
  setup(__props, { emit }) {
    // ...
  }
}
```

## withDefaults 支援

要為基於類型的 props 指定預設值，使用 `withDefaults`．

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

  // 處理 defineProps
  if (isCallOf(propsCall, DEFINE_PROPS)) {
    processDefineProps(propsCall)
  }

  // 儲存預設值
  if (defaultsArg) {
    propsDefaults = defaultsArg
  }

  return true
}
```

## 測試

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

## 未來擴展

可以考慮以下功能：

- **介面參照**：參照其他檔案中定義的類型
- **對映類型**：`Partial<T>` 等變換類型
- **泛型組件**：帶有泛型類型參數的組件
- **僅類型導入**：處理 `import type`

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/060_type_based_macros)

## 總結

- 基於類型的 defineProps/defineEmits 使用 TypeScript 類型參數
- 編譯器解析類型並生成執行時定義
- TypeScript 類型對映到 JavaScript 建構函數
- 可以使用 withDefaults 指定預設值

## 參考連結

- [Vue.js - 組合式 API 與 TypeScript](https://vuejs.org/guide/typescript/composition-api.html) - Vue 官方文件
- [Vue.js - 僅類型 props/emit 宣告](https://vuejs.org/api/sfc-script-setup.html#type-only-props-emit-declarations) - Vue 官方文件
