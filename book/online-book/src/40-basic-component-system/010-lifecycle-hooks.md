# ライフサイクルフック (Basic Component System 部門スタート)

## ライフサイクルフックを実装しよう

ライフサイクルフックの実装はとても簡単です。  
ComponentInternalInstance に関数を登録して、render 時に所定のタイミングで実行してあげるだけです。  
API 自体は runtime-core/apiLifecycle.ts に実装していきます。

一点、注意するべきところがあるとすれば、onMounted/onUnmounted/onUpdated に関してはスケジューリングを考えなければならない点です。  
登録された関数たちはマウントやアンマウント、アップデートが完全に終わったタイミングで実行したいわけです。

そこで、スケジューラの方で`post`という種類のキューを新たに実装します。これは既存の queue の flush が終わった後に flush されるようなものです。  
イメージ ↓

```ts
const queue: SchedulerJob[] = [] // 既存実装
const pendingPostFlushCbs: SchedulerJob[] = [] // 今回新しく作る queue

function queueFlush() {
  queue.forEach(job => job())
  flushPostFlushCbs() // queue の flush の後で flush する
}
```

また、これに伴って、pendingPostFlushCbs に enqueue するような API も実装しましょう。
そして、それを使って renderer で作用を pendingPostFlushCbs に enqueue しましょう。

今回対応するライフサイクル

- onMounted
- onUpdated
- onUnmounted
- onBeforeMount
- onBeforeUpdate
- onBeforeUnmount

以下のようなコードが動くことを目指して実装してみましょう！

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

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/40_basic_component_system/010_lifecycle_hooks)
