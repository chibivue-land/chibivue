# 第一次渲染和 createApp API

## 从哪里开始？🤔

现在，让我们开始逐步实现 chibivue。我们应该如何进行实现？

这是作者在创建新东西时总是牢记的一点：首先，思考软件将如何被使用。\
为了方便起见，让我们称之为"开发者接口"。

这里，"开发者"指的是使用 chibivue 开发 Web 应用程序的人，而不是 chibivue 本身的开发者。\
换句话说，在开发 chibivue 时，让我们参考原始 Vue.js 的开发者接口作为参考。\
具体来说，让我们看看在使用 Vue.js 开发 Web 应用程序时要写什么。

## 开发者接口层级？🤔

我们在这里需要注意的是，Vue.js 有多个开发者接口，每个接口都有不同的层级。这里，层级指的是它与原始 JavaScript 的接近程度。\
例如，以下是使用 Vue 显示 HTML 的开发者接口示例：

1. 在单文件组件中编写模板

```vue
<!-- App.vue -->
<template>
  <div>Hello world.</div>
</template>
```

```ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

2. 使用 template 选项

```ts
import { createApp } from 'vue'

const app = createApp({
  template: '<div>Hello world.</div>',
})

app.mount('#app')
```

3. 使用 render 选项和 h 函数

```ts
import { createApp, h } from 'vue'

const app = createApp({
  render() {
    return h('div', {}, ['Hello world.'])
  },
})

app.mount('#app')
```

还有其他选项，但让我们考虑这三个开发者接口。\
哪一个最接近原始 JavaScript？答案是"使用 render 选项和 h 函数"（选项 3）。\
选项 1 需要实现 SFC 编译器和打包器（或加载器），选项 2 需要编译传递给模板的 HTML（将其转换为 JavaScript 代码）才能工作。

为了方便起见，让我们称更接近原始 JS 的开发者接口为"低级开发者接口"。\
这里重要的是"从低级部分开始实现"。\
原因是在许多情况下，高级描述被转换为低级描述并执行。\
换句话说，选项 1 和 2 最终都在内部转换为选项 3 的形式。\
这种转换的实现称为"编译器"。

所以，让我们从实现像选项 3 这样的开发者接口开始！

## createApp API 和渲染

虽然我们的目标是选项 3 的形式，但我们仍然不太了解 h 函数，而且由于这本书的目标是增量开发，让我们不要立即瞄准选项 3 的形式。\
相反，让我们从实现一个返回要显示的消息的简单渲染函数开始。

图像 ↓

```ts
import { createApp } from 'vue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

## 立即实现

让我们在 `~/packages/index.ts` 中创建 createApp 函数。\
注意：由于不需要输出"Hello, World"，我们将删除它。

```ts
export type Options = {
  render: () => string
}

export type App = {
  mount: (selector: string) => void
}

export const createApp = (options: Options): App => {
  return {
    mount: selector => {
      const root = document.querySelector(selector)
      if (root) {
        root.innerHTML = options.render()
      }
    },
  }
}
```

这非常简单。让我们在游乐场中试试。

`~/examples/playground/src/main.ts`

```ts
import { createApp } from 'chibivue'

const app = createApp({
  render() {
    return 'Hello world.'
  },
})

app.mount('#app')
```

我们能够在屏幕上显示消息！做得好！

![hello_createApp](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/hello_createApp.png)

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/010_create_app)
