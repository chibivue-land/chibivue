# 様々な Reactive Proxy Handler

::: warning
2023 年 の 12 月末に [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) がリリースされましたが、これには [reactivity のパフォーマンス改善](https://github.com/vuejs/core/pull/5912) が含まれています。  
このオンラインブックはそれ以前の実装を参考にしていることに注意しくてださい。  
然るべきタイミングでこのオンラインブックも追従する予定です。  
:::

## reactive にしたくないオブジェクト

さて、ここでは現状の Reactivity System のある問題について解決していきます。  
まずは以下のコードを動かしてみてください。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
      ])
  },
})

app.mount('#app')
```

コンソールを見てみると、以下のようになっていることが観測できるかと思います。

![reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/reactive_html_element.png)

ここで、focus をする処理を加えてみましょう。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value)
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

なんと、エラーになってしまいます。

![focus_in_reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/focus_in_reactive_html_element.png)

これの原因としては、document.getElementById によって取得した要素自体を元に Proxy を生成してしまっているためです。

Proxy を生成してしまうと値は当然元のオブジェクトではなく Proxy になってしまいますから、HTML 要素としての機能が失われてしまっているのです。

## reactive Proxy を生成する前にオブジェクトを判定する。

判定方法はとてもシンプルです。`Object.prototype.toString`を利用します。
先ほどのコードで、Object.prototype.toString を使うと HTMLInputElement はどのように判定されるかみてみましょう。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const getRef = () => {
      inputRef.value = document.getElementById(
        'my-input',
      ) as HTMLInputElement | null
      console.log(inputRef.value?.toString())
    }
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { id: 'my-input' }, []),
        h('button', { onClick: getRef }, ['getRef']),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

![element_to_string](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/element_to_string.png)

このようにしてどのようなオブジェクトなのかというのを知ることができます。ややハードコードですが、この判定関数を一般化します。

```ts
// shared/general.ts
export const objectToString = Object.prototype.toString // isMapやisSetなどで既出
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 今回追加する関数
export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
}
```

slice しているのは、`[Object hoge]`の hoge に当たる文字列を取得するためです。

そして、reactive toRawType によってオブジェクトの種類を判別し、分岐していきましょう。  
HTMLInput の場合は Proxy の生成をスキップするようにします。

reactive.ts の方で、rawType を取得し、reactive のターゲットとなるオブジェクトのタイプを判定します。

```ts
const enum TargetType {
  INVALID = 0,
  COMMON = 1,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}

function getTargetType<T extends object>(value: T) {
  return !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
```

```ts
export function reactive<T extends object>(target: T): T {
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

これで先ほどのフォーカスのコードが動くようになったはずです！

![focus_in_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/focus_in_element.png)

## TemplateRefs を実装してみる

せっかく Ref に HTML 要素を入れられるようになったので、TemplateRef を実装してみましょう。

ref は ref 属性を利用することで template への参照を取ることができます。

https://vuejs.org/guide/essentials/template-refs.html

目標は以下のようなコードが動くようになることです。

```ts
import { createApp, h, ref } from 'chibivue'

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null)
    const focus = () => {
      inputRef.value?.focus()
    }

    return () =>
      h('div', {}, [
        h('input', { ref: inputRef }, []),
        h('button', { onClick: focus }, ['focus']),
      ])
  },
})

app.mount('#app')
```

ここまでやってきたみなさんならば、実装方法はもう見えてるかと思います。
そう、VNode に ref を持たせて render 時に値をぶち込んでやればいいわけです。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  key: string | number | symbol | null
  ref: Ref | null // これ
  // .
  // .
}
```

本家の実装でいうと、setRef という関数です。探して、読んで、実装をしてみましょう！  
本家の方では配列で ref を持ったり、$ref でアクセスできるようにしたりと色々複雑になっていますが、とりあえず上記のコードが動く程度のものを目指してみましょう。

ついでに、component だった場合は component の setupContext を ref に代入してあげましょう。  
(※ ここは本当はコンポーネントの proxy を渡すべきなんですが、まだ未実装のため setupContext ということにしています。)

```ts
import { createApp, h, ref } from 'chibivue'

const Child = {
  setup() {
    const action = () => alert('clicked!')
    return { action }
  },

  template: `<button @click="action">action (child)</button>`,
}

const app = createApp({
  setup() {
    const childRef = ref<any>(null)
    const childAction = () => {
      childRef.value?.action()
    }

    return () =>
      h('div', {}, [
        h('div', {}, [
          h(Child, { ref: childRef }, []),
          h('button', { onClick: childAction }, ['action (parent)']),
        ]),
      ])
  },
})

app.mount('#app')
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/110_template_refs)

## key が増減するオブジェクトに対応する

実は、今の実装では key が増減するオブジェクトに対応できていません。
この、「key が増減するオブジェクト」と言うのは配列も含みます。  
要するに、以下のようなコンポーネントが正常に動作しません。

```ts
const App = {
  setup() {
    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now()) // trigger しても何も effect がない (この時、set の key は "0")
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now() // trigger しても何も effect がない (key 新しく設定された key)
    }

    return () =>
      h('div', {}, [
        h('p', {}, [`array: ${JSON.stringify(array.value)}`]),
        h('button', { onClick: mutateArray }, ['update array']),

        h('p', {}, [`record: ${JSON.stringify(record)}`]),
        h('button', { onClick: mutateRecord }, ['update record']),
      ])
  },
}
```

これを解決するにはどうしたら良いでしょうか?

### 配列の場合

配列もいってしまえばオブジェクトなので、新しい要素を追加するとその index が key として Proxy の set の handler に入ってきます。

```ts
const p = new Proxy([], {
  set(target, key, value, receiver) {
    console.log(key) // ※
    Reflect.set(target, key, value, receiver)
    return true
  },
})

p.push(42) // 0
```

しかしこれらの key をそれぞれ track するわけにはいきません。
そこで、length を track することで配列の変更をトリガーするようにします。

length を track すると言いましたが、実はすでに track されるようになっています。

以下のようなコードをブラウザなどで実行してみると JSON.stringify で配列を文字列化した際に length が呼ばれていることがわかります。

```ts
const data = new Proxy([], {
  get(target, key) {
    console.log('get!', key)
    return Reflect.get(target, key)
  },
})

JSON.stringify(data)
// get! length
// get! toJSON
```

つまりすでに length には effect が登録されているので、あとは index が set された時に、この effect を取り出して trigger してあげれば良いわけです。

入ってきた key が index かどうかを判定して、index だった場合は length の effect を trigger するようにします。
他にも dep がある可能性はもちろんあるので、 deps という配列に切り出して、effect を詰めてまとめて trigger してあげます。

```ts
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  // これ
  if (isIntegerKey(key)) {
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

```ts
// shared/general.ts
export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key
```

これで配列の場合は動くようになりました。

### オブジェクト(レコード)の場合

続いてはオブジェクトですが、配列とは違い length という情報は持っていません。

これは一工夫します。  
`ITERATE_KEY` というシンボルを用意してこれを配列の時の length のように使います。  
何を言っているのかよく分からないかもしれませんが、depsMap はただの Map なので、別に勝手に用意したものを key として使っても問題ありません。

配列の時と少し順番は変わりますが、まず trigger から考えてみます。
あたかも `ITERATE_KEY` というものが存在し、そこに effect が登録されているかのような実装をしておけば OK です。

```ts
export const ITERATE_KEY = Symbol()

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  if (!isArray(target)) {
    // 配列でない場合は、ITERATE_KEY に登録された effect を trigger する
    deps.push(depsMap.get(ITERATE_KEY))
  } else if (isIntegerKey(key)) {
    // new index added to array -> length changes
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

問題は、この `ITERATE_KEY` に対してどう effect をトラックするかです。

ここで、 `ownKeys` と言う Proxy ハンドラを利用します。

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys

ownKeys は `Object.keys()` や `Reflect.ownKeys()` などで呼ばれますが、実は `JSON.stringify` でも呼ばれます。

試しに以下のコードをブラウザなどで動かしてみるとそれを確認できます。

```ts
const data = new Proxy(
  {},
  {
    get(target, key) {
      return Reflect.get(target, key)
    },
    ownKeys(target) {
      console.log('ownKeys!!!')
      return Reflect.ownKeys(target)
    },
  },
)

JSON.stringify(data)
```

あとはこれを利用して `ITERATE_KEY` を track すれば良いわけです。
配列だった場合は、必要ないのでテキトーに length を track してあげます。

```ts
export const mutableHandlers: ProxyHandler<object> = {
  // .
  // .
  ownKeys(target) {
    track(target, isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
}
```

これでキーが増減するオブジェクトに対応でき多はずです！

## Collection 系の組み込みオブジェクトに対応する

今、reactive.ts の実装を見てみると、Object と Array のみを対象としています。

```ts
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    default:
      return TargetType.INVALID
  }
}
```

Vue.js では、これらに加え、Map, Set, WeakMap, WeakSet に対応しています。

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/reactive.ts#L43C1-L56C2

そして、これらのオブジェクトは別の Proxy ハンドラとして実装されています。それが、`collectionHandlers`と呼ばれるものです。

ここでは、この collectionHandlers を実装し、以下のようなコードが動くことを目指します。

```ts
const app = createApp({
  setup() {
    const state = reactive({ map: new Map(), set: new Set() })

    return () =>
      h('div', {}, [
        h('h1', {}, [`ReactiveCollection`]),

        h('p', {}, [
          `map (${state.map.size}): ${JSON.stringify([...state.map])}`,
        ]),
        h('button', { onClick: () => state.map.set(Date.now(), 'item') }, [
          'update map',
        ]),

        h('p', {}, [
          `set (${state.set.size}): ${JSON.stringify([...state.set])}`,
        ]),
        h('button', { onClick: () => state.set.add('item') }, ['update set']),
      ])
  },
})

app.mount('#app')
```

collectionHandlers では、add や set, delete といったメソッドの getter にハンドラを実装します。  
それらを実装しているのが collectionHandlers.ts です。  
https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/collectionHandlers.ts#L0-L1  
TargetType を判別し、collection 型の場合 h にはこのハンドラを元に Proxy を生成します。  
実際に実装してみましょう!

注意点としては、Reflect の receiver に target 自身を渡す点で、target 自体に Proxy が設定されていた場合に無限ループになることがある点です。  
これを回避するために target に対して生のデータも持たせておくような構造に変更し、Proxy のハンドラを実装するにあたってはこの生データを操作するように変更します。

```ts
export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}
```

厳密には今までの通常の reactive ハンドラでもこの実装をしておくべきだったのですが、今までは特に問題なかったという点と余計な説明をなるべく省くために省略していました。  
getter に入ってきたの key が ReactiveFlags.RAW の場合には Proxy ではなく生のデータを返すような実装にしてみましょう。

それに伴って、target から再帰的に生データをとり、最終的に全てが生の状態のデータを取得する toRaw という関数も実装しています。

```ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
```

ちなみに、この toRaw 関数は API としても提供されている関数です。

https://ja.vuejs.org/api/reactivity-advanced.html#toraw

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/120_proxy_handler_improvement)
