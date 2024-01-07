# Effect のクリーンアップと Effect Scope

::: warning
2023 年 の 12 月末に [Vue 3.4](https://blog.vuejs.org/posts/vue-3-4) がリリースされましたが、これには [reactivity のパフォーマンス改善](https://github.com/vuejs/core/pull/5912) が含まれています。  
このオンラインブックはそれ以前の実装を参考にしていることに注意しくてださい。  
然るべきタイミングでこのオンラインブックも追従する予定です。  
:::

## ReactiveEffect のクリーンアップ

私たちは今まで登録した effect のクリーンアップを行っていません。ReactiveEffect にクリーンアップの処理を追加してみましょう。

ReactiveEffect に stop というメソッドを実装します。  
ReactiveEffect に自身がアクティブかどうかというフラグを持たせ、stop メソッドではそれを false に切り替えつつ、deps の削除を行います。

```ts
export class ReactiveEffect<T = any> {
  active = true // 追加
  //.
  //.
  //.
  stop() {
    if (this.active) {
      this.active = false
    }
  }
}
```

ついでに、cleanUp 時に行いたい処理を登録できるような hooks の実装と、activeEffect が自身だった場合のハンドリングを追加しておきます。

```ts
export class ReactiveEffect<T = any> {
  private deferStop?: boolean // 追加
  onStop?: () => void // 追加
  parent: ReactiveEffect | undefined = undefined // 追加 (finallyで参照したいので)

  run() {
    if (!this.active) {
      return this.fn() // active が false な場合は単に関数を実行するだけに
    }

    try {
      this.parent = activeEffect
      activeEffect = this
      const res = this.fn()
      return res
    } finally {
      activeEffect = this.parent
      this.parent = undefined
      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      // activeEffectが自身だった場合はrunが終わった最後にstopするようにフラグを立てる
      this.deferStop = true
    } else if (this.active) {
      // ...
      if (this.onStop) {
        this.onStop() // 登録されたフックを実行
      }
      // ...
    }
  }
}
```

ReactiveEffect にクリーンアップ処理が登録できたので、ついでに watch のクリーンアップ関数を実装してみましょう。

以下のようなコードが動くようになれば OK です。

```ts
import { createApp, h, reactive, watch } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    const unwatch = watch(
      () => state.count,
      (newValue, oldValue, cleanup) => {
        alert(`New value: ${newValue}, old value: ${oldValue}`)
        cleanup(() => alert('Clean Up!'))
      },
    )

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, [`increment`]),
        h('button', { onClick: unwatch }, [`unwatch`]),
      ])
  },
})

app.mount('#app')
```

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/130_cleanup_effects)

## Effect Scope とは

さて、effect をクリーンアップできるようになったわけなので、コンポーネントがアンマウントされた際にも不要な effect はクリーンアップしたいものです。
しかし、watch にしろ computed にしろ、たくさんの effect を収集するのは少々めんどくさいです。
愚直に実装しようと思うと、以下のようになってしまいます。

```ts
let disposables = []

const counter = ref(0)

const doubled = computed(() => counter.value * 2)
disposables.push(() => stop(doubled.effect))

const stopWatch = watchEffect(() => console.log(`counter: ${counter.value}`))
disposables.push(stopWatch)
```

```ts
// cleanup effects
disposables.forEach(f => f())
disposables = []
```

このような管理はめんどくさいですし、必ずどこかでミスります。

そこで、Vue には EffectScope という機構があります。
https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md

イメージ的には 1 インスタンス 1 EffectScope を持つ感じで、具体的には以下のようなインタフェースになっています。

```ts
const scope = effectScope()

scope.run(() => {
  const doubled = computed(() => counter.value * 2)

  watch(doubled, () => console.log(doubled.value))

  watchEffect(() => console.log('Count: ', doubled.value))
})

// to dispose all effects in the scope
scope.stop()
```

引用元: https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md#basic-example

そして、この EffectScope というのはユーザー向けの API としても公開されています。  
https://ja.vuejs.org/api/reactivity-advanced.html#effectscope

## EffectScope の実装

先ほども言ったように、1 インスタンスに 1 EffectScope を持つような形をとります。

```ts
export interface ComponentInternalInstance {
  scope: EffectScope
}
```

そして、アンマウント時に収集しておいた effect を stop します

```ts
const unmountComponent = (...) => {
  // .
  // .
  const { scope } = instance;
  scope.stop();
  // .
  // .
}
```

EffectScope の構造ですが、activeEffectScope という現在 active な EffectScope を指す変数を一つ持ち、EffectScope に実装された on/off/run/stop というメソッドでその状態を管理します。  
on/off メソッドは、自身を activeEffectScope として持ち上げたり、持ち上げた状態を元に戻す(元々の EffectScope に戻す)といったことを行います。  
そして、ReactiveEffect が生成される際は、effect を activeEffectScope に登録するようにします。

少しわかりづらいので、イメージをソースコードで書くと、

```ts
instance.scope.on()

/** computed や watch などの何らかの ReactiveEffect が生成される */
setup()

instance.scope.off()
```

このようにすることで、生成された effect を instance の EffectScope に収集しておくことができるというわけです。  
あとは、この effect の stop メソッドを発火すると全ての effect のクリーンアップを行うことができます。

基本的な原理については理解できたはずなので、実際にソースコードを読みながら実装してみましょう！

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/30_basic_reactivity_system/140_effect_scope)
