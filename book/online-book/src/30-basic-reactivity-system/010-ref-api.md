# ref api (Basic Reactivity System 部門スタート)

::: warning
2023 年 の 12 月末に [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) がリリースされましたが、これには [reactivity のパフォーマンス改善](https://github.com/vuejs/core/pull/5912) が含まれています。  
このオンラインブックはそれ以前の実装を参考にしていることに注意しくてださい。  
然るべきタイミングでこのオンラインブックも追従する予定です。  
:::

## ref api のおさらい (と実装)

Vue.js には Reactivity に関する様々な api がありますが、中でも ref はあまりに有名です。  
公式ドキュメントの方でも Reactivity Core という名目で、しかも一番最初に紹介されています。  
https://vuejs.org/api/reactivity-core.html#ref

ところで、ref とはどのような API でしょうか？
公式ドキュメントによると、

> The ref object is mutable - i.e. you can assign new values to .value. It is also reactive - i.e. any read operations to .value are tracked, and write operations will trigger associated effects.

> If an object is assigned as a ref's value, the object is made deeply reactive with reactive(). This also means if the object contains nested refs, they will be deeply unwrapped.

(引用: https://vuejs.org/api/reactivity-core.html#ref)

とあります。

要するに、ref object というのは 2 つの性質を持ちます。

- value プロパティに対する get/set は track/trigger が呼ばれる
- value プロパティにオブジェクトが割り当てられた際は value プロパティの値は reactive オブジェクトになる

コードベースで説明しておくと、

```ts
const count = ref(0)
count.value++ // effect (性質 1 )

const state = ref({ count: 0 })
state.value = { count: 1 } // effect (性質 1 )
state.value.count++ // effect (性質 2 )
```

ということです。

ref と reactive の区別がつかないうちは、`ref(0)`と`reactive({ value: 0 })` の区別をごちゃごちゃにしてしまいがちですが、上記の 2 つの性質から考えると全く意味が別だということがわかります。
ref は `{ value: x }` という reactive オブジェクトを生成するわけではありません。value に対する get/value の track/trigger は ref の実装が行い、x に当たる部分がオブジェクトの場合は reactive オブジェクトにするということです。

実装のイメージ的にはこういう感じです。

```ts
class RefImpl<T> {
  private _value: T
  public dep?: Dep = undefined

  get value() {
    trackRefValue(this)
  }

  set value(newVal) {
    this._value = toReactive(v)
    triggerRefValue(this)
  }
}

const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value
```

実際にソースコードを見ながら ref を実装してみましょう！  
色々な関数や class がありますが、とりあえず RefImpl クラスと ref 関数を中心的に読んでもらえればよいかと思います。

以下のようなソースコードが動かせるようになれば OK です！
(※注: template のコンパイラは別で ref に対応する必要があるので動きません)

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const count = ref(0)

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['Increment']),
      ])
  },
})

app.mount('#app')
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/010_ref)

## shallowRef

さて、続けてどんどん ref 周りの api を実装していきます。  
先ほど、ref の性質として「value プロパティにオブジェクトが割り当てられた際は value プロパティの値は reactive オブジェクトになる」というものを紹介しましたが、この性質を持たないのが shallowRef です。

> Unlike ref(), the inner value of a shallow ref is stored and exposed as-is, and will not be made deeply reactive. Only the .value access is reactive.

(引用: https://vuejs.org/api/reactivity-advanced.html#shallowref)

やることは非常に単純で、RefImpl の実装はそのまま使い、`toReactive`の部分をスキップします。  
ソースコードを読みながら実装していきましょう！

以下のようなソースコードが動かせるようになれば OK です！

```ts
import { createApp, h, shallowRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // clickしても描画は更新されない
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),
      ])
  },
})

app.mount('#app')
```

### triggerRef

前述の通り、shallow ref が持つ value は reactive オブジェクトではないので、変更を加えてもエフェクトがトリガーされることはありません。  
しかし、value 自体はオブジェクトなので変更されています。  
そこで、強制的にトリガーさせる api が存在します。それが triggerRef です。

https://vuejs.org/api/reactivity-advanced.html#triggerref

```ts
import { createApp, h, shallowRef, triggerRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 })
    const forceUpdate = () => {
      triggerRef(state)
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.value.count}`]),

        h(
          'button',
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 }
            },
          },
          ['increment'],
        ),

        h(
          'button', // clickしても描画は更新されない
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // 描画が今の state.value.count が持つ値に更新される
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/020_shallow_ref)

## toRef

toRef は reactive オブジェクトのプロパティへの ref を生成する api です。

https://vuejs.org/api/reactivity-utilities.html#toref

props の特定のプロパティを ref に変換したりする際によく利用します。

```ts
const count = toRef(props, 'count')
console.log(count.value)
```

toRef によって作られた ref は元の reactive オブジェクトと同期され、
この ref に変更を加えると元の reactive オブジェクトも更新され、元の reactive オブジェクトに変更があるとこの ref も更新されます.

```ts
import { createApp, h, reactive, toRef } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const stateCountRef = toRef(state, 'count')

    return () =>
      h('div', {}, [
        h('p', {}, [`state.count: ${state.count}`]),
        h('p', {}, [`stateCountRef.value: ${stateCountRef.value}`]),
        h('button', { onClick: () => state.count++ }, ['updateState']),
        h('button', { onClick: () => stateCountRef.value++ }, ['updateRef']),
      ])
  },
})

app.mount('#app')
```

ソースコードを読みつつ実装していきましょう！

※ v3.3 からは toRef に normalization の機能が追加されました。chibivue ではこの機能を実装していません。  
詳しくは公式ドキュメントのシグネチャをチェックしてみてください! (https://vuejs.org/api/reactivity-utilities.html#toref)

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/030_to_ref)

## toRefs

reactive オブジェクトの全てのプロパティの ref を生成します。

https://vuejs.org/api/reactivity-utilities.html#torefs

```ts
import { createApp, h, reactive, toRefs } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ foo: 1, bar: 2 })
    const stateAsRefs = toRefs(state)

    return () =>
      h('div', {}, [
        h('p', {}, [`[state]: foo: ${state.foo}, bar: ${state.bar}`]),
        h('p', {}, [
          `[stateAsRefs]: foo: ${stateAsRefs.foo.value}, bar: ${stateAsRefs.bar.value}`,
        ]),
        h('button', { onClick: () => state.foo++ }, ['update state.foo']),
        h('button', { onClick: () => stateAsRefs.bar.value++ }, [
          'update stateAsRefs.bar.value',
        ]),
      ])
  },
})

app.mount('#app')
```

こちらは toRef の実装を使って簡単に実装できるかと思います。

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/040_to_refs)
