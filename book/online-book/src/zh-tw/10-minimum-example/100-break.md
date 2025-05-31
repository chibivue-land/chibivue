# 休息一下

## 最小範例部分結束了！

在開始時，我提到這本書分為幾個部分，第一部分「最小範例部分」現在已經完成．做得好 😁\
如果你對虛擬 DOM 或補丁渲染感興趣，你可以繼續到基礎虛擬 DOM 部分．\
如果你想進一步擴展組件，有基礎組件部分．如果你對模板中更豐富的表達式（如指令）感興趣，你可以探索基礎模板編譯器部分．\
如果你對 script setup 或編譯器巨集感興趣，你可以繼續到基礎 SFC 編譯器部分．（當然，如果你願意，你可以全部做！！）\
最重要的是，「最小範例部分」也是一個值得尊敬的部分，所以如果你覺得，「我不需要了解得太深入，但我想得到一個大致的想法」，那麼你到這裡就足夠了．

## 到目前為止我們取得了什麼成就？

最後，讓我們反思一下我們在最小範例部分做了什麼以及取得了什麼成就．

## 我們現在知道我們在看什麼以及它屬於哪裡

首先，通過名為 createApp 的初始開發者介面，我們了解了（web 應用）開發者和 Vue 世界是如何連接的．\
具體來說，從我們在開始時進行的重構開始，你現在應該了解 Vue 目錄結構的基礎，它的相依性以及開發者正在工作的地方．\
讓我們比較當前目錄和 vuejs/core 的目錄．

chibivue
![minimum_example_artifacts](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/minimum_example_artifacts.png)

\*原始程式碼太大，無法在截圖中顯示，所以省略了．

https://github.com/vuejs/core

儘管它很小，你現在應該能夠在某種程度上閱讀和理解每個檔案的角色和內容．\
我希望你也會挑戰自己閱讀我們這次沒有涵蓋的部分的原始碼．（你應該能夠一點一點地閱讀它！）

## 我們現在知道宣告式 UI 是如何實現的

通過 h 函式的實現，我們了解了宣告式 UI 是如何實現的．

```ts
// 在內部，它生成一個像 {tag, props, children} 這樣的物件，並基於它執行 DOM 操作
h('div', { id: 'my-app' }, [
  h('p', {}, ['Hello!']),
  h(
    'button',
    {
      onClick: () => {
        alert('hello')
      },
    },
    ['Click me!'],
  ),
])
```

這是虛擬 DOM 之類的東西首次出現的地方．

## 我們現在知道響應式系統是什麼以及如何動態更新螢幕

我們了解了 Vue 獨特功能響應式系統的實現，它是如何工作的以及它實際上是什麼．

```ts
const targetMap = new WeakMap<any, KeyToDepMap>()

function reactive<T extends object>(target: T): T {
  const proxy = new Proxy(target, {
    get(target: object, key: string | symbol, receiver: object) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },

    set(
      target: object,
      key: string | symbol,
      value: unknown,
      receiver: object,
    ) {
      Reflect.set(target, key, value, receiver)
      trigger(target, key)
      return true
    },
  })
}
```

```ts
const component = {
  setup() {
    const state = reactive({ count: 0 }) // 創建代理

    const increment = () => {
      state.count++ // 觸發
    }

    ;() => {
      return h('p', {}, `${state.count}`) // 追蹤
    }
  },
}
```

## 我們現在知道虛擬 DOM 是什麼，為什麼它有益，以及如何實現它

作為使用 h 函式渲染的改進，我們通過比較了解了使用虛擬 DOM 的高效渲染方法．

```ts
// 虛擬 DOM 的介面
export interface VNode<HostNode = any> {
  type: string | typeof Text | object
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined
}

// 首先，呼叫渲染函式
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  // 第一次，n1 是 null。在這種情況下，每個過程執行 mount
  patch(null, vnode, container)
}

const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    processComponent(n1, n2, container)
  } else {
    // do nothing
  }
}

// 從第二次開始，將前一個 VNode 和當前 VNode 傳遞給 patch 函式以更新差異
const nextVNode = component.render()
patch(prevVNode, nextVNode)
```

我了解了組件的結構以及組件之間的交互是如何實現的．

```ts
export interface ComponentInternalInstance {
  type: Component

  vnode: VNode
  subTree: VNode
  next: VNode | null
  effect: ReactiveEffect
  render: InternalRenderFunction
  update: () => void

  propsOptions: Props
  props: Data
  emit: (event: string, ...args: any[]) => void

  isMounted: boolean
}
```

```ts
const MyComponent = {
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

我了解了編譯器是什麼以及模板功能是如何實現的．

通過了解編譯器是什麼並實現模板編譯器，我獲得了如何實現更原始的類似 HTML 的實現以及如何實現 Vue 特定功能（如 Mustache 語法）的理解．

```ts
const app = createApp({
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = (e: InputEvent) => {
      state.input = (e.target as HTMLInputElement)?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },

  template: `
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage"> click me! </button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>

      <style>
        .container {
          height: 100vh;
          padding: 16px;
          background-color: #becdbe;
          color: #2c3e50;
        }
      </style>
    </div>
  `,
})
```

我了解了如何通過 Vite 外掛程式實現 SFC 編譯器．

通過實現模板編譯器並通過 Vite 外掛程式利用它，我獲得了如何實現將腳本，模板和樣式組合到一個檔案中的原始檔案格式的理解．\
我還了解了 Vite 外掛程式可以做什麼，以及 transform 和虛擬模組．

```vue
<script>
import { reactive } from 'chibivue'

export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!', input: '' })

    const changeMessage = () => {
      state.message += '!'
    }

    const handleInput = e => {
      state.input = e.target?.value ?? ''
    }

    return { state, changeMessage, handleInput }
  },
}
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>{{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      alt="Vue.js Logo"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>

    <br />

    <label>
      Input Data
      <input @input="handleInput" />
    </label>

    <p>input value: {{ state.input }}</p>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

## 關於未來

從現在開始，為了使其更實用，我們將在每個部分中更詳細地介紹．\
我將稍微解釋一下每個部分要做什麼以及如何進行（政策）．

### 要做什麼

從這裡開始，它將分為 5 個部分 + 1 個附錄．

- 基礎虛擬 DOM 部分
  - 排程器的實現
  - 不支援的補丁的實現（主要與屬性相關）
  - Fragment 的支援
- 基礎響應式系統部分
  - ref API
  - computed API
  - watch API
- 基礎組件系統部分
  - provide/inject
  - 生命週期鉤子
- 基礎模板編譯器部分
  - v-on
  - v-bind
  - v-for
  - v-model
- 基礎 SFC 編譯器部分
  - SFC 的基礎
  - script setup
  - 編譯器巨集
- Web 應用程式要點部分（附錄）

這部分是附錄．\
在這部分中，我們將實現在 web 開發中經常與 Vue 一起使用的函式庫．

- store
- route

我們將涵蓋上述兩個，但請隨意實現其他想到的東西！

### 政策

在最小範例部分，我們相當詳細地解釋了實現步驟．\
到現在，如果你已經實現了它，你應該能夠閱讀原始 Vue 的原始碼．\
因此，從現在開始，解釋將保持粗略的政策，你將在閱讀原始程式碼或自己思考的同時實現實際程式碼．\
（不-不，這不是我變得懶惰而不願意詳細寫作或類似的事情！）\
嗯，按照書中所說的實現是有趣的，但一旦它開始成形，自己做更有趣，並且會導致更深的理解．\
從這裡開始，請將這本書視為一種指導方針，主要內容在原始 Vue 原始碼中！
