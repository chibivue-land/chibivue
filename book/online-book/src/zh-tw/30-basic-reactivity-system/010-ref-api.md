# ref api（基礎響應式系統開始）

::: warning
這裡解釋的實現基於當前草擬的[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)之前的版本．  
一旦[響應式優化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的內容將更新以與其保持一致．
:::

## ref api 的回顧（和實現）

Vue.js 有各種與響應式相關的 API，其中 ref 特別著名．  
即使在官方文件中，它也作為"響應式核心"名稱下的第一個主題被介紹．  
https://vuejs.org/api/reactivity-core.html#ref

那麼，什麼是 ref API？
根據官方文件，

> ref 物件是可變的 - 即你可以為 .value 分配新值。它也是響應式的 - 即對 .value 的任何讀取操作都會被追蹤，寫入操作會觸發相關的 effect。

> 如果將物件分配為 ref 的值，該物件會透過 reactive() 變成深度響應式的。這也意味著如果物件包含嵌套的 ref，它們將被深度解包。

（引用：https://vuejs.org/api/reactivity-core.html#ref）

簡而言之，ref 物件有兩個特徵：

- 對 value 屬性的獲取/設置操作會觸發 track/trigger．
- 當物件被分配給 value 屬性時，value 屬性變成響應式物件．

用程式碼來解釋，

```ts
const count = ref(0)
count.value++ // effect（特徵 1）

const state = ref({ count: 0 })
state.value = { count: 1 } // effect（特徵 1）
state.value.count++ // effect（特徵 2）
```

就是這個意思．

在你能夠區分 ref 和 reactive 之前，你可能會混淆 `ref(0)` 和 `reactive({ value: 0 })` 之間的區別，但考慮到上面提到的兩個特徵，你可以看到它們有完全不同的含義．
ref 不會生成像 `{ value: x }` 這樣的響應式物件．對 value 的獲取/設置操作的 track/trigger 是由 ref 的實現執行的，如果對應於 x 的部分是物件，它就會變成響應式物件．

在實現方面，它看起來像這樣：

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

讓我們在查看原始碼的同時實現 ref！
有各種函式和類別，但現在，專注於 RefImpl 類別和 ref 函式就足夠了．

一旦你能執行以下原始碼，就可以了！
（注意：模板編譯器需要單獨支援 ref，所以它不會工作）

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

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/010_ref)

## shallowRef

現在，讓我們繼續實現更多與 ref 相關的 API．  
如前所述，ref 的特徵之一是"當物件被分配給 value 屬性時，value 屬性變成響應式物件"．shallowRef 沒有這個特徵．

> 與 ref() 不同，淺層 ref 的內部值按原樣儲存和暴露，不會被深度響應式化。只有 .value 存取是響應式的。

（引用：https://vuejs.org/api/reactivity-advanced.html#shallowref）

任務非常簡單．我們可以按原樣使用 RefImpl 的實現，並跳過 `toReactive` 部分．  
讓我們在閱讀原始碼的同時實現它！

一旦你能執行以下原始碼，就可以了！

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
          'button', // 點擊不會觸發重新渲染
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

如前所述，由於 shallow ref 的值不是響應式物件，對它的更改不會觸發 effect．  
然而，值本身是一個物件，所以它已經被更改了．  
因此，有一個 API 可以強制觸發 effect．它就是 triggerRef．

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
          'button', // 點擊不會觸發重新渲染
          {
            onClick: () => {
              state.value.count++
            },
          },
          ['not trigger ...'],
        ),

        h(
          'button', // 渲染更新為 state.value.count 當前持有的值
          { onClick: forceUpdate },
          ['force update !'],
        ),
      ])
  },
})

app.mount('#app')
```

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/020_shallow_ref)

## toRef

toRef 是一個為響應式物件的屬性生成 ref 的 API．

https://vuejs.org/api/reactivity-utilities.html#toref

它經常用於將 props 的特定屬性轉換為 ref．

```ts
const count = toRef(props, 'count')
console.log(count.value)
```

由 toRef 創建的 ref 與原始響應式物件同步．
如果你對這個 ref 進行更改，原始響應式物件也會被更新，如果原始響應式物件有任何更改，這個 ref 也會被更新．

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

讓我們在閱讀原始碼的同時實現！

※ 從 v3.3 開始，toRef 添加了規範化功能．chibivue 不實現此功能．  
請查看官方文件中的簽名以獲取更多詳細資訊！（https://vuejs.org/api/reactivity-utilities.html#toref）

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/030_to_ref)

## toRefs

為響應式物件的所有屬性生成 ref．

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

這可以使用 toRef 的實現輕鬆實現．

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/040_to_refs)
