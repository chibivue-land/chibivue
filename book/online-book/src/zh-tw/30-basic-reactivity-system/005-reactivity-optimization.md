# 響應式優化

::: info 關於本章
本章介紹 Vue 3.6 中將引入的基於 [alien-signals](https://github.com/stackblitz/alien-signals) 的響應式系統優化．\
chibivue 的實現也基於此演算法進行了更新．
:::

## 背景

Vue.js 的響應式系統在 Vue 3.4 中進行了重大性能優化．然而，Vue 3.5 切換到了類似 Preact 的 pull-based 演算法，改變了響應式系統的方向．

為了進一步研究 push-pull based 實現，Vue 的核心貢獻者 Johnson Chu（@nicekid1）開發了獨立專案 [alien-signals](https://github.com/stackblitz/alien-signals)．

alien-signals 是基於 Vue 3.4 響應式系統重新實現的訊號庫，具有以下特點：

- **輕量**：最小的記憶體佔用
- **快速**：約為 Vue 3.4 響應式系統的 4 倍（400%）效能
- **記憶體高效**：約 13% 的記憶體使用量減少

這些成果將在 Vue 3.6 中被移植到 Vue 核心的響應式系統中．

參考：[vuejs/core#12349](https://github.com/vuejs/core/pull/12349)

<KawaikoNote variant="surprise" title="效能提升 4 倍！">

alien-signals 基於 Vue 3.4 的響應式系統重新實現，竟然實現了**約 4 倍**的效能提升！\
隨著這項成果被整合到 Vue 3.6 中，所有 Vue 使用者都將受益於這些優化．

</KawaikoNote>

## Push-Pull 響應式演算法

讓我們簡要解釋 alien-signals 採用的 Push-Pull 演算法．

### Push-based 與 Pull-based

響應式系統主要有兩種方法：

**Push-based（推送型）**

當依賴項發生變化時，立即更新所有依賴的 computed 值．

```
signal 變化 → 立即更新所有 computed → 執行 effect
```

優點：始終保證最新值
缺點：即使未使用的 computed 也會被更新

**Pull-based（拉取型）**

computed 值僅在需要時（讀取時）才計算．

```
signal 變化 → (不做任何事) → 在 effect 中讀取 computed → 此時計算
```

優點：僅執行必要的計算
缺點：讀取時有開銷

### Push-Pull（混合型）

alien-signals 和 Vue 3.6 採用的 Push-Pull 演算法結合了兩者的優點：

1. **Push 階段**：當 signal 變化時，在依賴的 computed 上設置「dirty」標誌
2. **Pull 階段**：當讀取 computed 時，如果是 dirty 則重新計算

```
signal 變化 → 傳播 dirty 標誌 → 在 effect 中讀取 computed → 如果 dirty 則重新計算
```

這種方法提供：
- 避免不必要的計算（Pull 的優點）
- 高效的依賴追蹤（Push 的優點）

<KawaikoNote variant="funny" title="兩全其美！">

Push-Pull 演算法是一種結合了 Push 和 Pull 兩者優點的聰明方法．\
「發生變化時只傳播 dirty 標誌，實際計算等到需要時再做」的策略，徹底消除了不必要的計算！

</KawaikoNote>

## alien-signals 的基本 API

alien-signals 提供了非常簡單的 API：

```ts
import { signal, computed, effect } from 'alien-signals'

// signal：建立響應式值
const count = signal(1)

// 讀取值
console.log(count()) // 1

// 更新值
count(2)

// computed：建立衍生值
const double = computed(() => count() * 2)
console.log(double()) // 4

// effect：註冊副作用
effect(() => {
  console.log(`Count is: ${count()}`)
})

count(3) // 輸出 "Count is: 3"
```

與 Vue 的 `ref` 和 `reactive` 比較：

| alien-signals | Vue |
|--------------|-----|
| `signal(value)` | `ref(value)` |
| `signal()` 讀取 | `.value` 讀取 |
| `signal(newValue)` 寫入 | `.value = newValue` 寫入 |
| `computed(() => ...)` | `computed(() => ...)` |
| `effect(() => ...)` | `watchEffect(() => ...)` |

## 實現概述

::: warning
本章不會完全移植 alien-signals 的實現，而是解釋其概念和基本機制．\
要完全理解，請參閱 [alien-signals 原始碼](https://github.com/stackblitz/alien-signals) 或 [Vue 3.6 的 PR](https://github.com/vuejs/core/pull/12349)．
:::

### 雙向連結串列

alien-signals 的重要優化之一是使用雙向連結串列管理依賴關係．

傳統的 Vue 實現使用 Set 管理依賴：

```ts
// 傳統實現
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

alien-signals 使用連結串列：

```ts
// alien-signals 風格
interface Link {
  dep: Dep
  sub: Subscriber
  prevDep: Link | undefined  // 同一 subscriber 的前一個 dep 的參考
  nextDep: Link | undefined  // 同一 subscriber 的下一個 dep 的參考
  prevSub: Link | undefined  // 同一 dep 的前一個 subscriber 的參考
  nextSub: Link | undefined  // 同一 dep 的下一個 subscriber 的參考
}
```

這種結構提供：
- 減少記憶體使用（避免 Set 的開銷）
- O(1) 的依賴添加/刪除
- 減少 GC 壓力

### 版本管理

另一個重要優化是使用版本號進行 dirty 檢查：

```ts
let globalVersion = 0

function triggerRef(ref: Ref) {
  globalVersion++
  ref.version = globalVersion
  // 向 subscribers 傳播 dirty
}

function computedGetter(computed: ComputedRef) {
  if (computed.globalVersion !== globalVersion) {
    // 依賴項之一可能已更新
    if (checkDirty(computed)) {
      // 如果實際是 dirty 則重新計算
      computed.value = computed.getter()
    }
    computed.globalVersion = globalVersion
  }
  return computed.value
}
```

使用全域版本提供：
- 高效判斷 computed 是否真的需要重新計算
- 避免不必要的依賴遍歷

## chibivue 中的實現

chibivue 基於 alien-signals 演算法實現響應式系統．

主要檔案：
- `packages/reactivity/dep.ts` - 依賴管理
- `packages/reactivity/effect.ts` - effect 實現
- `packages/reactivity/ref.ts` - ref 實現
- `packages/reactivity/computed.ts` - computed 實現

基本結構：

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
    // 將 activeEffect 註冊為訂閱者
  }

  trigger(): void {
    // 通知所有訂閱者
  }
}
```

```ts
// packages/reactivity/effect.ts
export class ReactiveEffect<T = any> implements Subscriber {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined

  run(): T {
    // 執行 effect 函數並收集依賴
  }
}
```

後續章節將基於這個優化的響應式系統進行構建．

<KawaikoNote variant="base" title="繼續前進">

你理解 alien-signals 的概念了嗎？\
連結串列和版本管理一開始可能感覺很難，但隨著你編寫程式碼，自然會理解的．\
讓我們在下一章中基於這個優化的機制實現 ref 和 computed！

</KawaikoNote>

## 總結

- Vue 3.6 將引入基於 alien-signals 的優化響應式系統
- Push-Pull 演算法實現高效的 dirty 檢查和延遲評估
- 雙向連結串列的依賴管理提高記憶體效率
- 基於版本號的 dirty 檢查避免不必要的重新計算

從下一章開始，我們將在這個優化的響應式系統之上實現 ref 和 computed 等 API．

## 參考連結

- [stackblitz/alien-signals](https://github.com/stackblitz/alien-signals) - alien-signals 官方儲存庫
- [vuejs/core#12349](https://github.com/vuejs/core/pull/12349) - Vue 3.6 移植 PR
- [掌握 Vue 3.6 的 Alien Signals](https://medium.com/@revanthkumarpatha/mastering-vue-3-6s-alien-signals-practical-examples-and-use-cases-7df02a159d8a) - Medium 文章
