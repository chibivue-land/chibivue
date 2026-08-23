# 支援 defineEmits

::: info 關於本章
本章介紹如何實作 `<script setup>` 中使用的 `defineEmits` 巨集。\
學習子元件向父元件發送事件的機制。
:::

## 什麼是 defineEmits？

`defineEmits` 是一個編譯器巨集，用於在 `<script setup>` 內宣告元件發出的事件。

```vue
<script setup>
const emit = defineEmits(['change', 'update'])

function handleClick() {
  emit('change', 'new value')
}
</script>
```

<KawaikoNote variant="question" title="與 defineProps 有什麼區別？">

`defineProps` 用於從父元件向子元件傳遞資料，\
`defineEmits` 用於從子元件向父元件通知事件。\
記住它們是一對！

</KawaikoNote>

## 實作概述

defineEmits 的處理與 defineProps 非常相似：

1. **檢測巨集呼叫**：在 AST 中找到 `defineEmits()` 呼叫
2. **提取參數**：取得事件定義陣列或物件
3. **刪除程式碼**：刪除原始的 `defineEmits()` 呼叫
4. **新增到選項**：作為 `emits` 選項新增到輸出
5. **提供 emit 函式**：從 setup 的上下文中取得 `emit`

## processDefineEmits 函式

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_EMITS = "defineEmits"

let emitsRuntimeDecl: Node | undefined
let emitIdentifier: string | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  // 儲存事件定義
  emitsRuntimeDecl = node.arguments[0]

  // 如果賦值給變數，儲存識別符
  // const emit = defineEmits(...) 中的 "emit" 部分
  if (declId) {
    emitIdentifier =
      declId.type === "Identifier"
        ? declId.name
        : scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST 遍歷

與 defineProps 類似，遍歷 `<script setup>` 的主體來檢測 `defineEmits`。

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

## 設定 emit 函式

從 `defineEmits` 取得的 emit 函式從 setup 函式的第二個參數（SetupContext）中取得。

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

這會產生如下程式碼：

```ts
// 對於 const emit = defineEmits(['change'])
setup(__props, { emit }) {
  // ...
}

// 對於 const emitFn = defineEmits(['change'])
setup(__props, { emit: emitFn }) {
  // ...
}
```

## 新增到選項

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

## 轉換結果範例

```vue
<!-- 輸入 -->
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
// 輸出
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

<KawaikoNote variant="funny" title="與 defineProps 對稱！">

`defineEmits` 的實作與 `defineProps` 幾乎相同：
1. 檢測巨集呼叫
2. 將參數移動到 `emits` 選項
3. 如果有變數，轉換為從 SetupContext 取得

容易記住！

</KawaikoNote>

## 測試

子元件：

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

父元件：

```vue
<script setup>
import { ref } from 'chibivue'
import CustomInput from './CustomInput.vue'

const text = ref('')
</script>

<template>
  <CustomInput v-model="text" />
  <p>輸入值: {{ text }}</p>
</template>
```

<KawaikoNote variant="base" title="實作完成！">

defineEmits 的實作完成了！\
現在可以使用 props 和 emits 兩個編譯器巨集了。\
下一章我們將學習如何實作 scoped CSS。

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/030_define_emits)

## 總結

- `defineEmits` 是宣告子到父事件發送的巨集
- 處理模式與 `defineProps` 非常相似
- emit 函式從 SetupContext 解構取得
- 作為 `emits` 選項新增到元件

## 參考連結

- [Vue.js - defineEmits](https://vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 官方檔案
