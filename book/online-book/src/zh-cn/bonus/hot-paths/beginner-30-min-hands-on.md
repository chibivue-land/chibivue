# 初学者 30 分钟动手实践

::: warning AI 生成的附录
本附录由 GPT-5.5 根据 chibivue 原书内容起草。请将这条路线视为学习指南；原始章节与实现代码仍是权威依据。
:::

这条路线帮助你完成一个虽小却完整的闭环：创建应用、渲染按钮、更新状态，并理解为什么需要编译器。它沿用了[15 分钟编写 Vue.js](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/) 的思路，但留出了更充裕的理解时间。

## 目标

完成后，你应该能够解释下面这条链路：

```txt
createApp -> 渲染函数 -> VNode -> patch -> 响应式状态 -> effect -> 重新渲染
```

你不需要理解每个边界情况。目标是看清各个部分如何相互衔接。

## 0-5 分钟：建立最小心智模型

阅读：

- [chibivue，不是很小吗……？](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/)
- [项目设置](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#项目设置-0-5-分钟)

实践：

- 创建或打开一个 chibivue playground 项目。
- 找到导出这个微型 Vue 风格 API 的文件，通常是 `packages/index.ts`。
- 记住一条原则：这条路线中的每项功能都可以有意采用朴素实现。

检查点：

- 即使所有代码都放在同一个文件中，你也知道公共 API、渲染器、响应式系统和编译器代码分别位于哪里。

## 5-10 分钟：createApp 与 h

阅读：

- [createApp](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#createapp-1-分钟)
- [h 函数与虚拟 DOM](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#h-函数和虚拟-dom-0-5-分钟)
- 可选的深入章节：[首次渲染与 createApp API](/zh-cn/10-minimum-example/010-create-app-api)

实践：

- 编写或查看一个接收 `setup` 和 `render` 的 `createApp` 函数。
- 编写或查看一个返回普通对象的 `h` 函数。
- 确保 VNode 只包含演示所需的信息：标签、事件和子节点。

检查点：

- 你能够说明 Vue 为什么先渲染一个对象，而不是到处直接编写 DOM 操作代码。

## 10-17 分钟：将 VNode patch 到 DOM

阅读：

- [patch 渲染](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#补丁渲染-2-分钟)
- 可选的深入章节：[最小虚拟 DOM](/zh-cn/10-minimum-example/040-minimum-virtual-dom)

实践：

- 将 VNode 转换为实际的 DOM 元素。
- 绑定点击事件处理器。
- 将元素插入 `mount` 所选择的容器中。

检查点：

- 渲染函数能够生成 VNode，而 `patch` 能让该 VNode 显示在浏览器中。

## 17-23 分钟：让状态具有响应性

阅读：

- [实现](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)中的响应式部分
- 可选的深入章节：[尝试实现一个小型响应式系统](/zh-cn/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

实践：

- 查看依赖存储：哪个 effect 依赖哪个属性？
- 在点击事件处理器中更新状态。
- 确认状态变化时渲染 effect 会再次运行。

检查点：

- 你可以把 `track` 解释为“记住谁读取了这个值”，把 `trigger` 解释为“重新运行关心这个值的代码”。

## 23-28 分钟：用模板替代手写渲染函数

阅读：

- [实现](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)中的编译器与 SFC 部分
- 可选的深入章节：[理解模板编译器](/zh-cn/10-minimum-example/060-template-compiler)、[解析 SFC](/zh-cn/10-minimum-example/091-parse-sfc)

实践：

- 查看一个小型模板如何变成渲染函数。
- 有意限制编译器的范围：支持一个按钮、一个事件和一次插值就足够了。

检查点：

- 你能够说明编译器并不是另一套神秘系统。它只是生成运行时已经知道如何执行的渲染函数。

## 28-30 分钟：完成闭环

口头回答或记下以下问题：

- `h` 返回什么对象？
- 谁会调用 `patch`？
- 什么会让 `render` 再次运行？
- 为什么这个微型实现需要 Vite 插件才能支持 SFC？

下一条路线：

- 如果这次体验不错，请继续[初学者 60 分钟动手实践](./beginner-60-min-hands-on)。
- 如果代码显得过于密集，请先慢慢阅读[首次渲染与 createApp API](/zh-cn/10-minimum-example/010-create-app-api)，再继续下一步。
