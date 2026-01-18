# 响应式系统的先决知识

## 这次我们的目标开发者接口

从这里开始，我们将讨论 Vue.js 的精髓，即响应式系统．

<KawaikoNote variant="surprise" title="重头戏来了！">

这是 Vue.js 的核心！\
一旦理解了响应式系统，你就会明白 Vue.js 的「魔法」是如何实现的．\
虽然有点难，但让我们一起努力吧！

</KawaikoNote>

之前的实现虽然看起来类似于 Vue.js，但在功能上实际上并不是 Vue.js．  
我只是实现了初始的开发者接口，并使其能够显示各种 HTML．

然而，就目前而言，一旦屏幕被渲染，它就保持不变，作为一个 Web 应用程序，它变成了一个静态站点．  
从现在开始，我们将添加状态来创建更丰富的 UI，并在状态改变时更新渲染．

首先，让我们像往常一样思考它将是什么样的开发者接口．  
这样如何？

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({ count: 0 })

    const increment = () => {
      state.count++
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
})

app.mount('#app')
```

如果您习惯于使用单文件组件（SFC）进行开发，这可能看起来有点不熟悉．  
这是一个使用 `setup` 选项来保存状态并返回渲染函数的开发者接口．  
实际上，Vue.js 有这样的表示法．

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

我们用 `reactive` 函数定义状态，实现一个名为 `increment` 的函数来修改它，并将其绑定到按钮的点击事件．  
总结我们想要做的事情：

- 执行 `setup` 函数以从返回值获取用于获取 vnode 的函数
- 使传递给 `reactive` 函数的对象变为响应式
- 当按钮被点击时，状态被更新
- 跟踪状态更新，重新执行渲染函数，并重绘屏幕

## 什么是响应式系统？

现在，让我们回顾一下什么是响应式．  
让我们参考官方文档．

> 响应式对象是 JavaScript 代理，其行为类似于普通对象。不同之处在于 Vue 可以跟踪响应式对象上的属性访问和更改。

[来源](https://v3.vuejs.org/guide/reactivity-fundamentals.html)

> Vue 最独特的功能之一是其谦逊的响应式系统。组件的状态由响应式 JavaScript 对象组成。当状态改变时，视图会更新。

[来源](https://v3.vuejs.org/guide/reactivity-in-depth.html)

总之，"响应式对象在有变化时更新屏幕"．  
让我们暂时搁置如何实现这一点，并实现前面提到的开发者接口．

## setup 函数的实现

我们需要做的非常简单．  
我们接收 `setup` 选项并执行它，然后我们可以像之前的 `render` 选项一样使用它．

编辑 `~/packages/runtime-core/componentOptions.ts`：

```ts
export type ComponentOptions = {
  render?: Function
  setup?: () => Function // 添加
}
```

然后使用它：

```ts
// createAppAPI

const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!()

    const updateComponent = () => {
      const vnode = componentRender()
      render(vnode, rootContainer)
    }

    updateComponent()
  },
}
```

```ts
// playground

import { createApp, h } from 'chibivue'

const app = createApp({
  setup() {
    // 将来在这里定义状态
    // const state = reactive({ count: 0 })

    return function render() {
      return h('div', { id: 'my-app' }, [
        h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
        h(
          'button',
          {
            onClick() {
              alert('Hello world!')
            },
          },
          ['click me!'],
        ),
      ])
    }
  },
})

app.mount('#app')
```

嗯，就是这样．  
实际上，我们希望在状态改变时执行这个 `updateComponent`．

## 代理对象

这是这次的主要主题．我想在状态以某种方式改变时执行 `updateComponent`．

关键是一个名为 Proxy 的对象．

<KawaikoNote variant="question" title="Proxy 是什么？">

Proxy 是 JavaScript 的标准功能，不是 Vue.js 发明的．\
可以理解为「监视和自定义对象访问的机制」！\
通过它，我们可以检测到「值被读取」或「值被修改」．

</KawaikoNote>

首先，让我解释一下它们，而不是关于响应式系统的实现方法．

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy 是一个非常有趣的对象．

您可以通过将对象作为参数传递并像这样使用 `new` 来使用它：

```ts
const o = new Proxy({ value: 1 }, {})
console.log(o.value) // 1
```

在这个例子中，`o` 的行为几乎与普通对象相同．

现在，有趣的是 Proxy 可以接受第二个参数并注册一个处理器．
这个处理器是对象操作的处理器．请看以下示例：

```ts
const o = new Proxy(
  { value: 1, value2: 2 },

  {
    get(target, key, receiver) {
      console.log(`target:${target}, key: ${key}`)
      return target[key]
    },
  },
)
```

在这个例子中，我们正在为生成的对象编写设置．
具体来说，当访问（get）此对象的属性时，原始对象（target）和访问的键名将输出到控制台．
让我们在浏览器或其他地方检查操作．

![proxy_get](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_get.png)

您可以看到为从此 Proxy 生成的对象的属性读取值而设置的 set 处理正在执行．

同样，您也可以为 set 设置它．

```ts
const o = new Proxy(
  { value: 1, value2: 2 },
  {
    set(target, key, value, receiver) {
      console.log('hello from setter')
      target[key] = value
      return true
    },
  },
)
```

![proxy_set](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/proxy_set.png)

<KawaikoNote variant="funny" title="这就是响应式的秘密！">

用 get 检测「读取」，用 set 检测「写入」...\
也就是说，在 set 的时机调用「更新屏幕的处理」，就能实现 **值变化时自动更新屏幕** 的魔法！

</KawaikoNote>

这就是理解 Proxy 的程度．
