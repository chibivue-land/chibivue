# 进阶 60 分钟动手实践

::: warning AI 生成的附录
本附录由 GPT-5.5 根据 chibivue 原书内容起草。请将这条路线视为学习指南；原始章节与实现代码仍是权威依据。
:::

这条路线适合已经熟悉 Vue、TypeScript 或框架内部机制的读者。它不从首次渲染开始按原书顺序阅读，而是沿着更新路径前进：状态发生变化、任务进入调度队列、组件重新渲染，编译器输出则为渲染器提供更准确的指令。

## 目标

完成后，你应该能够追踪下面这条路径：

```txt
状态变更 -> trigger -> 调度器 -> 组件更新 -> patch -> DOM 操作
```

你还应该知道编译器转换在这条运行时路径中处于什么位置。

## 0-6 分钟：选择可运行的快照

阅读：

- [稍作休息](/zh-cn/10-minimum-example/100-break)
- [基础虚拟 DOM：key 属性与 patch 渲染](/zh-cn/20-basic-virtual-dom/010-patch-keyed-children)

实践：

- 打开 `book/impls/20_basic_virtual_dom/040_scheduler` 或更晚的实现快照。
- 找到 `renderer.ts`、`scheduler.ts`、`effect.ts` 和 `vnode.ts`。

检查点：

- 你已经找到能够解释大多数运行时更新的四个文件。

## 6-18 分钟：渲染器与带 key 的 patch

阅读：

- [key 属性与 patch 渲染](/zh-cn/20-basic-virtual-dom/010-patch-keyed-children)
- [VNode 的位级表示](/zh-cn/20-basic-virtual-dom/020-bit-flags)
- [处理其他 Props 的 patch](/zh-cn/20-basic-virtual-dom/040-patch-other-attrs)

实践：

- 找到用于判断 VNode 是元素还是组件的分支。
- 找到对子节点进行带 key patch 的函数。
- 找到更新后 patch props 的位置。

检查点：

- 你能说明 VNode 的哪些部分可以帮助渲染器选择快速路径。

## 18-30 分钟：调度器与响应式

阅读：

- [调度器](/zh-cn/20-basic-virtual-dom/030-scheduler)
- [响应式优化](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)
- [computed / watch API](/zh-cn/30-basic-reactivity-system/020-computed-watch)
- [Effect 清理与 Effect 作用域](/zh-cn/30-basic-reactivity-system/040-effect-scope)

实践：

- 找到 `trigger` 收集 effect 的位置。
- 找到组件更新进入队列而不是立即执行的位置。
- 找到避免重复任务的位置。
- 查看 computed 或 watch 如何改变 effect 的执行时机。

检查点：

- 你能够区分“某个值发生了变化”和“DOM 已经更新”。调度器位于这两个事件之间。

## 30-42 分钟：组件更新接口

阅读：

- [生命周期钩子](/zh-cn/40-basic-component-system/010-lifecycle-hooks)
- [Provide/Inject](/zh-cn/40-basic-component-system/020-provide-inject)
- [组件代理与 setupContext](/zh-cn/40-basic-component-system/030-component-proxy-setup-context)
- [插槽](/zh-cn/40-basic-component-system/040-component-slot)

实践：

- 找到组件实例的数据结构。
- 找到 `setup` 的结果如何暴露给渲染函数。
- 找到挂载或更新期间调用生命周期钩子的位置。
- 找到插槽在渲染前被规范化的位置。

检查点：

- 你可以把组件实例描述为运行时状态、props、setup 状态和渲染上下文的汇合点。

## 42-56 分钟：编译器为运行时做准备

阅读：

- [重构用于 Codegen 的 Transformer 实现](/zh-cn/50-basic-template-compiler/010-transform)
- [实现指令（v-bind）](/zh-cn/50-basic-template-compiler/020-v-bind)
- [在模板中求值表达式](/zh-cn/50-basic-template-compiler/022-transform-expression)
- [支持 v-on](/zh-cn/50-basic-template-compiler/025-v-on)
- [v-if 与结构指令](/zh-cn/50-basic-template-compiler/040-v-if-and-structural-directive)
- [支持 v-for](/zh-cn/50-basic-template-compiler/050-v-for)

实践：

- 跟踪一个指令如何从 AST 节点变成生成的渲染代码。
- 找到表达式被添加前缀，或根据渲染上下文求值的位置。
- 比较 `v-if` 和 `v-for`：前者改变分支，后者改变列表形状。

检查点：

- 你能够解释编译器转换如何生成随后由渲染器 patch 的 VNode 调用。

## 56-60 分钟：选择下一项深入学习内容

选择一项：

- 偏重运行时：继续阅读[静态提升](/zh-cn/90-web-application-essentials/040-optimizations/010-static-hoisting)、[Patch Flags](/zh-cn/90-web-application-essentials/040-optimizations/020-patch-flags)和[树扁平化](/zh-cn/90-web-application-essentials/040-optimizations/030-tree-flattening)。
- 偏重编译器：继续阅读[基础 SFC 编译器](/zh-cn/60-basic-sfc-compiler/010-script-setup)。
- 偏重生态系统：继续阅读[路由器](/zh-cn/90-web-application-essentials/010-plugins/010-router)、[Store](/zh-cn/90-web-application-essentials/010-plugins/020-store)和[语言工具](/zh-cn/90-web-application-essentials/010-plugins/040-language-tools)。\n
