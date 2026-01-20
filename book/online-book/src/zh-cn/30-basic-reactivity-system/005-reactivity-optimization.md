# 响应式优化

::: info 关于本章
本章介绍 Vue 3.6 中将引入的基于 [alien-signals](https://github.com/stackblitz/alien-signals) 的响应式系统优化．\
chibivue 的实现也基于此算法进行了更新．
:::

## 背景

Vue.js 的响应式系统在 Vue 3.4 中进行了重大性能优化．然而，Vue 3.5 切换到了类似 Preact 的 pull-based 算法，改变了响应式系统的方向．

为了进一步研究 push-pull based 实现，Vue 的核心贡献者 Johnson Chu 开发了独立项目 [alien-signals](https://github.com/stackblitz/alien-signals)．

alien-signals 是基于 Vue 3.4 响应式系统重新实现的信号库，具有以下特点：

- **轻量**：最小的内存占用
- **快速**：约为 Vue 3.4 响应式系统的 4 倍（400%）性能
- **内存高效**：约 13% 的内存使用量减少

这些成果将在 Vue 3.6 中被移植到 Vue 核心的响应式系统中．

参考：[vuejs/core#12349](https://github.com/vuejs/core/pull/12349)

<KawaikoNote variant="surprise" title="性能提升 4 倍！">

alien-signals 基于 Vue 3.4 的响应式系统重新实现，竟然实现了**约 4 倍**的性能提升！\
随着这项成果被整合到 Vue 3.6 中，所有 Vue 用户都将受益于这些优化．

</KawaikoNote>

## Push-Pull 响应式算法

让我们简要解释 alien-signals 采用的 Push-Pull 算法．

### Push-based 与 Pull-based

响应式系统主要有两种方法：

**Push-based（推送型）**

当依赖项发生变化时，立即更新所有依赖的 computed 值．

```
signal 变化 → 立即更新所有 computed → 执行 effect
```

优点：始终保证最新值
缺点：即使未使用的 computed 也会被更新

**Pull-based（拉取型）**

computed 值仅在需要时（读取时）才计算．

```
signal 变化 → (不做任何事) → 在 effect 中读取 computed → 此时计算
```

优点：仅执行必要的计算
缺点：读取时有开销

### Push-Pull（混合型）

alien-signals 和 Vue 3.6 采用的 Push-Pull 算法结合了两者的优点：

1. **Push 阶段**：当 signal 变化时，在依赖的 computed 上设置"dirty"标志
2. **Pull 阶段**：当读取 computed 时，如果是 dirty 则重新计算

```
signal 变化 → 传播 dirty 标志 → 在 effect 中读取 computed → 如果 dirty 则重新计算
```

这种方法提供：
- 避免不必要的计算（Pull 的优点）
- 高效的依赖跟踪（Push 的优点）

<KawaikoNote variant="funny" title="两全其美！">

Push-Pull 算法是一种结合了 Push 和 Pull 两者优点的聪明方法．\
"发生变化时只传播 dirty 标志，实际计算等到需要时再做"的策略，彻底消除了不必要的计算！

</KawaikoNote>

## alien-signals 的基本 API

alien-signals 提供了非常简单的 API：

```ts
import { signal, computed, effect } from 'alien-signals'

// signal：创建响应式值
const count = signal(1)

// 读取值
console.log(count()) // 1

// 更新值
count(2)

// computed：创建派生值
const double = computed(() => count() * 2)
console.log(double()) // 4

// effect：注册副作用
effect(() => {
  console.log(`Count is: ${count()}`)
})

count(3) // 输出 "Count is: 3"
```

与 Vue 的 `ref` 和 `reactive` 比较：

| alien-signals | Vue |
|--------------|-----|
| `signal(value)` | `ref(value)` |
| `signal()` 读取 | `.value` 读取 |
| `signal(newValue)` 写入 | `.value = newValue` 写入 |
| `computed(() => ...)` | `computed(() => ...)` |
| `effect(() => ...)` | `watchEffect(() => ...)` |

## 实现概述

::: warning
本章不会完全移植 alien-signals 的实现，而是解释其概念和基本机制．\
要完全理解，请参阅 [alien-signals 源代码](https://github.com/stackblitz/alien-signals) 或 [Vue 3.6 的 PR](https://github.com/vuejs/core/pull/12349)．
:::

<KawaikoNote variant="base" title="请查看 Johnson 的解说！">

如果您想了解更多关于 alien-signals 算法的内容，我们推荐阅读作者 Johnson Chu 撰写的解说！\
[https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30](https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30)

</KawaikoNote>

### 双向链表

alien-signals 的重要优化之一是使用双向链表管理依赖关系．

传统的 Vue 实现使用 Set 管理依赖：

```ts
// 传统实现
class Dep {
  subscribers = new Set<ReactiveEffect>()

  track() {
    if (activeEffect) {
      this.subscribers.add(activeEffect)
    }
  }

  trigger() {
    this.subscribers.forEach(effect => effect.run())
  }
}
```

alien-signals 使用链表：

```ts
// alien-signals 风格
interface Link {
  dep: Dep
  sub: Subscriber
  prevDep: Link | undefined  // 同一 subscriber 的前一个 dep 的引用
  nextDep: Link | undefined  // 同一 subscriber 的下一个 dep 的引用
  prevSub: Link | undefined  // 同一 dep 的前一个 subscriber 的引用
  nextSub: Link | undefined  // 同一 dep 的下一个 subscriber 的引用
}
```

这种结构提供：
- 减少内存使用（避免 Set 的开销）
- O(1) 的依赖添加/删除
- 减少 GC 压力

### 版本管理

另一个重要优化是使用版本号进行 dirty 检查：

```ts
let globalVersion = 0

function triggerRef(ref: Ref) {
  globalVersion++
  ref.version = globalVersion
  // 向 subscribers 传播 dirty
}

function computedGetter(computed: ComputedRef) {
  if (computed.globalVersion !== globalVersion) {
    // 依赖项之一可能已更新
    if (checkDirty(computed)) {
      // 如果实际是 dirty 则重新计算
      computed.value = computed.getter()
    }
    computed.globalVersion = globalVersion
  }
  return computed.value
}
```

使用全局版本提供：
- 高效判断 computed 是否真的需要重新计算
- 避免不必要的依赖遍历

## chibivue 中的实现

chibivue 基于 alien-signals 算法实现响应式系统．

主要文件：
- `packages/reactivity/dep.ts` - 依赖管理
- `packages/reactivity/effect.ts` - effect 实现
- `packages/reactivity/ref.ts` - ref 实现
- `packages/reactivity/computed.ts` - computed 实现

基本结构：

```ts
// packages/reactivity/dep.ts
export interface Link {
  dep: Dep
  sub: Subscriber
  version: number
  prevDep: Link | undefined
  nextDep: Link | undefined
  prevSub: Link | undefined
  nextSub: Link | undefined
}

export class Dep {
  version = 0
  link: Link | undefined = undefined
  subs: Link | undefined = undefined

  track(): Link | undefined {
    // 将 activeEffect 注册为订阅者
  }

  trigger(): void {
    // 通知所有订阅者
  }
}
```

```ts
// packages/reactivity/effect.ts
export class ReactiveEffect<T = any> implements Subscriber {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined

  run(): T {
    // 执行 effect 函数并收集依赖
  }
}
```

后续章节将基于这个优化的响应式系统进行构建．

<KawaikoNote variant="base" title="继续前进">

你理解 alien-signals 的概念了吗？\
链表和版本管理一开始可能感觉很难，但随着你编写代码，自然会理解的．\
让我们在下一章中基于这个优化的机制实现 ref 和 computed！

</KawaikoNote>

## 总结

- Vue 3.6 将引入基于 alien-signals 的优化响应式系统
- Push-Pull 算法实现高效的 dirty 检查和延迟评估
- 双向链表的依赖管理提高内存效率
- 基于版本号的 dirty 检查避免不必要的重新计算

从下一章开始，我们将在这个优化的响应式系统之上实现 ref 和 computed 等 API．

## 参考链接

- [stackblitz/alien-signals](https://github.com/stackblitz/alien-signals) - alien-signals 官方仓库
- [alien-signals 算法详细解说](https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30) - 作者 Johnson Chu 撰写的详细解说
- [vuejs/core#12349](https://github.com/vuejs/core/pull/12349) - Vue 3.6 移植 PR
- [掌握 Vue 3.6 的 Alien Signals](https://medium.com/@revanthkumarpatha/mastering-vue-3-6s-alien-signals-practical-examples-and-use-cases-7df02a159d8a) - Medium 文章
