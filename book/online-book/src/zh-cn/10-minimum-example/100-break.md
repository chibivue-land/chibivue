# 休息一下

## 最小示例部分结束了！

在开始时，我提到这本书分为几个部分，第一部分"最小示例部分"现在已经完成．做得好 😁\
如果你对虚拟 DOM 或补丁渲染感兴趣，你可以继续到基础虚拟 DOM 部分．\
如果你想进一步扩展组件，有基础组件部分．如果你对模板中更丰富的表达式（如指令）感兴趣，你可以探索基础模板编译器部分．\
如果你对 script setup 或编译器宏感兴趣，你可以继续到基础 SFC 编译器部分．（当然，如果你愿意，你可以全部做！！）\
最重要的是，"最小示例部分"也是一个值得尊敬的部分，所以如果你觉得，"我不需要了解得太深入，但我想得到一个大致的想法"，那么你到这里就足够了．

## 到目前为止我们取得了什么成就？

最后，让我们反思一下我们在最小示例部分做了什么以及取得了什么成就．

## 我们现在知道我们在看什么以及它属于哪里

首先，通过名为 createApp 的初始开发者接口，我们了解了（web 应用）开发者和 Vue 世界是如何连接的．\
具体来说，从我们在开始时进行的重构开始，你现在应该了解 Vue 目录结构的基础，它的依赖关系以及开发者正在工作的地方．\
让我们比较当前目录和 vuejs/core 的目录．

chibivue
![minimum_example_artifacts](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/minimum_example_artifacts.png)

\*原始代码太大，无法在截图中显示，所以省略了．

https://github.com/vuejs/core

尽管它很小，你现在应该能够在某种程度上阅读和理解每个文件的角色和内容．\
我希望你也会挑战自己阅读我们这次没有涵盖的部分的源代码．（你应该能够一点一点地阅读它！）

## 我们现在知道声明式 UI 是如何实现的

通过 h 函数的实现，我们了解了声明式 UI 是如何实现的．

```ts
// 在内部，它生成一个像 {tag, props, children} 这样的对象，并基于它执行 DOM 操作
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

这是虚拟 DOM 之类的东西首次出现的地方．

## 我们现在知道响应式系统是什么以及如何动态更新屏幕

我们了解了 Vue 独特功能响应式系统的实现，它是如何工作的以及它实际上是什么．

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
    const state = reactive({ count: 0 }) // 创建代理

    const increment = () => {
      state.count++ // 触发
    }

    ;() => {
      return h('p', {}, `${state.count}`) // 跟踪
    }
  },
}
```

## 我们现在知道虚拟 DOM 是什么，为什么它有益，以及如何实现它

作为使用 h 函数渲染的改进，我们通过比较了解了使用虚拟 DOM 的高效渲染方法．

```ts
// 虚拟 DOM 的接口
export interface VNode<HostNode = any> {
  type: string | typeof Text | object
  props: VNodeProps | null
  children: VNodeNormalizedChildren
  el: HostNode | undefined
}

// 首先，调用渲染函数
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  // 第一次，n1 是 null。在这种情况下，每个过程运行 mount
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

// 从第二次开始，将前一个 VNode 和当前 VNode 传递给 patch 函数以更新差异
const nextVNode = component.render()
patch(prevVNode, nextVNode)
```

我了解了组件的结构以及组件之间的交互是如何实现的．

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

我了解了编译器是什么以及模板功能是如何实现的．

通过了解编译器是什么并实现模板编译器，我获得了如何实现更原始的类似 HTML 的实现以及如何实现 Vue 特定功能（如 Mustache 语法）的理解．

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

我了解了如何通过 Vite 插件实现 SFC 编译器．

通过实现模板编译器并通过 Vite 插件利用它，我获得了如何实现将脚本，模板和样式组合到一个文件中的原始文件格式的理解．\
我还了解了 Vite 插件可以做什么，以及 transform 和虚拟模块．

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

## 关于未来

从现在开始，为了使其更实用，我们将在每个部分中更详细地介绍．\
我将稍微解释一下每个部分要做什么以及如何进行（政策）．

### 要做什么

从这里开始，它将分为 5 个部分 + 1 个附录．

- 基础虚拟 DOM 部分
  - 调度器的实现
  - 不支持的补丁的实现（主要与属性相关）
  - Fragment 的支持
- 基础响应式系统部分
  - ref API
  - computed API
  - watch API
- 基础组件系统部分
  - provide/inject
  - 生命周期钩子
- 基础模板编译器部分
  - v-on
  - v-bind
  - v-for
  - v-model
- 基础 SFC 编译器部分
  - SFC 的基础
  - script setup
  - 编译器宏
- Web 应用程序要点部分（附录）

这部分是附录．\
在这部分中，我们将实现在 web 开发中经常与 Vue 一起使用的库．

- store
- route

我们将涵盖上述两个，但请随意实现其他想到的东西！

### 政策

在最小示例部分，我们相当详细地解释了实现步骤．\
到现在，如果你已经实现了它，你应该能够阅读原始 Vue 的源代码．\
因此，从现在开始，解释将保持粗略的政策，你将在阅读原始代码或自己思考的同时实现实际代码．\
（不-不，这不是我变得懒惰而不愿意详细写作或类似的事情！）\
嗯，按照书中所说的实现是有趣的，但一旦它开始成形，自己做更有趣，并且会导致更深的理解．\
从这里开始，请将这本书视为一种指导方针，主要内容在原始 Vue 源代码中！
