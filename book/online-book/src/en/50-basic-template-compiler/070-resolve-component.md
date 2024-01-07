# Resolving Components

Actually, our chibivue template cannot resolve components yet.
Let's implement it here, as Vue.js provides several ways to resolve components.

First, let's review some of the resolution methods.

## Resolution Methods for Components

### 1. Components Option (Local Registration)

This is probably the simplest way to resolve components.

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

The key names specified in the components option object become the component names that can be used in the template.

### 2. Registering on the app (Global Registration)

You can register components that can be used throughout the application by using the `.component()` method of the created Vue application.

https://vuejs.org/guide/components/registration.html#global-registration

```ts
import { createApp } from 'vue'

const app = createApp({})

app
  .component('ComponentA', ComponentA)
  .component('ComponentB', ComponentB)
  .component('ComponentC', ComponentC)
```

### 3. Dynamic Components + is Attribute

By using the is attribute, you can dynamically switch components.

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

### 4. Importing during script setup

In script setup, you can directly use the imported components.

```vue
<script setup>
import MyComponent from './MyComponent.vue'
</script>

<template>
  <MyComponent />
</template>
```

In addition, there are also asynchronous components, embedded components, and the `component` tag, but this time I will try to handle the above two (1, 2).

Regarding 3, if 1 and 2 can handle it, it is just an extension. As for 4, since script setup has not been implemented yet, we will put it off for a while.

## Basic Approach

The basic approach to resolving components is as follows:

- Somewhere, store the names and component records used in the template.
- Use helper functions to resolve components based on their names.

Both the form of 1 and the form of 2 simply store the names and component records, with the only difference being where they are registered.  
If you have the records, you can resolve the components from the names when necessary, so both implementations will be similar.

First, let's take a look at the expected code and the compilation result.

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
// Compilation result

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

It looks like this.

## Implementation

### AST

In order to generate code that resolves components, we need to know that "MyComponent" is a component.  
At the parse stage, we handle the tag name and separate it into a regular Element and a Component on the AST.

First, let's consider the definition of the AST.  
The ComponentNode, like a regular Element, has props and children.  
While consolidating these common parts as `BaseElementNode`, we will rename the existing `ElementNode` to `PlainElementNode`,  
and make `ElementNode` a union of `PlainElementNode` and `ComponentNode`.

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

The content is the same as before, but we distinguish them by `tagType` and treat them as separate ASTs.  
We will use this in the transform phase to add helper functions, etc.

### Parser

Next, let's implement the parser to generate the above AST.  
Basically, we just need to determine the `tagType` based on the tag name.

The problem is how to determine whether it is an Element or a Component.

The basic idea is simple: just determine whether it is a "native tag" or not.

・  
・  
・

"Wait, wait, that's not what I'm asking. How do we actually implement it?"

Yes, this is a brute force approach. We predefine a list of native tag names and determine whether it matches or not.  
As for what items should be enumerated, all of them should be written in the specification, so we will trust it and use it.

One problem, if any, is that "what is a native tag" can vary depending on the environment.  
In this case, it's the browser. What I mean is that "compiler-core should not depend on the environment".  
We have implemented such DOM-dependent implementations in compiler-dom so far, and this enumeration is no exception.

With that in mind, we will implement it so that the function "whether it is a native tag or not" can be injected as an option from outside the parser, considering future possibilities and making it easy to add various options later.

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

Now, in the compiler-dom, we will enumerate the native tag names and pass them as options.

Although I mentioned compiler-dom, the enumeration itself is done in shared/domTagConfig.ts.

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

It looks quite ominous, doesn't it?

But this is the correct implementation.

https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/shared/src/domTagConfig.ts#L6

Create compiler-dom/parserOptions.ts and pass it to the compiler.

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

The implementation of the parser is complete, so we will now proceed to implement the remaining parts.

The remaining part is very simple. We just need to determine whether it is a component or not and assign a tagType.

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
    // NOTE: In Vue.js, tags starting with uppercase letters are treated as components.
    // ref: https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/compiler-core/src/parse.ts#L662
    /^[A-Z]/.test(tag) ||
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true
  }
}
```

With this, the parser and AST are complete. We will now proceed to implement the transform and codegen using these.

### Transform

What needs to be done in the transform is very simple.

In transformElement, we just need to make a slight conversion if the Node is a ComponentNode.

At this time, we also register the component in the context.  
This is done so that we can resolve it collectively during codegen.
As mentioned later, components will be resolved collectively as assets in codegen.

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
  context.components.add(tag) // explained later
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

We also make sure to register it in the context.

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

And then, all the components in the context are registered in the RootNode of the target components.

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

With this, all that's left is to use RootNode.components in codegen.

### Codegen

The code simply generates code by passing the name to helper functions to resolve, just like the compilation result we saw at the beginning. We are abstracting it as "assets" for future considerations.

```ts
export const generate = (ast: RootNode, option: CompilerOptions): string => {
  // .
  // .
  genFunctionPreamble(ast, context) // NOTE: Move this outside the function in the future

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

### Implementation on the runtime-core side

Now that we have generated the desired code, let's move on to the implementation in runtime-core.

#### Adding "component" as an option for components

This is simple, just add it to the options.

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

#### Adding "components" as an option for the app

This is also simple.

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

#### Implementing a function to resolve components from the above two

There is nothing special to explain here.  
It searches for components registered locally and globally, and returns the component.  
If it is not found, it returns the name as is as a fallback.

```ts
// runtime-core/helpers/componentAssets.ts

export function resolveComponent(name: string): ConcreteComponent | string {
  const instance = currentInstance || currentRenderingInstance // explained later
  if (instance) {
    const Component = instance.type
    const res =
      // local registration
      resolve((Component as ComponentOptions).components, name) ||
      // global registration
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

One thing to note is `currentRenderingInstance`.

In order to traverse locally registered components in `resolveComponent`, we need to access the currently rendering component.  
(We want to search the `components` option of the component being rendered)

With that in mind, let's prepare `currentRenderingInstance` and update it when rendering.

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

## Let's try it out

Great job! We can finally resolve components.

Let's try running it in the playground!

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

![resolve_components](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/resolve_components.png)

It seems to be working fine! Great job!

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/060_resolve_components)
