# 支援 Scoped CSS

::: info 關於本章
本章介紹如何實現 Vue 的 Scoped CSS 功能。\
學習如何為每個組件隔離樣式，防止樣式衝突。
:::

## 什麼是 Scoped CSS？

Scoped CSS 是將 `<style scoped>` 中定義的樣式僅應用於該組件的功能。

```vue
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

此樣式不會影響其他組件中具有相同類名的元素。

<KawaikoNote variant="question" title="為什麼需要 Scoped CSS？">

在大型應用中，不同組件可能使用相同的類名。\
沒有 Scoped CSS，樣式可能會意外影響其他組件。\
通過為每個組件隔離樣式，可以安全地進行樣式設計！

</KawaikoNote>

## 工作原理

Scoped CSS 通過以下步驟實現：

1. **生成作用域 ID**：為每個組件建立唯一 ID
2. **轉換模板**：為元素新增 `data-v-xxx` 屬性
3. **轉換樣式**：為選擇器新增 `[data-v-xxx]`

### 轉換範例

```vue
<!-- 輸入 -->
<template>
  <p class="message">Hello</p>
</template>

<style scoped>
.message {
  color: red;
}
</style>
```

```html
<!-- 輸出 (HTML) -->
<p class="message" data-v-7ba5bd90>Hello</p>

<!-- 輸出 (CSS) -->
<style>
.message[data-v-7ba5bd90] {
  color: red;
}
</style>
```

## 生成作用域 ID

為每個組件生成唯一 ID。通常使用檔案路徑的雜湊值。

```ts
// packages/compiler-sfc/src/parse.ts

import { createHash } from 'crypto'

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME }: SFCParseOptions = {},
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
  }

  // 生成作用域 ID
  descriptor.id = createHash('sha256')
    .update(filename + source)
    .digest('hex')
    .slice(0, 8)

  // ... 其餘解析處理
}
```

## 擴展 SFCStyleBlock

為樣式區塊新增 scoped 資訊。

```ts
// packages/compiler-sfc/src/parse.ts

export interface SFCStyleBlock extends SFCBlock {
  type: "style"
  scoped?: boolean  // 新增
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  // ...
  node.props.forEach((p) => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      attrs[p.name] = p.value ? p.value.content || true : true
      if (type === "style") {
        if (p.name === "scoped") {
          (block as SFCStyleBlock).scoped = true
        }
      }
    }
  })
  return block
}
```

## 模板轉換

在模板編譯期間為元素新增 scopeId 屬性。

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, scopeId } = context
  const { tag, props, children } = node

  // 如果存在 scopeId，新增到 props
  let propsWithScope = props
  if (scopeId) {
    const scopeIdProp = `"data-v-${scopeId}": ""`
    if (props) {
      // 與現有 props 合併
      propsWithScope = `{ ...${props}, ${scopeIdProp} }`
    } else {
      propsWithScope = `{ ${scopeIdProp} }`
    }
  }

  push(helper(CREATE_ELEMENT_VNODE) + `(`)
  genNodeList(genNullableArgs([tag, propsWithScope, children]), context)
  push(`)`)
}
```

## 樣式轉換

為 CSS 選擇器新增作用域屬性選擇器。

```ts
// packages/compiler-sfc/src/compileStyle.ts

import postcss from 'postcss'

export interface SFCStyleCompileOptions {
  source: string
  filename: string
  id: string
  scoped?: boolean
}

export function compileStyle(options: SFCStyleCompileOptions): string {
  const { source, id, scoped } = options

  if (!scoped) {
    return source
  }

  // 使用 PostCSS 轉換選擇器
  const result = postcss([scopedPlugin(id)]).process(source, { from: undefined })
  return result.css
}

function scopedPlugin(id: string) {
  const scopeId = `data-v-${id}`

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      // 為選擇器新增 [data-v-xxx]
      rule.selectors = rule.selectors.map((selector) => {
        return `${selector}[${scopeId}]`
      })
    },
  }
}
```

## Vite 外掛整合

```ts
// packages/@extensions/vite-plugin-chibivue/src/main.ts

async function genStyleCode(descriptor: SFCDescriptor): Promise<string> {
  let stylesCode = ``

  for (let i = 0; i < descriptor.styles.length; i++) {
    const style = descriptor.styles[i]
    const src = descriptor.filename
    const scoped = style.scoped ? '&scoped=true' : ''
    const query = `?chibivue&type=style&index=${i}${scoped}&lang.css`
    const styleRequest = src + query
    stylesCode += `\nimport ${JSON.stringify(styleRequest)}`
  }

  return stylesCode
}

// 在 Vite 外掛的 load 中編譯樣式
load(id) {
  const { filename, query } = parseChibiVueRequest(id)
  if (query.chibivue && query.type === "style") {
    const descriptor = getDescriptor(filename, options)!
    const style = descriptor.styles[query.index!]

    if (query.scoped) {
      return {
        code: compileStyle({
          source: style.content,
          filename,
          id: descriptor.id,
          scoped: true,
        })
      }
    }

    return { code: style.content }
  }
}
```

<KawaikoNote variant="surprise" title="PostCSS 的力量！">

我們使用 PostCSS 進行樣式轉換。\
PostCSS 是一個可以將 CSS 作為 AST 處理的工具，使選擇器轉換變得簡單。\
Vue.js 內部也使用 PostCSS！

</KawaikoNote>

## 測試

```vue
<!-- ComponentA.vue -->
<template>
  <p class="text">Component A</p>
</template>

<style scoped>
.text {
  color: red;
}
</style>
```

```vue
<!-- ComponentB.vue -->
<template>
  <p class="text">Component B</p>
</template>

<style scoped>
.text {
  color: blue;
}
</style>
```

兩個組件使用相同的類名 `.text`，但顯示不同的顏色。

## 未來擴展

當前 chibivue 未實現 Scoped CSS，但可以考慮以下功能：

- **:deep() 選擇器**：修改子組件的樣式
- **:slotted() 選擇器**：插槽內容的樣式
- **:global() 選擇器**：定義全域樣式
- **CSS Modules**：自動類名生成

<KawaikoNote variant="base" title="嘗試實現！">

參考本章介紹的原理，嘗試自己實現 Scoped CSS！\
這也是學習如何使用 PostCSS 的好機會。

</KawaikoNote>

## 總結

- Scoped CSS 為每個組件隔離樣式
- 生成唯一的 scopeId 並應用於模板和樣式
- 模板獲得 `data-v-xxx` 屬性，CSS 獲得 `[data-v-xxx]` 選擇器
- 使用 PostCSS 轉換選擇器

## 參考連結

- [Vue.js - Scoped CSS](https://vuejs.org/api/sfc-css-features.html#scoped-css) - Vue 官方文件
- [PostCSS](https://postcss.org/) - CSS 轉換工具
