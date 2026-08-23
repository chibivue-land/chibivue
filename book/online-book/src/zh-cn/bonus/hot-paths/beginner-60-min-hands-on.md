# 初学者 60 分钟动手实践

::: warning AI 生成的附录
本附录由 GPT-5.5 根据 chibivue 原书内容起草。请将这条路线视为学习指南；原始章节与实现代码仍是权威依据。
:::

这条路线带你走过原书的 Minimum Example，但不要求吸收每一处讲解。你将接触一个 Vue 风格框架的主要轮廓：应用 API、渲染器、响应式系统、组件、模板编译器以及 SFC 支持。

## 目标

完成后，你应该理解 chibivue 为什么要拆分为多个包，以及一个 `.vue` 文件最终如何转化为 DOM 更新。

## 0-8 分钟：项目结构

阅读：

- [本书的学习方式与环境搭建](/zh-cn/00-introduction/040-setup-project)
- [包架构](/zh-cn/10-minimum-example/015-package-architecture)

实践：

- 在 `book/impls` 下的实现快照中找到 `packages/runtime-core`、`packages/runtime-dom`、`packages/reactivity`、`packages/compiler-core`、`packages/compiler-dom` 和 `packages/compiler-sfc`。
- 用一句话写下每个包负责解决的问题。

检查点：

- 你能区分运行时代码和编译器代码。

## 8-18 分钟：首次渲染

阅读：

- [首次渲染与 createApp API](/zh-cn/10-minimum-example/010-create-app-api)
- [让我们支持渲染 HTML 元素](/zh-cn/10-minimum-example/020-simple-h-function)
- [支持事件处理器与属性](/zh-cn/10-minimum-example/025-event-handler-and-attrs)

实践：

- 跟踪 `createApp(...).mount(...)` 如何到达渲染器。
- 找到创建元素的位置。
- 找到应用 props 或事件处理器的位置。

检查点：

- 你能追踪一个按钮如何从渲染函数变成真实 DOM。

## 18-28 分钟：初识响应式

阅读：

- [响应式系统的前置知识](/zh-cn/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system)
- [尝试实现一个小型响应式系统](/zh-cn/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

实践：

- 找到保存当前 active effect 的位置。
- 找到跟踪属性读取的位置。
- 找到属性写入触发 effect 的位置。

检查点：

- 你理解响应式状态为什么同时需要 Proxy 和 effect 函数。

## 28-40 分钟：VNode 与组件

阅读：

- [最小虚拟 DOM](/zh-cn/10-minimum-example/040-minimum-virtual-dom)
- [迈向面向组件的开发](/zh-cn/10-minimum-example/050-minimum-component)
- [组件 Props](/zh-cn/10-minimum-example/051-component-props)
- [组件 Emit](/zh-cn/10-minimum-example/052-component-emits)

实践：

- 比较元素 VNode 与组件 VNode。
- 找到调用组件 `setup` 的位置。
- 找到 props 如何进入组件，以及 emit 如何从组件向外传递。

检查点：

- 你能够解释为什么组件也表示为 VNode。

## 40-52 分钟：模板编译器

阅读：

- [理解模板编译器](/zh-cn/10-minimum-example/060-template-compiler)
- [实现模板编译器](/zh-cn/10-minimum-example/061-template-compiler-impl)
- [数据绑定](/zh-cn/10-minimum-example/080-template-binding)

实践：

- 跟踪这条流水线：模板字符串、解析结果、生成的渲染函数。
- 找到 `{{ count }}` 这样的插值被转换为代码的位置。

检查点：

- 你能说明编译器会生成什么，以及运行时为什么能够执行它。

## 52-60 分钟：SFC 支持

阅读：

- [使用 SFC 开发（相关知识）](/zh-cn/10-minimum-example/090-prerequisite-knowledge-for-the-sfc)
- [解析 SFC](/zh-cn/10-minimum-example/091-parse-sfc)
- [SFC template 块](/zh-cn/10-minimum-example/092-compile-sfc-template)
- [SFC script 块](/zh-cn/10-minimum-example/093-compile-sfc-script)
- [SFC style 块](/zh-cn/10-minimum-example/094-compile-sfc-style)

实践：

- 找出 SFC 的三个代码块。
- 找到哪个代码块会变成渲染代码。
- 找到哪个代码块会变成组件选项。
- 找到哪个代码块会变成 CSS。

检查点：

- 你可以把 `.vue` 描述为一种便于编写的格式；运行时看到它之前，它会被拆分和转换。

## 到此为止

现在你已经掌握了整体骨架。接下来最好不要急着学习所有高级功能，而是选出最令你意外的部分，重新完整阅读对应的原始章节。
