# コンポーネントを解決する

実は、まだ私たちの chibivue の template はコンポーネントを解決することができません。  
ここでそれを実装していくのですが、Vue.js ではコンポーネントの解決方法がいくつかあります。

まずはいくつかの解決方法についておさらいしてみましょう。

## コンポーネントの解決方法

### 1. Components Option (ローカル登録)

おそらく、これが最も単純なコンポーネントの解決方法です。

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

components オプションに指定したオブジェクトの key 名が、テンプレート内で使用できるコンポーネント名になります。

### 2. app に登録 (グローバル登録)

作成した Vue アプリケーションの `.component()` メソッドを使うことでアプリケーション全体で使用できるコンポーネントを登録することができます。

https://vuejs.org/guide/components/registration.html#global-registration

```ts
import { createApp } from 'vue'

const app = createApp({})

app
  .component('ComponentA', ComponentA)
  .component('ComponentB', ComponentB)
  .component('ComponentC', ComponentC)
```

### 3. 動的コンポーネント + is 属性

is 属性を使うことで、動的にコンポーネントを切り替えることができます。

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

### 4. script setup 時の import

script setup では、import したコンポーネントをそのまま使用することができます。

```vue
<script setup>
import MyComponent from './MyComponent.vue'
</script>

<template>
  <MyComponent />
</template>
```

---

他にも、非同期コンポーネントや組み込みコンポーネント, `component` タグなどもありますが、今回は上記 ２ つ (1, 2) に対応してみようと思います。

3 に関しては、1, 2 が対応できれば拡張するだけです。 4 に関してはまだ script setup を実装していないので、少し後回しにします。

## 基本アプローチ

どのようにコンポーネントを解決していくかですが、基本的には以下のような流れになります。

- どこかしらに、テンプレート内で使う名前とコンポーネントのレコードを保持する
- ヘルパー関数を用いて、名前を元にコンポーネントを解決する

1 の形も 2 の形も、登録する場所が少々異なるだけで、単に名前とコンポーネントのレコードを保持しているだけです。  
レコードを保持していれば、必要になったところで名前からコンポーネントを解決することができるので、どちらも同じような実装になります。

先に、想定されるコードと、コンパイル結果を見てみましょう。

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
// コンパイル結果

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

このような感じです。

## 実装

### AST

コンポーネントとして解決するコードを生成するためには、"MyComponent" がコンポーネントであることを知っている必要があります。  
parse の段階で、タグ名をハンドリングして、AST 上は通常の Element と Component で分けるようにします。

まずは AST の定義を考えてみましょう。  
ComponentNode は通常の Element と同じように、 props や children を持ちます。  
これらの共通部分を `BaseElementNode` としてまとめつつ、これまでの `ElementNode` は `PlainElementNode` とし、  
`ElementNode` は `PlainElementNode` と `ComponentNode` のユニオンにしてしまいます。

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

内容としては今のところ変わりありませんが、tagType だけ区別して、 ast は別物として扱います。  
今後、これを使って transform の方で helper 関数の追加であったりを行っていきます。

### Parser

さて続いては、上記の AST を生成するためのパーサの実装です。  
基本的には tag 名を判断して tagType を決めるだけです。

問題は、どうやって Element なのか Component なのかを判断するかです。

基本的な考え方は単純で、"ネイティブなタグかどうか" を判断するだけです。

・  
・  
・

「え、いやいや、だからそれをどうやって実装するかという話じゃないの ?」

はい。ここは力技です。ネイティブなタグ名をあらかじめ列挙し、それにマッチするかどうかで判断します。  
列挙するべき項目なんてものは、仕様をみに行けば全て書いてあるはずなので、それを信頼して使います。

ここで一つ、問題があるとすれば、「何がネイティブなタグかどうかは環境によって変わる」という点です。  
今回でいえば、ブラウザです。何が言いたいのかというと、「compiler-core は環境依存であってはならない」ということです。  
私たちはこれまで DOM に依存するような実装は compiler-dom に実装してきました。今回のこの列挙もその例外ではありません。

それに伴って、「ネイティブなタグ名であるかどうか」という関数をパーサのオプションとして外から注入できるような実装にします。

これからのことも考えて、オプションは色々後から追加しやすいようにしておきます。

```ts
type OptionalOptions = 'isNativeTag' // | TODO: 今後増やしていく (かも)

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

さてさて、そうしましたら、 compiler-dom の方でネイティブなタグ名を列挙して、それをオプションとして渡してあげます。

compiler-dom と言いましたが、実は列挙自体は shared/domTagConfig.ts で行われています。

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

なんとも禍々しいですね！！

でもこれが正しい実装なのです。

https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/shared/src/domTagConfig.ts#L6

compiler-dom/parserOptions.ts を作成し、コンパイラに渡します。

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

少し話が飛びましたが、パーサの実装に必要なものは揃ったので、残りの部分を実装していきます。

残りはとっても簡単です。コンポーネント化どうかを判断して tagType を生やしてあげるだけです。

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
    // NOTE: Vue.js では、先頭が大文字のタグはコンポーネントとして扱われるようです。
    // ref: https://github.com/vuejs/core/blob/32bdc5d1900ceb8df1e8ee33ea65af7b4da61051/packages/compiler-core/src/parse.ts#L662
    /^[A-Z]/.test(tag) ||
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true
  }
}
```

これで parser と AST は OK です。これからはこれらを使って transform と codegen を実装していきます。

### Transform

transform の方でやることはとても簡単です。

transformElement で、Node が ComponentNode だった場合に少々変換してあげるだけです。

この際、context にも component を登録しておいてあげます。  
これは、codegen の際にまとめて resolve してあげるためです。
後述しますが、codegen の方ではコンポーネントは assets としてまとめて resolve されます。

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
  context.components.add(tag) // 後述
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

context の方にも登録できるようにしておきます。

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

そして、context にまとめられて components は登録対象のコンポーネントの RootNode に全て登録してあげます。

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

これで、あとは RootNode.components を codegen で使うだけです。

### Codegen

最初に見たコンパイル結果のように、ヘルパー関数に名前を渡して解決するコードを生成するだけです。  
今後のためを考えて assets というふうな抽象化をしています。

```ts
export const generate = (ast: RootNode, option: CompilerOptions): string => {
  // .
  // .
  genFunctionPreamble(ast, context) // NOTE: 将来的には関数の外に出す

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

### runtime-core 側の実装

ここまでくれば目的のコードは生成できているので、あとは runtime-core の実装です。

#### コンポーネントのオプションとして component を追加できるように

これは単純で、option に追加するだけです。

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

#### app のオプションとして components を追加できるように

こちらも単純です。

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

#### 上記二つからコンポーネントを解決する関数の実装

こちらも特に説明することはないでしょう。  
ローカル/グローバルに登録されたコンポーネントをそれぞれに探索し、コンポーネントを返します。  
見つからなかった場合は fallback としてそのまま名前を返します。

```ts
// runtime-core/helpers/componentAssets.ts

export function resolveComponent(name: string): ConcreteComponent | string {
  const instance = currentInstance || currentRenderingInstance // 後述
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

一点、注意点があるのは `currentRenderingInstance` についてです。

resolveComponent ではローカル登録されたコンポーネントを辿るために、現在レンダリングされているコンポーネントにアクセスする必要があります。  
(レンダリング中のコンポーネントの components オプションを探索したいため)

それに伴って、`currentRenderingInstance` というものを用意し、レンダリングする際にこれを更新していく実装にしてみます。

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

## いざ動かしてみる

お疲れ様でした。ここまででようやくコンポーネントを解決することができるようになりました。

実際にプレイグラウンドの方で動かしてみましょう！

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

正常に動作しているようです！やったね！

ここまでのソースコード: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/060_resolve_components)
