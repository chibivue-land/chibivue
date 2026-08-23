# 高级 30 分钟概要

::: warning AI 生成的附录
本附录由 GPT-5.5 根据 chibivue 原书内容起草。请将这条路线视为学习指南；原始章节与实现代码仍是权威依据。
:::

这是一幅高度压缩的全书地图，适合希望在阅读源码前快速通览全书的读者。每个检查点大约用一分钟。内容已经很清楚时就继续前进；感觉模糊时则打开链接所指的章节。

## 30 个检查点

1. [全书从一行渲染代码开始](/zh-cn/00-introduction/010-about)：重点不是完美复刻 Vue，而是亲手重建其中的思路。
2. [Vue 的核心组成部分](/zh-cn/00-introduction/030-vue-core-components)：运行时、渲染器、响应式系统、编译器和 SFC 工具分别关注不同的问题。
3. [项目设置](/zh-cn/00-introduction/040-setup-project)：包的边界让学习路径清晰可见。
4. [createApp](/zh-cn/10-minimum-example/010-create-app-api)：应用 API 封装了挂载过程，为用户提供统一入口。
5. [包架构](/zh-cn/10-minimum-example/015-package-architecture)：runtime-core 保持平台无关，runtime-dom 负责浏览器操作。
6. [h 与 VNode](/zh-cn/10-minimum-example/020-simple-h-function)：渲染结果是数据结构，而不是 DOM。
7. [事件与属性](/zh-cn/10-minimum-example/025-event-handler-and-attrs)：DOM patch 需要针对平台处理 props。
8. [最小响应式系统](/zh-cn/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)：Proxy 读取意味着 track，Proxy 写入意味着 trigger。
9. [最小虚拟 DOM](/zh-cn/10-minimum-example/040-minimum-virtual-dom)：patch 比较新旧 VNode 并更新 DOM。
10. [最小组件](/zh-cn/10-minimum-example/050-minimum-component)：挂载组件 VNode 时会创建实例并执行渲染函数。
11. [Props](/zh-cn/10-minimum-example/051-component-props)：父组件的数据通过规范化的输入传入子组件。
12. [Emits](/zh-cn/10-minimum-example/052-component-emits)：子组件事件本质上是按约定命名的父组件处理器。
13. [模板编译器概览](/zh-cn/10-minimum-example/060-template-compiler)：模板会变成渲染函数。
14. [编译器实现](/zh-cn/10-minimum-example/061-template-compiler-impl)：解析、转换和代码生成构成编译器的核心流水线。
15. [模板绑定](/zh-cn/10-minimum-example/080-template-binding)：编译器输出必须从渲染上下文读取值。
16. [解析 SFC](/zh-cn/10-minimum-example/091-parse-sfc)：`.vue` 文件会拆分为 script、template 和 style 块。
17. [SFC template/script/style](/zh-cn/10-minimum-example/092-compile-sfc-template)：Vite 插件将 SFC 转换接入开发流程。
18. [带 key 的 patch](/zh-cn/20-basic-virtual-dom/010-patch-keyed-children)：稳定的 key 让渲染器能够移动和复用子节点。
19. [Shape Flags](/zh-cn/20-basic-virtual-dom/020-bit-flags)：位标志降低了重复类型检查的成本。
20. [调度器](/zh-cn/20-basic-virtual-dom/030-scheduler)：响应式变化将任务加入队列，从而批量处理重复更新。
21. [ref、computed 与 watch](/zh-cn/30-basic-reactivity-system/010-ref-api)：响应式能力从对象扩展到值容器和面向用户的 effect。
22. [响应式 Proxy 处理器](/zh-cn/30-basic-reactivity-system/030-reactive-proxy-handlers)：集合、ref、只读值与 shallow 值需要更细致的处理器逻辑。
23. [Effect 清理与作用域](/zh-cn/30-basic-reactivity-system/040-effect-scope)：effect 不仅需要重新运行，也需要生命周期管理。
24. [组件生命周期](/zh-cn/40-basic-component-system/010-lifecycle-hooks)：组件实例为运行时调用用户钩子提供了时机。
25. [Provide/Inject 与 setup context](/zh-cn/40-basic-component-system/020-provide-inject)：组件树需要结构化的依赖与上下文传递通道。
26. [插槽](/zh-cn/40-basic-component-system/040-component-slot)：子节点可以作为延迟执行的渲染函数传递。
27. [模板转换](/zh-cn/50-basic-template-compiler/010-transform)：指令是将语法转换为 VNode 数据的编译器插件。
28. [结构指令](/zh-cn/50-basic-template-compiler/040-v-if-and-structural-directive)：`v-if`、`v-for`、Fragment、注释和插槽共同决定生成树的形状。
29. [SFC 编译器宏](/zh-cn/60-basic-sfc-compiler/010-script-setup)：`script setup`、`defineProps`、`defineEmits`、scoped CSS 和基于类型的宏都是编译期便利功能。
30. [应用开发基础与优化](/zh-cn/90-web-application-essentials/010-plugins/010-router)：路由、Store、SSR、内置组件、静态提升、Patch Flags、树扁平化和 Vapor Mode 展示了同一组核心思路如何扩展。

## 完成概要之后

不中断地阅读一条源码路径：

```txt
packages/reactivity -> packages/runtime-core -> packages/runtime-dom -> packages/compiler-core -> packages/compiler-sfc
```

然后阅读[调试原始 Vue.js 源码](/zh-cn/bonus/debug-vuejs-core)，将 chibivue 的简化选择与 `vuejs/core` 进行比较。\n
