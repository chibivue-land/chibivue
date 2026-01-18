# 支援 Props 解構

::: info 關於本章
本章介紹如何實現 Vue 3.5 的響應式 Props 解構功能．\
學習如何在解構 props 的同時保持響應性．
:::

## 什麼是響應式 Props 解構？

從 Vue 3.5 開始，你可以在 `<script setup>` 中解構 `defineProps` 的回傳值．

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

這個功能使存取 props 更加簡單．

<KawaikoNote variant="question" title="為什麼需要特殊處理？">

在普通的 JavaScript 中，解構物件會複製值，並斷開與原始物件的連接．\
但是 Vue 的 props 需要保持響應性．\
編譯器將解構存取轉換為 `__props.xxx` 存取來保持響應性！

</KawaikoNote>

## 工作原理

Props 解構通過以下步驟實現：

1. **模式檢測**：檢測 `const { ... } = defineProps(...)`
2. **綁定註冊**：將每個解構的屬性註冊為 `PROPS`
3. **預設值處理**：將預設值轉換為 `withDefaults` 等效處理
4. **程式碼轉換**：將 props 存取轉換為 `__props.xxx`

### 轉換範例

```vue
<!-- 輸入 -->
<script setup>
const { count, message = 'hello' } = defineProps({
  count: Number,
  message: String
})

console.log(count, message)
</script>
```

```ts
// 輸出
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

## 檢測解構模式

檢測 `defineProps` 的回傳值是否被賦值給 `ObjectPattern`（解構模式）．

```ts
// packages/compiler-sfc/src/compileScript.ts

interface PropsDestructureBindings {
  [key: string]: {
    local: string      // 本地變數名
    default?: string   // 預設值
  }
}

let propsDestructuredBindings: PropsDestructureBindings = Object.create(null)

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  propsRuntimeDecl = node.arguments[0]

  // 處理解構模式
  if (declId && declId.type === "ObjectPattern") {
    processPropsDestructure(declId)
  } else if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## 處理解構

從 `ObjectPattern` 中提取每個屬性並註冊為綁定．

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "ObjectProperty") {
      const key = prop.key
      const value = prop.value

      // 獲取屬性名
      let propKey: string
      if (key.type === "Identifier") {
        propKey = key.name
      } else if (key.type === "StringLiteral") {
        propKey = key.value
      } else {
        continue
      }

      // 處理本地變數名和預設值
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

      // 註冊綁定
      propsDestructuredBindings[propKey] = { local, default: defaultValue }
      bindingMetadata[local] = BindingTypes.PROPS
    }
  }
}
```

## 預設值處理

當在解構中指定預設值時，將其合併到 props 定義中．

```ts
function genRuntimeProps(): string | undefined {
  if (!propsRuntimeDecl) return undefined

  let propsString = scriptSetup!.content.slice(
    propsRuntimeDecl.start!,
    propsRuntimeDecl.end!
  )

  // 如果有預設值則合併
  const defaults: Record<string, string> = {}
  for (const key in propsDestructuredBindings) {
    const binding = propsDestructuredBindings[key]
    if (binding.default) {
      defaults[key] = binding.default
    }
  }

  if (Object.keys(defaults).length > 0) {
    // 相當於 withDefaults 的處理
    propsString = mergeDefaults(propsString, defaults)
  }

  return propsString
}

function mergeDefaults(
  propsString: string,
  defaults: Record<string, string>
): string {
  // 實際實現通過操作 AST 來合併預設值
  // 這裡是簡化範例
  const ast = parseExpression(propsString)
  // ... 合併預設值的處理
  return generate(ast).code
}
```

## 轉換 Props 存取

在模板和腳本中，將解構變數的存取轉換為 `__props.xxx`．

```ts
function processPropsAccess(source: string): string {
  const s = new MagicString(source)

  // 遍歷識別符並轉換
  walk(scriptSetupAst, {
    enter(node: Node) {
      if (node.type === "Identifier") {
        const binding = propsDestructuredBindings[node.name]
        if (binding && binding.local === node.name) {
          // 轉換為 props 存取
          s.overwrite(node.start!, node.end!, `__props.${node.name}`)
        }
      }
    }
  })

  return s.toString()
}
```

<KawaikoNote variant="surprise" title="編譯器的魔法！">

解構在普通 JavaScript 中通常會失去響應性，\
但編譯器將其轉換為 `__props.xxx` 存取，\
使你可以將解構語法作為語法糖使用！

</KawaikoNote>

## Rest 模式支援

也可以支援 `...rest` 模式．

```vue
<script setup>
const { id, ...attrs } = defineProps(['id', 'class', 'style'])
</script>
```

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "RestElement") {
      // 處理 rest 模式
      if (prop.argument.type === "Identifier") {
        const restName = prop.argument.name
        // rest 需要特殊處理
        // 實際上使用 computed 來獲取剩餘的 props
        bindingMetadata[restName] = BindingTypes.SETUP_REACTIVE_CONST
      }
    }
    // ...
  }
}
```

## 測試

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

// count 和 message 被轉換為 __props.count, __props.message
console.log(count, message)
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

## 未來擴展

可以考慮以下功能：

- **別名支援**：支援 `const { count: c } = defineProps(...)`
- **陣列模式**：與陣列形式的 props 定義組合

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/050_props_destructure)

## 總結

- Props 解構是 Vue 3.5 引入的功能
- 檢測解構模式並將每個屬性註冊為 `PROPS` 綁定
- 預設值合併到 props 定義中
- 將變數存取轉換為 `__props.xxx` 以保持響應性

## 參考連結

- [Vue.js - 響應式 Props 解構](https://vuejs.org/guide/components/props.html#reactive-props-destructure) - Vue 官方文件
- [RFC - Reactive Props Destructure](https://github.com/vuejs/rfcs/discussions/502) - Vue RFC
