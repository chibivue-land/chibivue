# 支援 defineProps

::: info 關於本章
本章介紹如何實現 `<script setup>` 中使用的 `defineProps` 巨集。\
學習編譯器巨集的工作原理以及 props 宣告的處理方式。
:::

## 什麼是 defineProps？

`defineProps` 是一個編譯器巨集，用於在 `<script setup>` 內宣告組件的 props。

```vue
<script setup>
// 執行時宣告
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

<KawaikoNote variant="question" title="什麼是編譯器巨集？">

`defineProps` 不是普通函數。它是**編譯器巨集**。\
它在編譯時會被特殊處理，在執行時會被擦除。\
這就是為什麼不需要匯入就可以使用！

</KawaikoNote>

## 實現概述

defineProps 的處理包含以下步驟：

1. **檢測巨集呼叫**：在 AST 中找到 `defineProps()` 呼叫
2. **提取參數**：獲取 props 定義物件
3. **刪除程式碼**：刪除原始的 `defineProps()` 呼叫
4. **新增到選項**：作為 `props` 選項新增到輸出
5. **註冊綁定**：將 props 註冊為 `PROPS` 類型

## processDefineProps 函數

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_PROPS = "defineProps"

let propsRuntimeDecl: Node | undefined
let propsIdentifier: string | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  // 儲存參數（props 定義物件）
  propsRuntimeDecl = node.arguments[0]

  // 如果賦值給變數，儲存識別符
  // const props = defineProps(...) 中的 "props" 部分
  if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST 遍歷

遍歷 `<script setup>` 的主體來檢測 `defineProps`。

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  // 表達式語句（單獨呼叫 defineProps()）
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr)) {
      // 刪除巨集呼叫
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  // 變數宣告（const props = defineProps(...)）
  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        if (processDefineProps(init, declId)) {
          // 刪除宣告
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## 註冊 Props 綁定

作為 props 宣告的變數會被註冊到綁定元資料中，以便從模板中引用。

```ts
// 7. analyze binding metadata
if (propsRuntimeDecl) {
  for (const key of getObjectExpressionKeys(propsRuntimeDecl as ObjectExpression)) {
    bindingMetadata[key] = BindingTypes.PROPS
  }
}
```

通過註冊為 `BindingTypes.PROPS`，模板編譯器可以正確處理對 props 的存取。

## 處理 Props 識別符

當賦值給變數如 `const props = defineProps(...)` 時，需要使該變數可存取。

```ts
// 9. finalize setup() argument signature
let args = `__props`
if (propsIdentifier) {
  // 新增 const props = __props;
  s.prependLeft(startOffset, `\nconst ${propsIdentifier} = __props;\n`)
}
```

## 新增到選項

最終，props 定義作為組件選項輸出。

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

## 轉換結果範例

```vue
<!-- 輸入 -->
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
// 輸出
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

<KawaikoNote variant="funny" title="簡單！">

`defineProps` 看起來複雜，但做的事情很簡單：
1. 將參數移動到 `props` 選項
2. 刪除 `defineProps()` 呼叫
3. 如果有變數，替換為對 `__props` 的引用

</KawaikoNote>

## 測試

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

父組件：

```vue
<script setup>
import ChildComponent from './ChildComponent.vue'
</script>

<template>
  <ChildComponent firstName="John" lastName="Doe" />
</template>
```

<KawaikoNote variant="base" title="實現完成！">

defineProps 的實現完成了！\
現在你理解了編譯器巨集的基本機制。\
下一章我們將學習如何實現 `defineEmits` 巨集。

</KawaikoNote>

## 總結

- `defineProps` 是編譯器巨集，在編譯時處理
- 遍歷 AST 檢測 `defineProps()` 呼叫
- 參數轉換為 `props` 選項，呼叫本身被刪除
- Props 註冊為 `BindingTypes.PROPS` 以便模板存取

## 參考連結

- [Vue.js - defineProps](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 官方文件
