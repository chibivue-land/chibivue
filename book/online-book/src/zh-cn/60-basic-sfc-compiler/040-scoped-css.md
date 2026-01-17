# 支持 Scoped CSS

::: info 关于本章
本章介绍如何实现 Vue 的 Scoped CSS 功能。\
学习如何为每个组件隔离样式，防止样式冲突。
:::

## 什么是 Scoped CSS？

Scoped CSS 是将 `<style scoped>` 中定义的样式仅应用于该组件的功能。

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

此样式不会影响其他组件中具有相同类名的元素。

<KawaikoNote variant="question" title="为什么需要 Scoped CSS？">

在大型应用中，不同组件可能使用相同的类名。\
没有 Scoped CSS，样式可能会意外影响其他组件。\
通过为每个组件隔离样式，可以安全地进行样式设计！

</KawaikoNote>

## 工作原理

Scoped CSS 通过以下步骤实现：

1. **生成作用域 ID**：为每个组件创建唯一 ID
2. **转换模板**：为元素添加 `data-v-xxx` 属性
3. **转换样式**：为选择器添加 `[data-v-xxx]`

### 转换示例

```vue
<!-- 输入 -->
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
<!-- 输出 (HTML) -->
<p class="message" data-v-7ba5bd90>Hello</p>

<!-- 输出 (CSS) -->
<style>
.message[data-v-7ba5bd90] {
  color: red;
}
</style>
```

## 生成作用域 ID

为每个组件生成唯一 ID。通常使用文件路径的哈希值。

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

  // ... 其余解析处理
}
```

## 扩展 SFCStyleBlock

为样式块添加 scoped 信息。

```ts
// packages/compiler-sfc/src/parse.ts

export interface SFCStyleBlock extends SFCBlock {
  type: "style"
  scoped?: boolean  // 添加
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

## 模板转换

在模板编译期间为元素添加 scopeId 属性。

```ts
// packages/compiler-core/src/codegen.ts

function genVNodeCall(node: VNodeCall, context: CodegenContext) {
  const { push, helper, scopeId } = context
  const { tag, props, children } = node

  // 如果存在 scopeId，添加到 props
  let propsWithScope = props
  if (scopeId) {
    const scopeIdProp = `"data-v-${scopeId}": ""`
    if (props) {
      // 与现有 props 合并
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

## 样式转换

为 CSS 选择器添加作用域属性选择器。

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

  // 使用 PostCSS 转换选择器
  const result = postcss([scopedPlugin(id)]).process(source, { from: undefined })
  return result.css
}

function scopedPlugin(id: string) {
  const scopeId = `data-v-${id}`

  return {
    postcssPlugin: 'vue-sfc-scoped',
    Rule(rule) {
      // 为选择器添加 [data-v-xxx]
      rule.selectors = rule.selectors.map((selector) => {
        return `${selector}[${scopeId}]`
      })
    },
  }
}
```

## Vite 插件集成

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

// 在 Vite 插件的 load 中编译样式
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

我们使用 PostCSS 进行样式转换。\
PostCSS 是一个可以将 CSS 作为 AST 处理的工具，使选择器转换变得简单。\
Vue.js 内部也使用 PostCSS！

</KawaikoNote>

## 测试

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

两个组件使用相同的类名 `.text`，但显示不同的颜色。

## 未来扩展

当前 chibivue 未实现 Scoped CSS，但可以考虑以下功能：

- **:deep() 选择器**：修改子组件的样式
- **:slotted() 选择器**：插槽内容的样式
- **:global() 选择器**：定义全局样式
- **CSS Modules**：自动类名生成

<KawaikoNote variant="base" title="尝试实现！">

参考本章介绍的原理，尝试自己实现 Scoped CSS！\
这也是学习如何使用 PostCSS 的好机会。

</KawaikoNote>

## 总结

- Scoped CSS 为每个组件隔离样式
- 生成唯一的 scopeId 并应用于模板和样式
- 模板获得 `data-v-xxx` 属性，CSS 获得 `[data-v-xxx]` 选择器
- 使用 PostCSS 转换选择器

## 参考链接

- [Vue.js - Scoped CSS](https://cn.vuejs.org/api/sfc-css-features.html#scoped-css) - Vue 官方文档
- [PostCSS](https://postcss.org/) - CSS 转换工具
