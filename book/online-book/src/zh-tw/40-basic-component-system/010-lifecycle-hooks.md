# 生命週期鉤子（基礎組件系統開始）

## 讓我們實現生命週期鉤子

實現生命週期鉤子非常簡單。
你只需要在 ComponentInternalInstance 中註冊函式，並在渲染期間的指定時機執行它們。
API 本身將在 runtime-core/apiLifecycle.ts 中實現。

需要注意的一點是，你需要考慮 onMounted/onUnmounted/onUpdated 的調度。
註冊的函式應該在掛載、卸載和更新完全完成後執行。

因此，我們將在調度器中實現一種名為"post"的新佇列類型。這是在現有佇列刷新完成後才會被刷新的佇列。
圖像 ↓

```ts
const queue: SchedulerJob[] = [] // 現有實現
const pendingPostFlushCbs: SchedulerJob[] = [] // 這次要創建的新佇列

function queueFlush() {
  queue.forEach(job => job())
  flushPostFlushCbs() // 在佇列刷新後刷新
}
```

同時，透過這個，讓我們實現一個入佇列到 pendingPostFlushCbs 的 API。
並且讓我們使用它將渲染器中的 effect 入佇列到 pendingPostFlushCbs。

這次要支援的生命週期鉤子：

- onMounted
- onUpdated
- onUnmounted
- onBeforeMount
- onBeforeUpdate
- onBeforeUnmount

讓我們實現它，目標是使以下程式碼工作！

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

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/40_basic_component_system/010_lifecycle_hooks)
