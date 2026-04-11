# スケジューラ

## effect のスケジューリング

まずはこのコードをご覧ください．

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      message: 'Hello World',
    })
    const updateState = () => {
      state.message = 'Hello ChibiVue!'
      state.message = 'Hello ChibiVue!!'
    }

    return () => {
      console.log('😎 rendered!')

      return h('div', { id: 'app' }, [
        h('p', {}, [`message: ${state.message}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

ボタンをクリックすると，state.message に対して 2 回 set が起こるので，当然 2 回 trigger が実行されることになります．
つまりは，2 回 Virtual DOM が算出され，2 回 patch が行われます．

![Effect result before scheduler batching](/figures/20-basic-virtual-dom/scheduler/non-scheduled-effect.png)

しかし，実際に patch 処理を行うのは 2 回目のタイミングだけで十分なはずです．  
そこで，スケジューラを実装します．スケジューラというのはあるタスクに対する実行順番であったり，実行を管理するものです．
Vue のスケジューラの役割の一つとして，リアクティブな作用をキューで管理し，まとめられるものはまとめる，というのがあります．

## キュー管理によるスケジューリング

具体的にはキュー をもち，ジョブを管理します．ジョブは id を持っており，キューに新しくジョブがエンキューされる際に，既に同一の id を持ったジョブが存在していた場合に上書きしてしまいます．

```ts
export interface SchedulerJob extends Function {
  id?: number
}

const queue: SchedulerJob[] = []

export function queueJob(job: SchedulerJob) {
  if (
    !queue.length ||
    !queue.includes(job, isFlushing ? flushIndex + 1 : flushIndex)
  ) {
    if (job.id == null) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}
```

肝心のジョブの id ですが，今回の場合はコンポーネント単位でまとめたいので，コンポーネントに uid を持たせるようにして，それらを job の id となるように実装します．

uid といっても単にインクリメントによって得られる識別子です．

## ReactiveEffect とスケジューラ

現在，ReactiveEffect は以下のようなインタフェースになっています．(一部省略)

```ts
class ReactiveEffect {
  public fn: () => T,
  run() {}
}
```

スケジューラの実装に伴って少し変えてみます．  
現在，作用として fn に関数を登録しているのですが，今回は「能動的に実行する作用」と「受動的に実行される作用」に分けてみます．  
Reactive な作用として扱うものは，作用を設定した側で能動的に実行される場合と，dep に追加された後で，何らかの外部のアクションによって trigger され受動的に実行される場合があります．  
後者の作用は不特定多数の depsMap に追加され，不特定多数に trigger されるので，スケジューリングの対応が必要です．(逆にいえば能動的(明示的)に呼ぶならばそのような対応は必要ない)

具体例を考えてみましょう．今実際に renderer の setupRenderEffect では以下のような実装があるかと思います．

```ts
const effect = (instance.effect = new ReactiveEffect(() => componentUpdateFn))
const update = (instance.update = () => effect.run())
update()
```

ここで生成した effect という reactiveEffect はのちに setup の実行によって getter が走った reactive なオブジェクトに track されるわけですが，これは明らかにスケジューリングの実装が必要です．(バラバラにいろんなところから trigger されるため)  
しかし，ここで`update()`を呼び出していることに関してはそのまま作用を実行するだけでいいはずなので，スケジューリングの実装は必要ありません．  
「え？　じゃあ componentUpdateFn を直接呼び出せばいいんじゃないの？」と思うかも知れませんが，run の実装をよく思い出してください．componentUpdateFn を呼び出すだけでは activeEffect が設定されません．  
そこで，「能動的に実行する作用」と「受動的に実行される作用(スケジューラが必要な作用)」を分けてもつように変えてみましょう．

このチャプターでの最終的なインタフェースとしては，以下のようになります．

```ts
// ReactiveEffectの第 1 引数が能動的な作用, 第 2 引数が受動的な作用
const effect = (instance.effect = new ReactiveEffect(componentUpdateFn, () =>
  queueJob(update),
))
const update: SchedulerJob = (instance.update = () => effect.run())
update.id = instance.uid
update()
```

実装的には，ReactiveEffect に fn とは別に scheduler という関数をもち，trigger では scheduler を優先して実行するようにします．

```ts
export type EffectScheduler = (...args: any[]) => any;

export class ReactiveEffect<T = any> {
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  );
}
```

```ts
function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler()
  } else {
    effect.run() // なければ通常の作用を実行する
  }
}
```

---

さて，キュー管理によるスケジューリングと作用の分類わけを実際にソースコードを読みながら実装してみましょう !

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/040_scheduler)

## nextTick が欲しい

スケジューラの実装をする際にソースコードを読んだかたは「nextTick ってここで出てくるのか」というのに気づいた方もいるかもしれません．
まずは今回実現したい課題についてです．こちらのコードをご覧ください．

```ts
import { createApp, h, reactive } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      count: 0,
    })
    const updateState = () => {
      state.count++

      const p = document.getElementById('count-p')
      if (p) {
        console.log('😎 p.textContent', p.textContent)
      }
    }

    return () => {
      return h('div', { id: 'app' }, [
        h('p', { id: 'count-p' }, [`${state.count}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

こちらのボタンをクリックしてみてコンソールを覗いてみましょう．

![Old DOM state before nextTick](/figures/20-basic-virtual-dom/scheduler/old-state-dom.png)

`state.count`を更新した後にコンソールに出力しているのに，情報が古くなってしまっています．  
それもそのはず，ステートを更新しても瞬時に DOM が更新されるわけではなく，コンソールに出力した段階ではまだ DOM は古い状態のままです．

ここで登場するのが nextTick です．

https://vuejs.org/api/general.html#nexttick

この nextTick というのはスケジューラの API で，スケジューラによって DOM に変更が適応されるまで待つことができます．  
nextTick の実装方法ですが，非常に単純で，スケジューラ内で今 flush しているジョブ(promise)を保持しておいて，それの then に繋ぐだけです．

```ts
export function nextTick<T = void>(
  this: T,
  fn?: (this: T) => void,
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}
```

そのジョブが完了した(promise が resolve された)際に nextTick に渡されたコールバックを実行するということです．(キューにジョブがなければ resolvedPromise の then に繋ぎます)  
当然，この nextTick 自体も Promise を返すため，開発者インタフェースとしては，コールバックに渡すのもよし，nextTick を await するのもよし，といった感じになっているわけです．

```ts
import { createApp, h, reactive, nextTick } from 'chibivue'

const app = createApp({
  setup() {
    const state = reactive({
      count: 0,
    })
    const updateState = async () => {
      state.count++

      await nextTick() // 待つ
      const p = document.getElementById('count-p')
      if (p) {
        console.log('😎 p.textContent', p.textContent)
      }
    }

    return () => {
      return h('div', { id: 'app' }, [
        h('p', { id: 'count-p' }, [`${state.count}`]),
        h('button', { onClick: updateState }, ['update']),
      ])
    }
  },
})

app.mount('#app')
```

![DOM state after nextTick](/figures/20-basic-virtual-dom/scheduler/next-tick.png)

さて，実際に今のスケジューラの実装を`currentFlushPromise`を保持しておくような実装に書き換えて，nextTick を実装してみましょう!

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/050_next_tick)
