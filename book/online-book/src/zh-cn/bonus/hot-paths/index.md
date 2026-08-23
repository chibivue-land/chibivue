# 快速学习路线

::: warning AI 生成的附录
本附录由 GPT-5.5 根据 chibivue 原书内容起草。请将这些路线视为学习指南；原始章节与实现代码仍是权威依据。
:::

chibivue 有意采用渐进式讲解，但这也使全书篇幅较长。本附录为你提供几条较短的阅读路线，适合在按顺序通读全书前先掌握核心思路。

每条路线都会说明要阅读什么、实现或查看什么，以及在哪里结束。如果某条路线节奏太快，可以跳转到链接所指的原始章节，弄懂缺失的环节后再回来。

## 路线

| 路线 | 用时 | 适合读者 | 你将理解 |
| --- | --- | --- | --- |
| [初学者 30 分钟动手实践](./beginner-30-min-hands-on) | 30 分钟 | 希望以最小成果入门的首次阅读者 | `createApp`、VNode 渲染、响应式与微型编译器如何衔接 |
| [初学者 60 分钟动手实践](./beginner-60-min-hands-on) | 60 分钟 | 能安排一段完整时间学习的初学者 | 从首次渲染到 SFC 的完整 Minimum Example 流程 |
| [进阶 60 分钟动手实践](./intermediate-60-min-hands-on) | 60 分钟 | 已熟悉 Vue 或 TypeScript 的读者 | 使组件更新得以运行的运行时和编译器路径 |
| [高级 30 分钟概要](./advanced-30-min-summary) | 30 分钟 | 希望在阅读源码前先获得精简全景图的读者 | 以 30 个检查点串起全书内容 |

## 如何使用这些路线

1. 阅读路线时，在旁边同时打开对应的原始章节。
2. 为每一节设定时间上限。保持整体认识比完成整条路线更重要。
3. 想将自己的理解与可运行代码对照时，请查看 `book/impls` 下的实现快照。
4. 完成一条路线后，选一篇原始章节慢慢精读。快速路线只是地图，不是知识本身。

## 涵盖的原书部分

- [入门指南](/zh-cn/00-introduction/010-about)
- [最小示例](/zh-cn/10-minimum-example/010-create-app-api)
- [基础虚拟 DOM](/zh-cn/20-basic-virtual-dom/010-patch-keyed-children)
- [基础响应式系统](/zh-cn/30-basic-reactivity-system/005-reactivity-optimization)
- [基础组件系统](/zh-cn/40-basic-component-system/010-lifecycle-hooks)
- [基础模板编译器](/zh-cn/50-basic-template-compiler/010-transform)
- [基础 SFC 编译器](/zh-cn/60-basic-sfc-compiler/010-script-setup)
- [Web 应用开发基础](/zh-cn/90-web-application-essentials/010-plugins/010-router)
- [15 分钟编写 Vue.js](/zh-cn/bonus/hyper-ultimate-super-extreme-minimal-vue/)\n
