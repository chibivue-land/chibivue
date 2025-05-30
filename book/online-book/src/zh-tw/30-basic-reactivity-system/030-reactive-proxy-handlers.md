# 各種響應式代理處理器

::: warning
這裡解釋的實現基於當前草擬的[響應式優化](/30-basic-reactivity-system/005-reactivity-optimization)之前的版本。  
一旦[響應式優化](/30-basic-reactivity-system/005-reactivity-optimization)完成，本章的內容將更新以與其保持一致。
:::

## 不應該是響應式的物件

現在，讓我們解決當前響應式系統的一個問題。  
首先，嘗試執行以下程式碼。

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

如果你檢查控制台，你應該看到以下結果：

![reactive_html_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/reactive_html_element.png)

現在，讓我們添加一個焦點函式。

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

令人驚訝的是，它拋出了一個錯誤。

![focus_in_reactive_html_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/focus_in_reactive_html_element.png)

原因是 `document.getElementById` 獲得的元素被用來生成 Proxy 本身。

當生成 Proxy 時，值變成 Proxy 而不是原始物件，導致 HTML 元素功能的丟失。

## 在生成響應式代理之前確定物件

確定方法非常簡單。使用 `Object.prototype.toString`。
讓我們看看 `Object.prototype.toString` 如何在上面的程式碼中確定 HTMLInputElement。

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

![element_to_string](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/element_to_string.png)

這允許我們確定物件的類型。雖然有些硬編碼，但讓我們概括這個確定函式。

```ts
// shared/general.ts
export const objectToString = Object.prototype.toString // 已在 isMap 和 isSet 中使用
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 這次要添加的函式
export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
}
```

使用 `slice` 的原因是獲取 `[Object hoge]` 中對應於 `hoge` 的字串。

然後，讓我們透過使用 `reactive toRawType` 確定物件的類型並進行分支。
跳過為 HTMLInput 生成 Proxy。

在 reactive.ts 中，獲取 rawType 並確定將成為 reactive 目標的物件類型。

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

現在，焦點程式碼應該工作了！

![focus_in_element](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/focus_in_element.png)

## 實現 TemplateRefs

現在我們可以將 HTML 元素放入 Ref 中，讓我們實現 TemplateRef。

Ref 可以透過使用 ref 屬性來引用模板。

https://vuejs.org/guide/essentials/template-refs.html

目標是使以下程式碼工作：

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

如果你已經走到這一步，你可能已經看到如何實現它。
是的，只需將 ref 添加到 VNode 並在渲染期間注入值。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  key: string | number | symbol | null
  ref: Ref | null // 這個
  // .
  // .
}
```

在原始實現中，它被稱為 `setRef`。找到它，閱讀它，並實現它！
在原始實現中，它更複雜，ref 是一個陣列並且可以透過 `$ref` 存取，但現在，讓我們目標使上面的程式碼工作。

順便說一下，如果它是一個組件，將組件的 `setupContext` 分配給 ref。  
（注意：實際上，你應該傳遞組件的代理，但它還沒有實現，所以我們現在使用 `setupContext`。）

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

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/110_template_refs)

## 處理具有變化鍵的物件

實際上，當前的實現無法處理具有變化鍵的物件。
這也包括陣列。
換句話說，以下組件無法正常工作：

```ts
const App = {
  setup() {
    const array = ref<number[]>([])
    const mutateArray = () => {
      array.value.push(Date.now()) // 即使呼叫這個也不會觸發 effect（set 的鍵是 "0"）
    }

    const record = reactive<Record<string, number>>({})
    const mutateRecord = () => {
      record[Date.now().toString()] = Date.now() // 即使鍵改變也不會觸發 effect
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

我們如何解決這個問題？

### 對於陣列

陣列本質上是物件，所以當添加新元素時，其索引作為鍵傳遞給 Proxy 的 `set` 處理器。

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

然而，我們無法單獨追蹤這些鍵中的每一個。
因此，我們可以追蹤陣列的 `length` 來觸發陣列的變化。

值得注意的是，`length` 已經被追蹤了。

如果你在瀏覽器或類似環境中執行以下程式碼，你會看到當使用 `JSON.stringify` 字串化陣列時會呼叫 `length`。

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

換句話說，`length` 已經註冊了一個 effect。所以，我們需要做的就是提取這個 effect 並在設置索引時觸發它。

如果鍵被確定為索引，我們觸發 `length` 的 effect。
當然，可能還有其他依賴項，所以我們將它們提取到一個名為 `deps` 的陣列中並一起觸發 effect。

```ts
export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  // 這個
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

現在，陣列應該正常工作了。

### 對於物件（記錄）

接下來，讓我們考慮物件。與陣列不同，物件沒有 `length` 屬性。

我們可以在這裡做一個小修改。
我們可以準備一個名為 `ITERATE_KEY` 的符號，並以類似於陣列的 `length` 屬性的方式使用它。
你可能不理解我的意思，但由於 `depsMap` 只是一個 Map，使用我們定義的符號作為鍵沒有問題。

操作順序與陣列略有不同，但讓我們從考慮 `trigger` 函式開始。
我們可以實現它，就好像有一個註冊了 effect 的 `ITERATE_KEY`。

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
    // 如果不是陣列，觸發用 ITERATE_KEY 註冊的 effect
    deps.push(depsMap.get(ITERATE_KEY))
  } else if (isIntegerKey(key)) {
    // 向陣列添加新索引 -> length 改變
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}
```

問題是如何追蹤 `ITERATE_KEY` 的 effect。

在這裡，我們可以使用 `ownKeys` Proxy 處理器。

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/ownKeys

`ownKeys` 被 `Object.keys()` 或 `Reflect.ownKeys()` 等函式呼叫，但它也被 `JSON.stringify` 呼叫。

你可以透過在瀏覽器或類似環境中執行以下程式碼來確認這一點：

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

我們可以使用這個來追蹤 `ITERATE_KEY`。
對於陣列，我們不需要它，所以我們可以簡單地追蹤 `length`。

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

現在，我們應該能夠處理具有變化鍵的物件了！

## 支援基於集合的內建物件

目前，在查看 reactive.ts 的實現時，它只針對 Object 和 Array。

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

在 Vue.js 中，除了這些，它還支援 Map、Set、WeakMap 和 WeakSet。

https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/reactive.ts#L43C1-L56C2

這些物件被實現為單獨的 Proxy 處理器。它被稱為 `collectionHandlers`。

在這裡，我們將實現這個 `collectionHandlers` 並目標使以下程式碼工作。

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

在 `collectionHandlers` 中，我們為 add、set 和 delete 等方法實現處理器。
這些的實現可以在 `collectionHandlers.ts` 中找到。
https://github.com/vuejs/core/blob/9f8e98af891f456cc8cc9019a31704e5534d1f08/packages/reactivity/src/collectionHandlers.ts#L0-L1
透過確定 `TargetType`，如果它是集合類型，我們基於這個處理器為 `h` 生成 Proxy。
讓我們實際實現它！

需要注意的一點是，當將目標本身傳遞給 Reflect 的接收器時，如果目標本身設置了 Proxy，可能會導致無限循環。
為了避免這種情況，我們改變結構，將原始資料附加到目標，當實現 Proxy 處理器時，我們修改它以在這個原始資料上操作。

```ts
export const enum ReactiveFlags {
  RAW = '__v_raw',
}

export interface Target {
  [ReactiveFlags.RAW]?: any
}
```

嚴格來說，這個實現也應該為正常的響應式處理器完成，但為了最小化不必要的解釋並且因為到目前為止沒有問題，所以省略了。
讓我們嘗試實現它，如果進入 getter 的鍵是 `ReactiveFlags.RAW`，它返回原始資料而不是 Proxy。

與此同時，我們還實現了一個名為 `toRaw` 的函式，它遞迴地從目標檢索原始資料並最終獲得處於原始狀態的資料。

```ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
```

順便說一下，這個 `toRaw` 函式也作為 API 函式提供。

https://vuejs.org/api/reactivity-advanced.html#toraw

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/30_basic_reactivity_system/120_proxy_handler_improvement)
