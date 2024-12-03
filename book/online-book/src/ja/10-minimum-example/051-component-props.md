# Props の実装

## 開発者インターフェース

まずは props から実装していきます．  
最終的な開発者インタフェースから考えてみましょう．  
props は setup 関数の第一引数として渡ってくるようなものを考えてみます．

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })

    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(MyComponent, { message: state.message }, []),
      ])
  },
})
```

## 実装

これを元に ComponentInternalInstance に持たせたい情報を考えてみます．
`props: { message: { type: String } }`のように指定された props の定義と，props の値を実際に保持するプロパティが必要なので以下のように追加します．

```ts
export type Data = Record<string, unknown>

export interface ComponentInternalInstance {
  // .
  // .
  // .
  propsOptions: Props // `props: { message: { type: String } }` のようなオブジェクトを保持

  props: Data // 実際に親から渡されたデータを保持 (今回の場合、 `{ message: "hello" }` のような感じになる)
}
```

`~/packages/runtime-core/componentProps.ts`というファイルを以下の内容で新たに作成します．

```ts
export type Props = Record<string, PropOptions | null>

export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: null | undefined | object
}

export type PropType<T> = { new (...args: any[]): T & {} }
```

ユーザーがコンポーネントを実装する際のオプションにも追加します．

```ts
export type ComponentOptions = {
  props?: Record<string, any> // 追加
  setup?: () => Function
  render?: Function
}
```

オプションから渡された props の定義を createComponentInstance でインスタンスを生成する際に propsOptions にセットします．

```ts
export function createComponentInstance(
  vnode: VNode
): ComponentInternalInstance {
  const type = vnode.type as Component;

  const instance: ComponentInternalInstance = {
    // .
    // .
    // .
    propsOptions: type.props || {},
    props: {},
```

肝心の instance.props をどう形成するかというと，コンポーネントのマウント時に vnode が保持している props を propsOptions を元にフィルターします．
フィルターしてできたオブジェクトを reactive 関数によってリアクティブなオブジェクトにし，instance.prop にセットします．

この一連の流れを実装する`initProps`という関数を componentProps.ts に実装します．

```ts
export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const props: Data = {}
  setFullProps(instance, rawProps, props)
  instance.props = reactive(props)
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]
      if (options && options.hasOwnProperty(key)) {
        props[key] = value
      }
    }
  }
}
```

実際に mount 時に initProps を実行し，setup 関数の引数に props を渡してみましょう．

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode));

    // init props
    const { props } = instance.vnode;
    initProps(instance, props);

    const component = initialVNode.type as Component;
    if (component.setup) {
      instance.render = component.setup(
        instance.props // setupに渡す
      ) as InternalRenderFunction;
    }
    // .
    // .
    // .
```

```ts
export type ComponentOptions = {
  props?: Record<string, any>
  setup?: (props: Record<string, any>) => Function // propsを受け取るように
  render?: Function
}
```

この時点で props を子コンポーネントに渡せるようになっているはずなので playground で確認してみましょう．

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props: { message: string }) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })

    return () =>
      h('div', { id: 'my-app' }, [
        h(MyComponent, { message: state.message }, []),
      ])
  },
})
```

しかし，実はこれだけでは不十分で，props を変更した際に描画が更新されません．

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props: { message: string }) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(MyComponent, { message: state.message }, []),
        h('button', { onClick: changeMessage }, ['change message']),
      ])
  },
})
```

このようなコンポーネントを動作させるために，componentProps.ts に `updateProps` を実装し，コンポーネントが update する際に実行してあげます．

`~/packages/runtime-core/componentProps.ts`

```ts
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const { props } = instance
  Object.assign(props, rawProps)
}
```

`~/packages/runtime-core/renderer.ts`

```ts
const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement
  ) => {
    const componentUpdateFn = () => {
      const { render } = instance;
      if (!instance.isMounted) {
        const subTree = (instance.subTree = normalizeVNode(render()));
        patch(null, subTree, container);
        initialVNode.el = subTree.el;
        instance.isMounted = true;
      } else {
        let { next, vnode } = instance;

        if (next) {
          next.el = vnode.el;
          next.component = instance;
          instance.vnode = next;
          instance.next = null;
          updateProps(instance, next.props); // ここ
```

これで画面が更新されるようになれば OK です．
これで props を利用することによってコンポーネントにデータを受け渡せるようになりました！　やったね！

![props](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/props.png)

ここまでのソースコード：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/050_component_system2)

ついでと言ってはなんなのですが，本家 Vue は props をケバブケースで受け取ることができるのでこれも実装してみましょう．  
ここで，新たに `~/packages/shared` というディレクトリを作成し， `general.ts` を作成します．  
ここは，runtime-core や runtime-dom に限らず，汎用的な関数を定義する場所です．
このタイミングで作る意味というのは特別ないのですが，本家に倣ってついでに作っておきます．
そして，今回は `hasOwn` と `camelize` を実装してみます．

`~/packages/shared/general.ts`

```ts
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol,
): key is keyof typeof val => hasOwnProperty.call(val, key)

const camelizeRE = /-(\w)/g
export const camelize = (str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
}
```

componentProps.ts で camelize してあげましょう．

```ts
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const { props } = instance
  // -------------------------------------------------------------- ここ
  Object.entries(rawProps ?? {}).forEach(([key, value]) => {
    props[camelize(key)] = value
  })
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]
      // -------------------------------------------------------------- ここ
      // kebab -> camel
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        props[camelKey] = value
      }
    }
  }
}
```

これでケバブケースを扱うこともできるようになったはずです． playground で確認してみましょう．

```ts
const MyComponent = {
  props: { someMessage: { type: String } },

  setup(props: { someMessage: string }) {
    return () => h('div', {}, [`someMessage: ${props.someMessage}`])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(MyComponent, { 'some-message': state.message }, []),
        h('button', { onClick: changeMessage }, ['change message']),
      ])
  },
})
```