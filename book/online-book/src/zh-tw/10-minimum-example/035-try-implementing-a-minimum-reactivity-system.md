# 嘗試實作最小響應式系統

## 使用 Proxy 的響應式機制

::: info 與目前 `vuejs/core` 設計的差異
截至 2024 年 12 月，Vue.js 的響應式系統採用基於雙向鏈表的觀察者模式。\
這個實作在 [Refactor reactivity system to use version counting and doubly-linked list tracking](https://github.com/vuejs/core/pull/10397) 中引入，對效能改進做出了重大貢獻。

然而，對於第一次實作響應式系統的人來說，這可能有些難以理解。在本章中，我們將建立傳統（最佳化前）系統的簡化實作。\
有關更接近目前實作的系統的更詳細解釋，請參考 [響應式最佳化](/zh-tw/30-basic-reactivity-system/005-reactivity-optimization)。

另一個重大改進 [feat(reactivity): more efficient reactivity system](https://github.com/vuejs/core/pull/5912) 將在單獨的章節中介紹。
:::

為了再次明確目的，這次的目的是「在狀態改變時執行 `updateComponent`」。讓我使用 Proxy 解釋實作過程。

首先，Vue.js 的響應式系統涉及 `target`，`Proxy`，`ReactiveEffect`，`Dep`，`track`，`trigger`，`targetMap` 和 `activeEffect`（目前是 `activeSub`）。

<KawaikoNote variant="warning" title="角色很多！">

突然出現了很多術語，但不要慌！\
如果我們一個一個地看每個角色，拼圖的碎片就會拼在一起。\
首先，讓我們目標是「大致把握全貌」。

</KawaikoNote>

首先，讓我們談談 targetMap 的結構。
targetMap 是某個目標的鍵和 deps 的映射。
Target 指的是您想要使其響應式的物件，dep 指的是您想要執行的效果（函式）。您可以這樣想。
在程式碼中，它看起來像這樣：

```ts
type Target = any // 任何目標
type TargetKey = any // 目標擁有的任何鍵

const targetMap = new WeakMap<Target, KeyToDepMap>() // 在此模組中定義為全域變數

type KeyToDepMap = Map<TargetKey, Dep> // 目標的鍵和效果的映射

type Dep = Set<ReactiveEffect> // dep 有多個 ReactiveEffects

class ReactiveEffect {
  constructor(
    // 這裡，您給出想要實際應用為效果的函式（在這種情況下是 updateComponent）
    public fn: () => T,
  ) {}
}
```

這意味著為「某個目標（物件）」的「某個鍵」註冊「某個效果」。

僅僅看程式碼可能很難理解，所以這裡有一個具體的例子和補充圖表。\
考慮如下元件：

```ts
export default defineComponent({
  setup() {
    const state1 = reactive({ name: "John", age: 20 })
    const state2 = reactive({ count: 0 })

    function onCountUpdated() {
      console.log("count updated")
    }

    watch(() => state2.count, onCountUpdated)

    return () => h("p", {}, `name: ${state1.name}`)
  }
})
```

雖然我們在本章中還沒有實作 `watch`，但為了說明而寫在這裡。\
在這個元件中，targetMap 最終將形成如下：

![targetMap structure](/figures/10-minimum-example/reactivity/target-map-structure.svg)

targetMap 的鍵是「某個目標」。在這個例子中，state1 和 state2 對應於此。\
這些目標擁有的鍵成為 targetMap 的鍵。
與它們關聯的效果成為值。

在部分 `() => h("p", {}, name: ${state1.name})` 中，映射 `state1->name->updateComponentFn` 被註冊，在部分 `watch(() => state2.count, onCountUpdated)` 中，映射 `state2->count->onCountUpdated` 被註冊。

這個基本結構負責其餘部分，然後我們考慮如何建立（註冊）targetMap 以及如何執行效果。

<KawaikoNote variant="funny" title="簡單地想">

**targetMap** 是一個記錄「誰影響誰」的筆記本。\
當 `state1.name` 改變時 → 執行 `updateComponent`\
當 `state2.count` 改變時 → 執行 `onCountUpdated`\
它記錄了這些關係！

</KawaikoNote>

這就是 `track` 和 `trigger` 概念的用武之地。
顧名思義，`track` 是在 `targetMap` 中註冊的函式，`trigger` 是從 `targetMap` 檢索效果並執行它的函式。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

這些 `track` 和 `trigger` 在 Proxy 的 get 和 set 處理器中實作。

```ts
const state = new Proxy(
  { count: 1 },
  {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  },
)
```

產生此 Proxy 的 API 是 reactive 函式。

```ts
function reactive<T>(target: T) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key)
      return target[key]
    },
    set(target, key, value, receiver) {
      target[key] = value
      trigger(target, key)
      return true
    },
  })
}
```

![reactive track and trigger flow](/figures/10-minimum-example/reactivity/reactive-track-trigger.svg)

<KawaikoNote variant="base" title="到目前為止的重點">

- **track**：讀取值時呼叫，登記「這個值變化時執行某段程式碼」
- **trigger**：寫入值時呼叫，執行已登記的處理邏輯
- **reactive**：建立包含這套機制的 Proxy 的函式

</KawaikoNote>

在這裡，您可能會注意到一個缺失的元素。那就是「在 track 中註冊哪個函式？」。
答案是 `activeEffect` 的概念。
這也像 targetMap 一樣在此模組中定義為全域變數，並在 ReactiveEffect 的 `run` 方法中設定。

```ts
let activeEffect: ReactiveEffect | undefined

class ReactiveEffect {
  constructor(
    // 這裡，您給出想要實際應用為效果的函式（在這種情況下是 updateComponent）
    public fn: () => T,
  ) {}

  run() {
    activeEffect = this
    return this.fn()
  }
}
```

要理解它是如何工作的，想像一個這樣的元件。

```ts
{
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h(
          "button",
          {
            onClick: increment,
          },
          ["increment"]
        ),
      ]);
    };
  },
}
```

在內部，響應式是這樣形成的。

```ts
// chibivue 內部的實作
const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    const effect = new ReactiveEffect(updateComponent)
    effect.run()
  },
}
```

逐步解釋，首先執行 `setup` 函式。\
此時產生響應式代理。換句話說，在此處建立的代理上執行的任何操作都將按照代理中設定的方式執行。

```ts
const state = reactive({ count: 0 }) // 產生代理
```

接下來，我們傳遞 `updateComponent` 來建立 `ReactiveEffect`（觀察者端）。

```ts
const effect = new ReactiveEffect(updateComponent)
```

在 `updateComponent` 中使用的 `componentRender` 是 `setup` 的 `回傳值` 的函式，這個函式引用由代理建立的物件。

```ts
function render() {
  return h('div', { id: 'my-app' }, [
    h('p', {}, [`count: ${state.count}`]), // 引用由代理建立的物件
    h(
      'button',
      {
        onClick: increment,
      },
      ['increment'],
    ),
  ])
}
```

當這個函式實際執行時，`state.count` 的 `getter` 函式被執行，`track` 被觸發。
在這種情況下，讓我們執行效果。

```ts
effect.run()
```

然後，`updateComponent`（帶有 `updateComponent` 的 ReactiveEffect）被設定為 `activeEffect`。
當在此狀態下觸發 `track` 時，`state.count` 和 `updateComponent`（帶有 `updateComponent` 的 ReactiveEffect）的映射在 `targetMap` 中註冊。
這就是響應式的形成方式。

現在，讓我們考慮執行 `increment` 時會發生什麼。
由於 `increment` 正在重寫 `state.count`，`setter` 被執行，`trigger` 被觸發。
`trigger` 基於 `state` 和 `count` 從 `targetMap` 中找到並執行 `effect`（在這種情況下是 updateComponent）。
這就是螢幕更新的觸發方式！

這使我們能夠實作響應式。

這有點複雜，所以讓我們用圖表總結一下。

![Reactivity setup flow during mount](/figures/10-minimum-example/reactivity/reactivity-setup-flow.svg)

## 基於這些，讓我們實作它。

最困難的部分是理解到這一點的一切，所以一旦您理解了，您所要做的就是編寫原始碼。
然而，即使您只理解上述內容，可能有些人在不知道實際發生什麼的情況下無法理解。
對於這些人，讓我們首先在這裡嘗試實作它。然後，在閱讀實際程式碼時，請參考前面的部分！

首先，讓我們建立必要的檔案。我們將在 `packages/reactivity` 中建立它們。
在這裡，我們將盡可能地意識到原始 Vue 的設定。

```sh
pwd # ~
mkdir packages/reactivity

touch packages/reactivity/index.ts

touch packages/reactivity/dep.ts
touch packages/reactivity/effect.ts
touch packages/reactivity/reactive.ts
touch packages/reactivity/baseHandler.ts
```

像往常一樣，`index.ts` 只是匯出，所以我不會詳細解釋。在這裡匯出您想要從 reactivity 外部套件使用的內容。

接下來是 `dep.ts`。

```ts
import { type ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep: Dep = new Set<ReactiveEffect>(effects)
  return dep
}
```

還沒有 `effect` 的定義，但我們稍後會實作它，所以沒關係。

接下來是 `effect.ts`。

```ts
import { Dep, createDep } from './dep'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {
    // ※ 在執行 fn 之前儲存 activeEffect，執行後恢復它。
    // 如果您不這樣做，它將一個接一個地被覆蓋並表現出意外行為。（完成後讓我們將其恢復到原始狀態）
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  if (activeEffect) {
    dep.add(activeEffect)
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)

  if (dep) {
    const effects = [...dep]
    for (const effect of effects) {
      effect.run()
    }
  }
}
```

到目前為止我還沒有解釋 `track` 和 `trigger` 的內容，但它們只是從 `targetMap` 註冊和檢索並執行它們，所以請嘗試仔細閱讀它們。

接下來是 `baseHandler.ts`。在這裡，我們定義響應式代理的處理器。
嗯，您可以直接在 `reactive` 中實作它，但我遵循了原始 Vue，因為它是這樣的。
實際上，有各種代理，如 `readonly` 和 `shallow`，所以想法是在這裡實作這些代理的處理器。（雖然這次我們不會這樣做）

```ts
import { track, trigger } from './effect'
import { reactive } from './reactive'

export const mutableHandlers: ProxyHandler<object> = {
  get(target: object, key: string | symbol, receiver: object) {
    track(target, key)

    const res = Reflect.get(target, key, receiver)
    // 如果它是一個物件，使其響應式（這也允許嵌套物件是響應式的）。
    if (res !== null && typeof res === 'object') {
      return reactive(res)
    }

    return res
  },

  set(target: object, key: string | symbol, value: unknown, receiver: object) {
    let oldValue = (target as any)[key]
    Reflect.set(target, key, value, receiver)
    // 檢查值是否已更改
    if (hasChanged(value, oldValue)) {
      trigger(target, key)
    }
    return true
  },
}

const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)
```

在這裡，出現了 `Reflect`，它類似於 `Proxy`，但 `Proxy` 是為物件編寫元設定，而 `Reflect` 是對現有物件執行操作。
`Proxy` 和 `Reflect` 都是 JS 引擎中與物件相關的元編程 API，它們允許您與正常使用物件相比執行元操作。
您可以執行更改物件的函式，執行讀取物件的函式，檢查鍵是否存在，並執行各種元操作。
現在，可以理解 `Proxy` 是在建立物件階段的元設定，`Reflect` 是對現有物件的元操作。

接下來是 `reactive.ts`。

```ts
import { mutableHandlers } from './baseHandler'

export function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, mutableHandlers)
  return proxy as T
}
```

現在 `reactive` 的實作完成了，讓我們嘗試在掛載時使用它們。
`~/packages/runtime-core/apiCreateApp.ts`。

```ts
import { ReactiveEffect } from '../reactivity'

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const app: App = {
      mount(rootContainer: HostElement) {
        const componentRender = rootComponent.setup!()

        const updateComponent = () => {
          const vnode = componentRender()
          render(vnode, rootContainer)
        }

        // 從這裡
        const effect = new ReactiveEffect(updateComponent)
        effect.run()
        // 到這裡
      },
    }

    return app
  }
}
```

現在，讓我們在遊樂場中嘗試它。

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => {
      state.count++
    }

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
    }
  },
})

app.mount('#app')
```

哎呀...

渲染現在工作正常，但似乎有些不對勁。
嗯，這並不奇怪，因為在 `updateComponent` 中，我們每次都建立元素。
所以，讓我們在每次渲染之前刪除所有元素。

![Reactive example mistake in the browser](/figures/10-minimum-example/reactivity/reactive-example-mistake.png)

像這樣修改 `~/packages/runtime-core/renderer.ts` 中的 `render` 函式：

```ts
const render: RootRenderFunction = (vnode, container) => {
  while (container.firstChild) container.removeChild(container.firstChild) // 加入程式碼以刪除所有元素
  const el = renderVNode(vnode)
  hostInsert(el, container)
}
```

現在，這樣如何？

![Reactive example rendered in the browser](/figures/10-minimum-example/reactivity/reactive-example-result.png)

現在似乎工作正常！

現在我們可以使用 `reactive` 更新螢幕！

<KawaikoNote variant="surprise" title="恭喜！">

響應式系統的基礎已經完成！\
你理解了 Vue.js「值變化時自動更新螢幕」魔法背後的秘密了嗎？\
克服了這一關，你對 Vue.js 內部已經有了很深的理解！

</KawaikoNote>

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/030_reactive_system)
