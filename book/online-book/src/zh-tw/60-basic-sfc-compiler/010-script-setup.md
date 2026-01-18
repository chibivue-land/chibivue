# 支援 script setup

::: info 關於本章
本章介紹如何實現 Vue 3 的 `<script setup>` 語法。\
學習 script setup 的工作原理，以更簡潔的方式編寫組件。
:::

## 什麼是 script setup？

`<script setup>` 是 Vue 3.2 引入的編譯時語法糖。與傳統的 Options API 或 Composition API 相比，它可以更簡潔地編寫組件。

```vue
<!-- 傳統寫法 -->
<script>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

export default {
  components: { MyComponent },
  setup() {
    const count = ref(0)
    const increment = () => count.value++
    return { count, increment }
  }
}
</script>

<!-- script setup 寫法 -->
<script setup>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

const count = ref(0)
const increment = () => count.value++
</script>
```

<KawaikoNote variant="surprise" title="簡潔多了！">

使用 script setup，不需要 `export default` 或 `return`，匯入的組件也會自動註冊。\
程式碼變得非常乾淨！

</KawaikoNote>

## 實現概述

script setup 的編譯包含以下步驟：

1. **匯入分析和提升**：提取 import 語句並移動到檔案頂部
2. **綁定分析**：追蹤變數宣告和函數定義
3. **巨集處理**：處理 defineProps、defineEmits 等（後續章節介紹）
4. **程式碼轉換**：轉換為 setup 函數並生成 return 語句

## compileScript 函數

`compileScript` 函數是編譯 SFC 腳本部分的核心函數。

```ts
// packages/compiler-sfc/src/compileScript.ts

export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  let { script, scriptSetup, source } = sfc

  // 使用 Babel 解析
  const scriptAst = _parse(script?.content ?? "", { sourceType: "module" }).program
  const scriptSetupAst = _parse(scriptSetup?.content ?? "", { sourceType: "module" }).program

  // 沒有 script setup 時使用傳統處理
  if (!scriptSetup) {
    if (!script) {
      throw new Error(`SFC contains no <script> tags.`)
    }
    return { ...script, bindings: analyzeScriptBindings(scriptAst.body) }
  }

  // 初始化元資料
  const bindingMetadata: BindingMetadata = {}
  const userImports: Record<string, ImportBinding> = Object.create(null)
  const setupBindings: Record<string, BindingTypes> = Object.create(null)

  const s = new MagicString(source)
  // ... 轉換處理
}
```

## 匯入提升

script setup 內的 import 語句需要移動（提升）到生成程式碼的開頭。

```ts
// 1.2 walk import declarations of <script setup>
for (const node of scriptSetupAst.body) {
  if (node.type === "ImportDeclaration") {
    // 將匯入移動到檔案頂部
    hoistNode(node)

    // 移除重複匯入
    for (let i = 0; i < node.specifiers.length; i++) {
      const specifier = node.specifiers[i]
      const local = specifier.local.name
      const imported = getImportedName(specifier)
      const source = node.source.value

      const existing = userImports[local]
      if (existing) {
        if (existing.source === source && existing.imported === imported) {
          removeSpecifier(i)
        }
      } else {
        registerUserImport(source, local, imported, true)
      }
    }
  }
}
```

<KawaikoNote variant="question" title="為什麼需要提升？">

在生成的程式碼中，import 語句需要放在 `setup()` 函數外部。\
提升將 `<script setup>` 內的匯入移動到正確的位置。

</KawaikoNote>

## 綁定分析

為了正確解析模板中引用的變數，我們需要分析腳本中的綁定。

```ts
function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string> = {},
) {
  if (node.type === "VariableDeclaration") {
    const isConst = node.kind === "const"

    for (const { id, init } of node.declarations) {
      if (id.type === "Identifier") {
        let bindingType
        if (isConst && isStaticNode(init!)) {
          bindingType = BindingTypes.LITERAL_CONST
        } else if (isCallOf(init, userImportAliases["reactive"])) {
          bindingType = BindingTypes.SETUP_REACTIVE_CONST
        } else if (isCallOf(init, userImportAliases["ref"])) {
          bindingType = BindingTypes.SETUP_REF
        } else if (isConst) {
          bindingType = BindingTypes.SETUP_MAYBE_REF
        } else {
          bindingType = BindingTypes.SETUP_LET
        }
        registerBinding(bindings, id, bindingType)
      }
    }
  } else if (node.type === "FunctionDeclaration") {
    bindings[node.id!.name] = BindingTypes.SETUP_CONST
  }
}
```

綁定類型決定了變數在模板中的引用方式：

| 類型 | 描述 | 模板引用 |
|------|------|---------|
| `SETUP_REF` | 用 ref() 建立 | 自動新增 `.value` |
| `SETUP_REACTIVE_CONST` | 用 reactive() 建立 | 直接引用 |
| `SETUP_CONST` | 常數 | 直接引用 |
| `SETUP_LET` | let/var 變數 | 直接引用 |

## 內聯模板

使用 script setup 時，模板可以內聯到 setup 函數內部。

```ts
// 10. generate return statement
let returned
if (options.inlineTemplate) {
  if (sfc.template) {
    const { code, preamble } = compileTemplate({
      source: sfc.template.content.trim(),
      compilerOptions: { inline: true, bindingMetadata },
    })

    if (preamble) {
      s.prepend(preamble)
    }
    returned = code
  } else {
    returned = `() => {}`
  }
}
s.appendRight(endOffset, `\nreturn ${returned}\n`)
```

生成程式碼範例：

```ts
// 輸入
// <script setup>
// import { ref } from 'chibivue'
// const count = ref(0)
// </script>
// <template>
//   <p>{{ count }}</p>
// </template>

// 輸出
import { ref } from 'chibivue'

export default {
  setup(__props) {
    const count = ref(0)

    return (_ctx) => {
      return h('p', count.value)
    }
  }
}
```

## 與 Vite 外掛整合

Vite 外掛檢測並編譯 script setup。

```ts
// packages/@extensions/vite-plugin-chibivue/src/script.ts

export function resolveScript(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
): SFCScriptBlock | null {
  if (!descriptor.script && !descriptor.scriptSetup) return null

  return options.compiler.compileScript(descriptor, {
    inlineTemplate: isUseInlineTemplate(descriptor),
  })
}

export function isUseInlineTemplate(descriptor: SFCDescriptor): boolean {
  return !!descriptor.scriptSetup
}
```

## 測試

```vue
<script setup>
import { ref, computed } from 'chibivue'

const count = ref(0)
const double = computed(() => count.value * 2)

const increment = () => {
  count.value++
}
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ double }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

<KawaikoNote variant="base" title="實現完成！">

script setup 的基本實現完成了！\
與傳統寫法相比，現在可以更簡潔地編寫組件。\
下一章我們將學習如何實現 `defineProps` 和 `defineEmits` 巨集。

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/010_script_setup)

## 總結

- `<script setup>` 是更簡潔編寫 Composition API 的語法糖
- `compileScript` 處理核心轉換邏輯
- 匯入提升和綁定分析是重要步驟
- 模板被內聯到 setup 函數內部

## 參考連結

- [Vue.js - script setup](https://vuejs.org/api/sfc-script-setup.html) - Vue 官方文件
- [RFC: script setup](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0040-script-setup.md) - Vue RFC
