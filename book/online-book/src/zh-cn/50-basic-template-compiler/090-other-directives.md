# 其他指令

到目前为止，我们已经实现了 v-bind，v-on，v-if，v-for，v-model 等主要指令．\
在本章中，我们将实现其余的内置指令．

我们要实现的指令如下：

- v-text
- v-html
- v-cloak
- v-pre

关于 v-show，由于它需要运行时指令机制，我们将在自定义指令章节中介绍．\
另外，v-once 和 v-memo 与优化相关，计划在 Web Application Essentials 的 Optimizations 章节中介绍．

## v-text

### 目标开发者接口

v-text 是一个更新元素 textContent 的指令．

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
  <!-- 等同于下面的写法 -->
  <span>{{ msg }}</span>
</template>
```

https://vuejs.org/api/built-in-directives.html#v-text

### 实现方针

v-text 的实现非常简单．\
在编译时，只需将 v-text 指令转换为 `textContent` 属性的绑定即可．

```html
<span v-text="msg"></span>
```

↓

```ts
h('span', { textContent: msg })
```

### 在 compiler-dom 中实现 transformer

由于 v-text 是 DOM 特有的指令，我们在 compiler-dom 中实现它．

创建 `packages/compiler-dom/src/transforms/vText.ts`．

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

关键点如下：

- 如果 exp 不存在则输出错误
- 如果存在子元素则输出警告并清除子元素（因为 v-text 会覆盖子元素）
- 将 exp 绑定为 `textContent` 属性

然后在 `packages/compiler-dom/src/index.ts` 中注册 transformer．

```ts
import { transformVText } from './transforms/vText'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText, // [!code ++]
}
```

这样 v-text 的实现就完成了！

## v-html

### 目标开发者接口

v-html 是一个更新元素 innerHTML 的指令．

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
由于 v-html 直接操作 innerHTML，可能成为 XSS 漏洞的来源．\
请避免使用 v-html 显示不受信任的用户输入．
:::

### 实现方针

与 v-text 类似，v-html 在编译时转换为 `innerHTML` 属性的绑定．

```html
<span v-html="rawHtml"></span>
```

↓

```ts
h('span', { innerHTML: rawHtml })
```

### 在 compiler-dom 中实现 transformer

创建 `packages/compiler-dom/src/transforms/vHtml.ts`．

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

结构与 v-text 几乎相同．唯一的区别是使用 `innerHTML` 而不是 `textContent`．

在 `packages/compiler-dom/src/index.ts` 中注册 transformer．

```ts
import { transformVHtml } from './transforms/vHtml'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel,
  text: transformVText,
  html: transformVHtml, // [!code ++]
}
```

这样 v-html 的实现也完成了！

## v-cloak

### 目标开发者接口

v-cloak 是一个用于在组件挂载前隐藏元素的指令．\
它与 CSS 配合使用，防止用户看到未编译的模板语法（如 mustache）．

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

挂载后，v-cloak 属性会自动移除．

https://vuejs.org/api/built-in-directives.html#v-cloak

### 实现方针

v-cloak 的实现非常简单．\
只需在挂载时从元素中移除 v-cloak 属性即可．

这是在运行时而不是编译器中处理的．\
具体来说，我们在 `renderer.ts` 的 `mountElement` 函数中添加处理．

### 在运行时实现

在 `packages/runtime-core/src/renderer.ts` 的 `mountElement` 函数中添加以下处理．

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

  // ... 现有处理 ...

  // 移除 v-cloak // [!code ++]
  if (props && 'v-cloak' in props) { // [!code ++]
    delete (el as any)['v-cloak'] // [!code ++]
    hostRemoveAttribute(el, 'v-cloak') // [!code ++]
  } // [!code ++]

  hostInsert(el, container, anchor)

  // ... 现有处理 ...
}
```

虽然可以使用现有的 `hostPatchProp` 来实现 `hostRemoveAttribute`，但让我们简单地将其添加到 `nodeOps` 中．

添加到 `packages/runtime-dom/src/nodeOps.ts`．

```ts
export const nodeOps: Omit<RendererOptions, 'patchProp'> = {
  // ... 现有处理 ...
  removeAttribute: (el, key) => {
    el.removeAttribute(key)
  },
}
```

还需要添加到 `packages/runtime-core/src/renderer.ts` 的 `RendererOptions` 类型中．

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  // ... 现有处理 ...
  removeAttribute(el: HostElement, key: string): void
}
```

这样 v-cloak 的实现就完成了！

## v-pre

### 目标开发者接口

v-pre 是一个跳过该元素及其所有子元素编译的指令．\
当你想要原样显示 mustache 语法时使用．

```text
<template>
  <span v-pre>｛｛ this will not be compiled ｝｝</span>
</template>
```

上面的模板将原样显示文本 `｛｛ this will not be compiled ｝｝`．

https://vuejs.org/api/built-in-directives.html#v-pre

### 实现方针

与其他指令不同，v-pre 在解析器阶段处理．\
当检测到带有 v-pre 属性的元素时，跳过该元素及其子元素的指令和 mustache 语法解析．

### 在解析器中实现

在 `packages/compiler-core/src/parse.ts` 中添加 v-pre 处理．

首先，在解析器上下文中添加 `inVPre` 标志．

```ts
export interface ParserContext {
  // ... 现有属性 ...
  inVPre: boolean // [!code ++]
}

function createParserContext(content: string, options: ParserOptions): ParserContext {
  return {
    // ... 现有处理 ...
    inVPre: false, // [!code ++]
  }
}
```

接下来，在解析元素时检查 v-pre 属性，如果存在则将 `inVPre` 设置为 true．

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // Start tag
  const element = parseTag(context, TagType.Start)

  // 检查 v-pre // [!code ++]
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

  // v-pre 结束 // [!code ++]
  if (isPreBoundary) { // [!code ++]
    context.inVPre = false // [!code ++]
  } // [!code ++]

  return element
}
```

然后，在 `inVPre` 为 true 时跳过指令和 mustache 语法的解析．

修改 `parseAttribute` 函数．

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // ... 属性名解析 ...

  // 在 v-pre 中不作为指令解析 // [!code ++]
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

同样修改 `parseChildren` 函数以跳过 mustache 语法解析．

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
      // 在 v-pre 中跳过 mustache // [!code ++]
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

这样 v-pre 的实现就完成了！

## 验证行为

让我们验证实现的指令是否正常工作．

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

运行正常吗？\
这样基本的内置指令实现就完成了！

v-show 和自定义指令将在下一章介绍．\
v-once 和 v-memo 计划在优化章节中介绍．

到此为止的源代码：\
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/090_other_directives)
