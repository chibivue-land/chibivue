# 生命周期钩子（基础组件系统开始）

## 让我们实现生命周期钩子

实现生命周期钩子非常简单。
你只需要在 ComponentInternalInstance 中注册函数，并在渲染期间的指定时机执行它们。
API 本身将在 runtime-core/apiLifecycle.ts 中实现。

需要注意的一点是，你需要考虑 onMounted/onUnmounted/onUpdated 的调度。
注册的函数应该在挂载、卸载和更新完全完成后执行。

因此，我们将在调度器中实现一种名为"post"的新队列类型。这是在现有队列刷新完成后才会被刷新的队列。
图像 ↓

```ts
const queue: SchedulerJob[] = [] // 现有实现
const pendingPostFlushCbs: SchedulerJob[] = [] // 这次要创建的新队列

function queueFlush() {
  queue.forEach(job => job())
  flushPostFlushCbs() // 在队列刷新后刷新
}
```

同时，通过这个，让我们实现一个入队到 pendingPostFlushCbs 的 API。
并且让我们使用它将渲染器中的 effect 入队到 pendingPostFlushCbs。

这次要支持的生命周期钩子：

- onMounted
- onUpdated
- onUnmounted
- onBeforeMount
- onBeforeUpdate
- onBeforeUnmount

让我们实现它，目标是使以下代码工作！

```ts
import {
  createApp,
  h,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
} from 'chibivue'

const Child = {
  setup() {
    const count = ref(0)
    onBeforeMount(() => {
      console.log('onBeforeMount')
    })

    onUnmounted(() => {
      console.log('onUnmounted')
    })

    onBeforeUnmount(() => {
      console.log('onBeforeUnmount')
    })

    onBeforeUpdate(() => {
      console.log('onBeforeUpdate')
    })

    onUpdated(() => {
      console.log('onUpdated')
    })

    onMounted(() => {
      console.log('onMounted')
    })

    return () =>
      h('div', {}, [
        h('p', {}, [`${count.value}`]),
        h('button', { onClick: () => count.value++ }, ['increment']),
      ])
  },
}

const app = createApp({
  setup() {
    const mountFlag = ref(true)

    return () =>
      h('div', {}, [
        h('button', { onClick: () => (mountFlag.value = !mountFlag.value) }, [
          'toggle',
        ]),
        mountFlag.value ? h(Child, {}, []) : h('p', {}, ['unmounted']),
      ])
  },
})

app.mount('#app')
```

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/010_lifecycle_hooks)
