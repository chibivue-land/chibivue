# 解析组件

实际上，我们的 chibivue 模板还无法解析组件。
让我们在这里实现它，因为 Vue.js 提供了几种解析组件的方法。

首先，让我们回顾一些解析方法。

## 组件的解析方法

### 1. Components 选项（局部注册）

这可能是解析组件最简单的方法。

https://vuejs.org/api/options-misc.html#components

```vue
<script>
import MyComponent from './MyComponent.vue'

export default {
  components: {
    MyComponent,
    MyComponent2: MyComponent,
  },
}
</script>

<template>
  <MyComponent />
  <MyComponent2 />
</template>
```

在 components 选项对象中指定的键名成为可以在模板中使用的组件名称。

### 2. 在应用上注册（全局注册）

您可以通过使用创建的 Vue 应用程序的 `.component()` 方法来注册可在整个应用程序中使用的组件。

https://vuejs.org/guide/components/registration.html#global-registration

```ts
import { createApp } from 'vue'

const app = createApp({})

app
  .component('ComponentA', ComponentA)
  .component('ComponentB', ComponentB)
  .component('ComponentC', ComponentC)
```

### 3. 动态组件 + is 属性

通过使用 is 属性，您可以动态切换组件。

https://vuejs.org/api/built-in-special-elements.html#component

```vue
<script>
import Foo from './Foo.vue'
import Bar from './Bar.vue'

export default {
  components: { Foo, Bar },
  data() {
    return {
      view: 'Foo',
    }
  },
}
</script>

<template>
  <component :is="view" />
</template>
```

### 4. 在 script setup 中导入

在 script setup 中，您可以直接使用导入的组件。

```vue
<script setup>
import MyComponent from './MyComponent.vue'
</script>

<template>
  <MyComponent />
</template>
```

此外，还有异步组件、嵌入式组件和 `component` 标签，但这次我将尝试处理上述两种（1、2）。

关于 3，如果 1 和 2 可以处理它，那只是一个扩展。至于 4，由于 script setup 尚未实现，我们将暂时搁置。

## 基本方法

解析组件的基本方法如下：

- 在某个地方，存储模板中使用的名称和组件记录。
- 使用辅助函数根据名称解析组件。

形式 1 和形式 2 都只是存储名称和组件记录，唯一的区别是它们注册的位置。  
如果您有记录，您可以在必要时从名称解析组件，因此两种实现都将类似。

首先，让我们看一下预期的代码和编译结果。

```vue
<script>
import MyComponent from './MyComponent.vue'

export default defineComponent({
  components: { MyComponent },
})
</script>

<template>
  <MyComponent />
</template>
```

```js
// 编译结果

function render(_ctx) {
  const {
    resolveComponent: _resolveComponent,
    createVNode: _createVNode,
    Fragment: _Fragment,
  } = ChibiVue

  const _component_MyComponent = _resolveComponent('MyComponent')

  return _createVNode(_Fragment, null, _createVNode(_component_MyComponent))
}
```

看起来是这样的。

## 实现

### AST

为了生成解析组件的代码，我们需要知道"MyComponent"是一个组件。  
在解析阶段，我们处理标签名称并在 AST 上将其分为常规 Element 和 Component。

首先，让我们考虑 AST 的定义。  
ComponentNode 与常规 Element 一样，具有 props 和 children。  
在将这些公共部分合并为 `BaseElementNode` 的同时，我们将现有的 `ElementNode` 重命名为 `PlainElementNode`，  
并使 `ElementNode` 成为 `PlainElementNode` 和 `ComponentNode` 的联合。

```ts
// compiler-core/ast.ts

export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
}

export type ElementNode = PlainElementNode | ComponentNode

export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT
  tag: string
  tagType: ElementTypes
  isSelfClosing: boolean
  props: Array<AttributeNode | DirectiveNode>
  children: TemplateChildNode[]
}

export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT
  codegenNode: VNodeCall | SimpleExpressionNode | undefined
}

export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT
  codegenNode: VNodeCall | undefined
}
```

内容与之前相同，但我们通过 `tagType` 区分它们并将它们视为单独的 AST。  
我们将在转换阶段使用它来添加辅助函数等。

### 解析器

接下来，让我们实现解析器来生成上述 AST。  
基本上，我们只需要根据标签名称确定 `tagType`。

问题是如何确定它是 Element 还是 Component。

基本思路很简单：只需确定它是否是"原生标签"。

・  
・  
・

"等等，等等，这不是我要问的。我们实际上如何实现它？"

是的，这是一种暴力方法。我们预定义原生标签名称列表并确定它是否匹配。  
至于应该枚举哪些项目，所有这些都应该写在规范中，所以我们将信任它并使用它。

如果有问题的话，"什么是原生标签"可能因环境而异。  
在这种情况下，它是浏览器。我的意思是"compiler-core 不应该依赖于环境"。  
到目前为止，我们已经在 compiler-dom 中实现了这样的 DOM 依赖实现，这个枚举也不例外。

考虑到这一点，我们将实现它，以便可以从解析器外部注入"是否为原生标签"的函数作为选项，考虑到未来的可能性并使其易于在以后添加各种选项。

```ts
type OptionalOptions = 'isNativeTag' // | TODO: Add more in the future (maybe)

type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>

export interface ParserContext {
  // .
  // .
  options: MergedParserOptions // [!code ++]
  // .
  // .
}

function createParserContext(
  content: string,
  rawOptions: ParserOptions, // [!code ++]
): ParserContext {
  const options = Object.assign({}, defaultParserOptions) // [!code ++]

  let key: keyof ParserOptions // [!code ++]
  // prettier-ignore
  for (key in rawOptions) { // [!code ++]
    options[key] = // [!code ++]
      rawOptions[key] === undefined // [!code ++]
        ? defaultParserOptions[key] // [!code ++]
        : rawOptions[key]; // [!code ++]
  } // [!code ++]

  // .
  // .
  // .
}

export const baseParse = (
  content: string,
  options: ParserOptions = {}, // [!code ++]
): RootNode => {
  const context = createParserContext(
    content,
    options, // [!code ++]
  )
  const children = parseChildren(context, [])
  return createRoot(children)
}
```

现在，在 compiler-dom 中，我们将枚举原生标签名称并将它们作为选项传递。

虽然我提到了 compiler-dom，但枚举本身是在 shared/domTagConfig.ts 中完成的。

```ts
import { makeMap } from './makeMap'

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
  'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
  'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot'

export const isHTMLTag = makeMap(HTML_TAGS)
```

看起来相当可怕，不是吗？

但这是正确的实现。

https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/shared/src/domTagConfig.ts#L6

创建 compiler-dom/parserOptions.ts 并将其传递给编译器。

```ts
// compiler-dom/parserOptions.ts

import { ParserOptions } from '../compiler-core'
import { isHTMLTag, isSVGTag } from '../shared/domTagConfig'

export const parserOptions: ParserOptions = {
  isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag),
}
```

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(
    template,
    Object.assign(
      {},
      parserOptions, // [!code ++]
      defaultOption,
      {
        directiveTransforms: DOMDirectiveTransforms,
      },
    ),
  )
}
```

解析器的实现已完成，所以我们现在将继续实现其余部分。

其余部分非常简单。我们只需要确定它是否是组件并分配一个 tagType。

```ts
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[],
): ElementNode | undefined {
  // .
  // .
  let tagType = ElementTypes.ELEMENT // [!code ++]
  // prettier-ignore
  if (isComponent(tag, context)) { // [!code ++]
    tagType = ElementTypes.COMPONENT;// [!code ++]
  } // [!code ++]

  return {
    // .
    tagType, // [!code ++]
    // .
  }
}

function isComponent(tag: string, context: ParserContext) {
  const options = context.options
  if (
    // NOTE: 在 Vue.js 中，以大写字母开头的标签被视为组件。
    // ref: https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/compiler-core/src/parse.ts#L662
    /^[A-Z]/.test(tag) ||
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true
  }
}
```

有了这个，解析器和 AST 就完成了。我们现在将继续使用这些来实现转换和代码生成。

### 转换

在转换中需要做的事情非常简单。

在 transformElement 中，如果 Node 是 ComponentNode，我们只需要进行轻微的转换。

此时，我们还在上下文中注册组件。
这样做是为了我们可以在代码生成期间集体解析它。
如后面提到的，组件将在代码生成中作为资产集体解析。

```ts
// compiler-core/transforms/transformElement.ts
export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    // .
    // .

    const isComponent = node.tagType === ElementTypes.COMPONENT // [!code ++]

    const vnodeTag = isComponent // [!code ++]
      ? resolveComponentType(node as ComponentNode, context) // [!code ++]
      : `"${tag}"` // [!code ++]

    // .
    // .
  }
}

function resolveComponentType(node: ComponentNode, context: TransformContext) {
  let { tag } = node
  context.helper(RESOLVE_COMPONENT)
  context.components.add(tag) // 稍后解释
  return toValidAssetId(tag, `component`)
}
```

```ts
// util.ts
export function toValidAssetId(
  name: string,
  type: 'component', // | TODO:
): string {
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}
```

我们还确保在上下文中注册它。

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  components: Set<string> // [!code ++]
  // .
}

export function createTransformContext(
  root: RootNode,
  {
    nodeTransforms = [],
    directiveTransforms = {},
    isBrowser = false,
  }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    // .
    components: new Set(), // [!code ++]
    // .
  }
}
```

然后，上下文中的所有组件都在目标组件的 RootNode 中注册。

```ts
export interface RootNode extends Node {
  type: NodeTypes.ROOT
  children: TemplateChildNode[]
  codegenNode?: TemplateChildNode | VNodeCall
  helpers: Set<symbol>
  components: string[] // [!code ++]
}
```

```ts
export function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseNode(root, context)
  createRootCodegen(root, context)
  root.helpers = new Set([...context.helpers.keys()])
  root.components = [...context.components] // [!code ++]
}
```

有了这个，剩下的就是在代码生成中使用 RootNode.components。

### 代码生成

代码只是通过将名称传递给辅助函数来生成代码以进行解析，就像我们在开始时看到的编译结果一样。我们将其抽象为"资产"以供将来考虑。

```ts
export const generate = (ast: RootNode, option: CompilerOptions): string => {
  // .
  // .
  genFunctionPreamble(ast, context) // NOTE: 将来将此移到函数外部

  // prettier-ignore
  if (ast.components.length) { // [!code ++]
    genAssets(ast.components, "component", context); // [!code ++]
    newline(); // [!code ++]
    newline(); // [!code ++]
  } // [!code ++]

  push(`return `)
  // .
  // .
}

function genAssets(
  assets: string[],
  type: 'component' /* TODO: */,
  { helper, push, newline }: CodegenContext,
) {
  if (type === 'component') {
    const resolver = helper(RESOLVE_COMPONENT)
    for (let i = 0; i < assets.length; i++) {
      let id = assets[i]

      push(
        `const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(
          id,
        )})`,
      )
      if (i < assets.length - 1) {
        newline()
      }
    }
  }
}
```

### runtime-core 端的实现

现在我们已经生成了所需的代码，让我们转到 runtime-core 中的实现。

#### 为组件添加"component"作为选项

这很简单，只需将其添加到选项中。

```ts
export type ComponentOptions<
  // .
  // .
> = {
  // .
  components?: Record<string, Component>
  // .
}
```

#### 为应用添加"components"作为选项

这也很简单。

```ts
export interface AppContext {
  // .
  components: Record<string, Component> // [!code ++]
  // .
}

export function createAppContext(): AppContext {
  return {
    // .
    components: {}, // [!code ++]
    // .
  }
}

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    // .
    const app: App = (context.app = {
      // .
      // prettier-ignore
      component(name: string, component: Component): any { // [!code ++]
        context.components[name] = component; // [!code ++]
        return app; // [!code ++]
      },
    })
  }
}
```

#### 实现从上述两者解析组件的函数

这里没有什么特别需要解释的。
它搜索本地和全局注册的组件，并返回组件。
如果找不到，它将名称原样返回作为回退。

```ts
// runtime-core/helpers/componentAssets.ts

export function resolveComponent(name: string): ConcreteComponent | string {
  const instance = currentInstance || currentRenderingInstance // 稍后解释
  if (instance) {
    const Component = instance.type
    const res =
      // 本地注册
      resolve((Component as ComponentOptions).components, name) ||
      // 全局注册
      resolve(instance.appContext.components, name)
    return res
  }

  return name
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
```

需要注意的一点是 `currentRenderingInstance`。

为了在 `resolveComponent` 中遍历本地注册的组件，我们需要访问当前正在渲染的组件。
（我们想要搜索正在渲染的组件的 `components` 选项）

考虑到这一点，让我们准备 `currentRenderingInstance` 并在渲染时更新它。

```ts
// runtime-core/componentRenderContexts.ts

export let currentRenderingInstance: ComponentInternalInstance | null = null

export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  return prev
}
```

```ts
// runtime-core/renderer.ts

const setupRenderEffect = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const componentUpdateFn = () => {
    // .
    // .
    const prev = setCurrentRenderingInstance(instance) // [!code ++]
    const subTree = (instance.subTree = normalizeVNode(render(proxy!))) // [!code ++]
    setCurrentRenderingInstance(prev) // [!code ++]
    // .
    // .
  }
  // .
  // .
}
```

## 让我们试试看

太好了！我们终于可以解析组件了。

让我们尝试在 playground 中运行它！

```ts
import { createApp } from 'chibivue'

import App from './App.vue'
import Counter from './components/Counter.vue'

const app = createApp(App)
app.component('GlobalCounter', Counter)
app.mount('#app')
```

App.vue

```vue
<script>
import Counter from './components/Counter.vue'

import { defineComponent } from 'chibivue'

export default defineComponent({
  components: { Counter },
})
</script>

<template>
  <Counter />
  <Counter />
  <GlobalCounter />
</template>
```

components/Counter.vue

```vue
<script>
import { ref, defineComponent } from 'chibivue'

export default defineComponent({
  setup() {
    const count = ref(0)
    return { count }
  },
})
</script>

<template>
  <button @click="count++">count: {{ count }}</button>
</template>
```

![resolve_components](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/resolve_components.png)

看起来工作正常！太好了！

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/060_resolve_components)
