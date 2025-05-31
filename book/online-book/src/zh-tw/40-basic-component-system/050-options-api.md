# 支援 Options API

## Options API

到目前為止，我們已經能夠使用 Composition API 實現很多功能，但讓我們也支援 Options API．

在本書中，我們在 Options API 中支援以下內容：

- props
- data
- computed
- method
- watch
- slot
- lifecycle
  - onMounted
  - onUpdated
  - onUnmounted
  - onBeforeMount
  - onBeforeUpdate
  - onBeforeUnmount
- provide/inject
- $el
- $data
- $props
- $slots
- $parent
- $emit
- $forceUpdate
- $nextTick

作為實現方法，讓我們在 "componentOptions.ts" 中準備一個名為 "applyOptions" 的函式，並在 "setupComponent" 的末尾執行它．

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .

  if (render) {
    instance.render = render as InternalRenderFunction
  }
  // ↑ 這是現有實現

  setCurrentInstance(instance)
  applyOptions(instance)
  unsetCurrentInstance()
}
```

在 Options API 中，開發者介面經常處理 "this"．

```ts
const App = defineComponent({
  data() {
    return { message: 'hello' }
  },

  methods: {
    greet() {
      console.log(this.message) // 像這樣
    },
  },
})
```

在內部，"this" 在 Options API 中指向組件的代理，在應用選項時，這個代理被綁定．

實現示例 ↓

```ts
export function applyOptions(instance: ComponentInternalInstance) {
  const { type: options } = instance
  const publicThis = instance.proxy! as any
  const ctx = instance.ctx

  const { methods } = options

  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key]
      if (isFunction(methodHandler)) {
        ctx[key] = methodHandler.bind(publicThis)
      }
    }
  }
}
```

基本上，如果你使用這個原理逐一實現它們，應該不會太困難．

如果你想讓 "data" 變成響應式，在這裡呼叫 "reactive" 函式，如果你想計算，在這裡呼叫 "computed" 函式．（"provide/inject" 也是如此）

由於在執行 "applyOptions" 之前透過 "setCurrentInstance" 設置了實例，你可以以相同的方式呼叫到目前為止一直使用的 API（Composition API）．

關於以 "$" 開頭的屬性，它們由 "componentPublicInstance" 的實現控制．"PublicInstanceProxyHandlers" 中的 getter 控制它們．

## 為 Options API 添加類型

在功能上，按照上述描述實現是可以的，但為 Options API 添加類型有點複雜．

在本書中，我們為 Options API 支援基本類型．

困難的地方在於 "this" 的類型根據使用者對每個選項的定義而改變．例如，如果你在 "data" 選項中定義一個名為 "count" 的 "number" 類型屬性，你希望 "computed" 或 "method" 中的 "this" 推斷出 "count: number"．

當然，這不僅適用於 "data"，也適用於在 "computed" 或 "methods" 中定義的那些．

```ts
const App = defineComponent({
  data() {
    return { count: 0 }
  },

  methods: {
    myMethod() {
      this.count // number
      this.myComputed // number
    },
  },

  computed: {
    myComputed() {
      return this.count // number
    },
  },
})
```

為了實現這一點，你需要實現一個有些複雜的類型拼圖（具有許多泛型的中繼）．

從 "defineComponent" 的類型開始，我們實現幾種類型來中繼到 "ComponentOptions" 和 "ComponentPublicInstance"．

在這裡，讓我們專注於 "data" 和 "methods" 進行解釋．

首先，通常的 "ComponentOptions" 類型．我們用泛型擴展它以接受 "data" 和 "methods" 的類型作為參數，"D" 和 "M"．

```ts
export type ComponentOptions<
  D = {},
  M extends MethodOptions = MethodOptions
> = {
  data?: () => D;,
  methods?: M;
};

interface MethodOptions {
  [key: string]: Function;
}
```

到目前為止，應該不會太困難．這是可以應用於 "defineComponent" 參數的類型．  
當然，在 "defineComponent" 中，我們也接受 "D" 和 "M" 來中繼使用者定義的類型．這允許我們中繼使用者定義的類型．

```ts
export function defineComponent<
  D = {},
  M extends MethodOptions = MethodOptions,
>(options: ComponentOptions<D, M>) {}
```

問題是在 "methods" 中處理 "this" 時如何將 "D" 與 "this" 混合（如何使 "this.count" 這樣的推斷成為可能）．

首先，"D" 和 "M" 被合併到 "ComponentPublicInstance" 中（合併到代理中）．這可以理解如下（用泛型擴展）．

```ts
type ComponentPublicInstance<
  D = {},
  M extends MethodOptions = MethodOptions,
> = {
  /** 公共實例具有的各種類型 */
} & D &
  M
```

一旦我們有了這個，我們就將實例類型混合到 "ComponentOptions" 中的 "this" 中．

```ts
type ComponentOptions<D = {}, M extends MethodOptions = MethodOptions> = {
  data?: () => D
  methods?: M
} & ThisType<ComponentPublicInstance<D, M>>
```

透過這樣做，我們可以從選項中的 "this" 推斷在 "data" 和 "method" 中定義的屬性．

在實踐中，我們需要推斷各種類型，如 "props"，"computed" 和 "inject"，但基本原理是相同的．  
乍一看，你可能會被許多泛型和類型轉換（如從 "inject" 中僅提取 "key"）所壓倒，但如果你冷靜下來並回到原理，你應該沒問題．  
在本書的程式碼中，受原始 Vue 的啟發，我們用 "CreateComponentPublicInstance" 進一步抽象了一步，並實現了一個名為 "ComponentPublicInstanceConstructor" 的類型，但不要太擔心．（如果你感興趣，你也可以閱讀它！）

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/070_options_api)
