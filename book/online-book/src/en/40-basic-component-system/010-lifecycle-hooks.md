# Lifecycle Hooks (Basic Component System Start)

## Let's Implement Lifecycle Hooks

Implementing lifecycle hooks is very simple.
You just need to register functions in ComponentInternalInstance and execute them at the specified timing during rendering.
The API itself will be implemented in runtime-core/apiLifecycle.ts.

One thing to note is that you need to consider scheduling for onMounted/onUnmounted/onUpdated.
The registered functions should be executed after the mount, unmount, and update are completely finished.

Therefore, we will implement a new type of queue called "post" in the scheduler. This is something that will be flushed after the existing queue flush is finished.
Image ↓

```ts
const queue: SchedulerJob[] = [] // Existing implementation
const pendingPostFlushCbs: SchedulerJob[] = [] // New queue to be created this time

function queueFlush() {
  queue.forEach(job => job())
  flushPostFlushCbs() // Flush after the queue flush
}
```

Also, with this, let's implement an API that enqueues into pendingPostFlushCbs.
And let's use it to enqueue the effect in the renderer to pendingPostFlushCbs.

Lifecycle hooks to be supported this time:

- onMounted
- onUpdated
- onUnmounted
- onBeforeMount
- onBeforeUpdate
- onBeforeUnmount

Let's implement it aiming for the following code to work!

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

Source code so far:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/010_lifecycle_hooks)
