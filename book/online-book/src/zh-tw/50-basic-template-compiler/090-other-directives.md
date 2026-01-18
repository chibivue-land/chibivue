# 其他指令

到目前為止，我們已經實現了 v-bind，v-on，v-if，v-for，v-model 等主要指令．\
在本章中，我們將實現其餘的內建指令．

我們要實現的指令如下：

- v-text
- v-html
- v-cloak
- v-pre

關於 v-show，由於它需要執行時指令機制，我們將在自訂指令章節中介紹．\
另外，v-once 和 v-memo 與最佳化相關，計劃在 Web Application Essentials 的 Optimizations 章節中介紹．

## v-text

### 目標開發者介面

v-text 是一個更新元素 textContent 的指令．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello!')
    return { msg }
  },
}
</script>

<template>
  <span v-text="msg"></span>
  <!-- 等同於下面的寫法 -->
  <span>{{ msg }}</span>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-text

### 實現方針

v-text 的實現非常簡單．\
在編譯時，只需將 v-text 指令轉換為 `textContent` 屬性的綁定即可．

```html
<span v-text="msg"></span>
```

↓

```ts
h('span', { textContent: msg })
```

### 在 compiler-dom 中實現 transformer

由於 v-text 是 DOM 特有的指令，我們在 compiler-dom 中實現它．

建立 `packages/compiler-dom/src/transforms/vText.ts`．

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-text is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-text will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

關鍵點如下：

- 如果 exp 不存在則輸出錯誤
- 如果存在子元素則輸出警告並清除子元素（因為 v-text 會覆蓋子元素）
- 將 exp 綁定為 `textContent` 屬性

然後在 `packages/compiler-dom/src/index.ts` 中註冊 transformer．

```ts
import { transformVText } from './transforms/vText'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText, // [!code ++]
}
```

這樣 v-text 的實現就完成了！

## v-html

### 目標開發者介面

v-html 是一個更新元素 innerHTML 的指令．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const rawHtml = ref('<span style="color: red">This should be red.</span>')
    return { rawHtml }
  },
}
</script>

<template>
  <p>Using v-html directive: <span v-html="rawHtml"></span></p>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-html

::: warning
由於 v-html 直接操作 innerHTML，可能成為 XSS 漏洞的來源．\
請避免使用 v-html 顯示不受信任的使用者輸入．
:::

### 實現方針

與 v-text 類似，v-html 在編譯時轉換為 `innerHTML` 屬性的綁定．

```html
<span v-html="rawHtml"></span>
```

↓

```ts
h('span', { innerHTML: rawHtml })
```

### 在 compiler-dom 中實現 transformer

建立 `packages/compiler-dom/src/transforms/vHtml.ts`．

```ts
import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@chibivue/compiler-core'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    console.error(
      `v-html is missing expression.`,
    )
  }
  if (node.children.length) {
    console.error(
      `v-html will override element children.`,
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
```

結構與 v-text 幾乎相同．唯一的區別是使用 `innerHTML` 而不是 `textContent`．

在 `packages/compiler-dom/src/index.ts` 中註冊 transformer．

```ts
import { transformVHtml } from './transforms/vHtml'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText,
  html: transformVHtml, // [!code ++]
}
```

這樣 v-html 的實現也完成了！

## v-cloak

### 目標開發者介面

v-cloak 是一個用於在元件掛載前隱藏元素的指令．\
它與 CSS 配合使用，防止使用者看到未編譯的模板語法（如 mustache）．

```css
[v-cloak] {
  display: none;
}
```

```text
<div v-cloak>
  ｛｛ message ｝｝
</div>
```

掛載後，v-cloak 屬性會自動移除．

https://vuejs.org/api/built-in-directives.html#v-cloak

### 實現方針

v-cloak 的實現非常簡單．\
只需在掛載時從元素中移除 v-cloak 屬性即可．

這是在執行時而不是編譯器中處理的．\
具體來說，我們在 `renderer.ts` 的 `mountElement` 函式中新增處理．

### 在執行時實現

在 `packages/runtime-core/src/renderer.ts` 的 `mountElement` 函式中新增以下處理．

```ts
const mountElement = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  let el: RendererElement
  const { type, props, children, shapeFlag } = vnode

  el = vnode.el = hostCreateElement(type as string)

  // ... 現有處理 ...

  // 移除 v-cloak // [!code ++]
  if (props && 'v-cloak' in props) { // [!code ++]
    delete (el as any)['v-cloak'] // [!code ++]
    hostRemoveAttribute(el, 'v-cloak') // [!code ++]
  } // [!code ++]

  hostInsert(el, container, anchor)

  // ... 現有處理 ...
}
```

雖然可以使用現有的 `hostPatchProp` 來實現 `hostRemoveAttribute`，但讓我們簡單地將其新增到 `nodeOps` 中．

新增到 `packages/runtime-dom/src/nodeOps.ts`．

```ts
export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  // ... 現有處理 ...
  removeAttribute: (el, key) => {
    el.removeAttribute(key)
  },
}
```

還需要新增到 `packages/runtime-core/src/renderer.ts` 的 `RendererOptions` 型別中．

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  // ... 現有處理 ...
  removeAttribute(el: HostElement, key: string): void
}
```

這樣 v-cloak 的實現就完成了！

## v-pre

### 目標開發者介面

v-pre 是一個跳過該元素及其所有子元素編譯的指令．\
當你想要原樣顯示 mustache 語法時使用．

```text
<template>
  <span v-pre>｛｛ this will not be compiled ｝｝</span>
</template>
```

上面的模板將原樣顯示文字 `｛｛ this will not be compiled ｝｝`．

https://vuejs.org/api/built-in-directives.html#v-pre

### 實現方針

與其他指令不同，v-pre 在解析器階段處理．\
當偵測到帶有 v-pre 屬性的元素時，跳過該元素及其子元素的指令和 mustache 語法解析．

### 在解析器中實現

在 `packages/compiler-core/src/parse.ts` 中新增 v-pre 處理．

首先，在解析器上下文中新增 `inVPre` 標誌．

```ts
export interface ParserContext {
  // ... 現有屬性 ...
  inVPre: boolean // [!code ++]
}

function createParserContext(content: string, options: ParserOptions): ParserContext {
  return {
    // ... 現有處理 ...
    inVPre: false, // [!code ++]
  }
}
```

接下來，在解析元素時檢查 v-pre 屬性，如果存在則將 `inVPre` 設定為 true．

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // Start tag
  const element = parseTag(context, TagType.Start)

  // 檢查 v-pre // [!code ++]
  const isPreBoundary = element.props.some( // [!code ++]
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'pre' // [!code ++]
  ) // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = true // [!code ++]
  } // [!code ++]

  // Children
  if (!element.isSelfClosing) {
    ancestors.push(element)
    const children = parseChildren(context, ancestors)
    ancestors.pop()
    element.children = children

    // End tag
    if (startsWithEndTagOpen(context.source, element.tag)) {
      parseTag(context, TagType.End)
    }
  }

  // v-pre 結束 // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = false // [!code ++]
  } // [!code ++]

  return element
}
```

然後，在 `inVPre` 為 true 時跳過指令和 mustache 語法的解析．

修改 `parseAttribute` 函式．

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // ... 屬性名稱解析 ...

  // 在 v-pre 中不作為指令解析 // [!code ++]
  if (context.inVPre) { // [!code ++]
    return { // [!code ++]
      type: NodeTypes.ATTRIBUTE, // [!code ++]
      name, // [!code ++]
      value: value && { // [!code ++]
        type: NodeTypes.TEXT, // [!code ++]
        content: value.content, // [!code ++]
        loc: value.loc, // [!code ++]
      }, // [!code ++]
      loc, // [!code ++]
    } // [!code ++]
  } // [!code ++]

  // 指令解析 ...
}
```

同樣修改 `parseChildren` 函式以跳過 mustache 語法解析．

```ts
function parseChildren(
  context: ParserContext,
  ancestors: ElementNode[],
): TemplateChildNode[] {
  const nodes: TemplateChildNode[] = []

  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: TemplateChildNode | undefined = undefined

    if (startsWith(s, context.options.delimiters[0])) {
      // 在 v-pre 中跳過 mustache // [!code ++]
      if (!context.inVPre) { // [!code ++]
        node = parseInterpolation(context)
      } // [!code ++]
    } else if (s[0] === '<') {
      // ... 元素解析 ...
    }

    if (!node) {
      node = parseText(context)
    }

    nodes.push(node)
  }

  return nodes
}
```

這樣 v-pre 的實現就完成了！

## 驗證行為

讓我們驗證實現的指令是否正常運作．

```vue
<script>
import { ref } from 'chibivue'

export default {
  setup() {
    const msg = ref('Hello, chibivue!')
    const rawHtml = ref('<span style="color: red">Red text</span>')
    return { msg, rawHtml }
  },
}
</script>

<template>
  <div>
    <h2>v-text</h2>
    <span v-text="msg"></span>

    <h2>v-html</h2>
    <div v-html="rawHtml"></div>

    <h2>v-pre</h2>
    <span v-pre>｛｛ msg ｝｝ will not be compiled</span>
  </div>
</template>
```

運作正常嗎？\
這樣基本的內建指令實現就完成了！

v-show 和自訂指令將在下一章介紹．\
v-once 和 v-memo 計劃在最佳化章節中介紹．

到此為止的原始碼：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/090_other_directives)
