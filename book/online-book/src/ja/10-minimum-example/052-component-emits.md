# Emit の実装

## 開発者インターフェース

props に引き続き emit の実装をしていきます．
emit の実装は比較的ライトなのですぐに終わります．

開発者インタフェース的には emit は setup 関数の第 2 引数から受け取れるような形にします．

```ts
const MyComponent: Component = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h('div', {}, [
        h('p', {}, [`someMessage: ${props.someMessage}`]),
        h('button', { onClick: () => emit('click:change-message') }, [
          'change message',
        ]),
      ])
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
        h(
          MyComponent,
          {
            'some-message': state.message,
            'onClick:change-message': changeMessage,
          },
          [],
        ),
      ])
  },
})
```

## 実装

props の時と同じように，`~/packages/runtime-core/componentEmits.ts`というファイルを作成してそこに実装していきます．

emit は単純に，instance に emit 用の関数を実装し，実行時は vnode が持つ props からハンドラを探し実行します．

`~/packages/runtime-core/componentEmits.ts`

```ts
export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) {
  const props = instance.vnode.props || {}
  let args = rawArgs

  let handler =
    props[toHandlerKey(event)] || props[toHandlerKey(camelize(event))]

  if (handler) handler(...args)
}
```

`~/packages/shared/general.ts`

```ts
export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)

export const toHandlerKey = (str: string) => (str ? `on${capitalize(str)}` : ``)
```

`~/packages/runtime-core/component.ts`

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  emit: (event: string, ...args: any[]) => void
}

export function createComponentInstance(
  vnode: VNode,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const instance: ComponentInternalInstance = {
    // .
    // .
    // .
    emit: null!, // to be set immediately
  }

  instance.emit = emit.bind(null, instance)
  return instance
}
```

これを setup 関数に渡してあげれば OK です．

`~/packages/runtime-core/componentOptions.ts`

```ts
export type ComponentOptions = {
  props?: Record<string, any>
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function // ctx.emitを受け取れるように
  render?: Function
}
```

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode));

    const { props } = instance.vnode;
    initProps(instance, props);

    const component = initialVNode.type as Component;
    if (component.setup) {
      // emitを渡してあげる
      instance.render = component.setup(instance.props, {
        emit: instance.emit,
      }) as InternalRenderFunction;
    }
```

先ほど想定していた開発者インタフェースの例で動作を確認してみましょう！  
ちゃんと動いていればこれで props/emit によるコンポーネント間のやりとりが行えるようになりました！

ここまでのソースコード：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/050_component_system3)
