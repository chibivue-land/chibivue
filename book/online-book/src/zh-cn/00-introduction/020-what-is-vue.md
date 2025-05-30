# 什么是 Vue.js？

## 关于 Vue.js 的快速回顾

让我们直奔主题。  
但在此之前，让我们快速回顾一下 Vue.js 的全部内容。

## Vue.js 到底是什么？

Vue.js 是一个"友好、高性能、多功能的构建 Web 用户界面的框架"。  
这是官方文档主页上的说明。  
对此，我认为直接引用官方的话而不添加我自己的解释会更清楚，所以我在下面引用了它们：

> Vue（发音为 /vjuː/，类似 view）是一个用于构建用户界面的 JavaScript 框架。它建立在标准 HTML、CSS 和 JavaScript 的基础上，并提供了一套声明式的、组件化的编程模型，帮助你高效地开发用户界面，无论是简单还是复杂的。

> 声明式渲染：Vue 基于标准 HTML 拓展了一套模板语法，使得我们可以声明式地描述最终输出的 HTML 和 JavaScript 状态之间的关系。

> 响应性：Vue 会自动跟踪 JavaScript 状态变化并在改变发生时响应式地更新 DOM。

> 这里是一个最小的示例：
>
> ```ts
> import { createApp } from 'vue'
>
> createApp({
>   data() {
>     return {
>       count: 0,
>     }
>   },
> }).mount('#app')
> ```
>
> ```html
> <div id="app">
>   <button @click="count++">Count is: {{ count }}</button>
> </div>
> ```

[参考来源](https://vuejs.org/guide/introduction.html#what-is-vue)

对于声明式渲染和响应性，我们将在各自的章节中详细深入探讨，所以现在有一个高层次的理解就足够了。

另外，这里出现了"框架"这个术语，Vue.js 将自己推广为"渐进式框架"。关于这一点，我认为最好直接参考文档的以下部分：

https://vuejs.org/guide/introduction.html#the-progressive-framework

## 官方文档和本书的区别

官方文档专注于"如何使用 Vue.js"，提供了大量的教程和指南。

然而，这本书采用了稍微不同的方法，专注于"Vue.js 是如何实现的"。我们将编写实际代码来创建一个迷你版本的 Vue.js。

另外，这本书不是官方出版物，可能不够详尽。可能会有一些错误或遗漏，所以我很感谢任何反馈或更正。
