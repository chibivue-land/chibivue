# Store

## 什麼是 Store？

隨著應用程式變得越來越大，您通常需要在多個組件之間共享狀態．在 Vue.js 生態系統中，Pinia 提供了這個功能．

在本章中，我們將實現 Pinia 的基本功能作為 chibivue-store．

### 為什麼需要函式庫？

如果您只是想在組件之間共享狀態，在模組作用域導出 `ref` 和 `computed` 就足夠了：

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";

export const count = ref(0);
export const doubleCount = computed(() => count.value * 2);
export const increment = () => count.value++;
```

這在 CSR（客戶端渲染）中沒有問題．但是，在 SSR（伺服器端渲染）中會導致嚴重的問題．

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

在 SSR 中，您必須注意「**Cross-Request State Pollution**（跨請求狀態污染）」．

由於伺服器只初始化模組一次，上述模組作用域的狀態會**在所有請求之間共享**．
這可能導致一個使用者的狀態洩漏給另一個使用者．

</KawaikoNote>

使用像 Pinia 這樣的狀態管理函式庫，只需在 setup 中呼叫 `useXxxStore()`，函式庫就會自動處理每個請求的狀態隔離．

<KawaikoNote variant="info" title="如果您使用 Nuxt">

如果您使用 Nuxt，它提供了 [useState](https://nuxt.com/docs/api/composables/use-state)，一個 SSR 友好的狀態管理組合式函式．
對於簡單的狀態共享，`useState` 可能足夠，無需引入 Pinia．

</KawaikoNote>

本章涵蓋從基本的 CSR 使用到 SSR 水合．

有關 SSR 的更多詳細資訊，請參閱 [SSR 章節](/zh-tw/90-web-application-essentials/020-ssr/010-create-ssr-app)．

## 套件結構

chibivue-store 在 `@extensions/chibivue-store` 套件中提供．

```
@extensions/chibivue-store/src/
├── index.ts           # 導出
├── createStore.ts     # 根 store 創建
├── rootStore.ts       # Store 介面和符號
└── store.ts           # defineStore 實現
```

## 類型定義

### StateTree

表示 store 持有的狀態的類型．

```ts
// rootStore.ts
export type StateTree = Record<string | number | symbol, any>;
```

### Store 介面

定義根 store 的公共 API．

```ts
// rootStore.ts
export interface Store {
  install: (app: App) => void;
  use(plugin: StorePlugin): Store;
  state: Ref<Record<string, StateTree>>;
  _p: StorePlugin[];
  _a: App | null;
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

- `install`: 作為 Vue 插件的安裝方法
- `use`: 添加插件的方法
- `state`: 保存所有 store 狀態的 ref（用於 SSR）
- `_p`: 已安裝的插件
- `_a`: 連結到此 store 的 App
- `_e`: store 附加的 EffectScope
- `_s`: 按 ID 管理已定義 store 的 Map

### StoreInstance 介面

定義每個 store 實例可用的方法．

```ts
// store.ts
export interface StoreInstance<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A = Record<string, (...args: any[]) => any>,
> {
  $id: Id;
  $state: S;
  $patch: (partialState: Partial<S> | ((state: S) => void)) => void;
  $reset: () => void;
}
```

- `$id`: Store 識別符
- `$state`: Store 狀態（僅 Options API 風格）
- `$patch`: 批量狀態更新
- `$reset`: 重置狀態為初始值（僅 Options API 風格）

## 依賴注入鍵

定義通過 provide/inject 共享 store 的鍵．

```ts
// rootStore.ts
import type { InjectionKey } from "chibivue";

export const storeSymbol: InjectionKey<Store> = Symbol();
```

此符號用於在整個應用程式中 provide 由 `createStore()` 創建的 store．

## createStore 實現

創建根 store 的函式．

```ts
// createStore.ts
import { effectScope, markRaw, ref } from "chibivue";
import { type Store, setActiveStore, storeSymbol } from "./rootStore";

export function createStore(): Store {
  const scope = effectScope(true);

  const state = scope.run(() => ref({}))!;

  let _p: StorePlugin[] = [];
  let toBeInstalled: StorePlugin[] = [];

  const store: Store = markRaw({
    install(app) {
      setActiveStore(store);
      store._a = app;
      app.provide(storeSymbol, store);
      toBeInstalled.forEach((plugin) => _p.push(plugin));
      toBeInstalled = [];
    },

    use(plugin) {
      if (!this._a) {
        toBeInstalled.push(plugin);
      } else {
        _p.push(plugin);
      }
      return this;
    },

    _p,
    _a: null,
    _e: scope,
    _s: new Map(),
    state,
  });

  return store;
}
```

關鍵點：
- `effectScope(true)` 創建 detached scope，管理 store 的生命週期
- `state` 是 `ref({})`，集中管理所有 store 的狀態（用於 SSR）
- `markRaw` 使 store 對象本身不被響應式化
- `install` 方法呼叫 `app.provide` 使 store 在整個應用程式中可用

### 管理 activeStore

```ts
// rootStore.ts
export let activeStore: Store | undefined;
export const setActiveStore = (store: Store | undefined): Store | undefined =>
  (activeStore = store);

export const getActiveStore = (): Store | undefined => {
  const store = hasInjectionContext() && inject(storeSymbol, null);

  if (__DEV__ && !store && typeof window === "undefined") {
    console.warn(
      `[chibivue-store]: Store instance not found in context. ` +
      `This falls back to the global activeStore which exposes you to ` +
      `cross-request state pollution on the server.`,
    );
  }

  return store || activeStore;
};
```

`activeStore` 用於從組件外部存取 store（例如，在其他 store 內部）．

`getActiveStore` 使用 `hasInjectionContext()` 確認 injection context，在 SSR 環境中如果沒有 context 則發出警告．這可以讓開發者了解 Cross-Request State Pollution 的風險．

## defineStore 實現

定義單個 store 的函式．與 Pinia 一樣，它支援兩種定義風格．

### Composition API 風格

```ts
// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;
```

傳遞 `setup` 函式並使用 `ref` 和 `computed` 定義狀態．

### Options API 風格

```ts
// Options API style
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(options: StoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;
```

使用包含 `state`，`getters` 和 `actions` 的物件定義．

## 使用範例

### Composition API 風格

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";
import { defineStore } from "chibivue-store";

export const useCounterStore = defineStore("counter", () => {
  // State
  const count = ref(0);

  // Getters（使用 computed）
  const doubleCount = computed(() => count.value * 2);

  // Actions
  const increment = () => {
    count.value++;
  };

  const reset = () => {
    count.value = 0;
  };

  return {
    count,
    doubleCount,
    increment,
    reset,
  };
});
```

### Options API 風格

```ts
// stores/counter.ts
import { defineStore } from "chibivue-store";

export const useCounterStore = defineStore("counter", {
  state: () => ({
    count: 0,
  }),

  getters: {
    doubleCount(state) {
      return state.count * 2;
    },
  },

  actions: {
    increment() {
      this.count++;
    },
  },
});
```

### 在應用程式中註冊

```ts
// main.ts
import { createApp } from "chibivue";
import App from "./App.vue";
import { createStore } from "chibivue-store";

const app = createApp(App);
app.use(createStore());
app.mount("#app");
```

### 在組件中使用

```vue
<!-- Counter.vue -->
<script setup>
import { useCounterStore } from "../stores/counter";

const counterStore = useCounterStore();
</script>

<template>
  <div>
    <p>Count: {{ counterStore.count }}</p>
    <p>Double: {{ counterStore.doubleCount }}</p>
    <button @click="counterStore.increment">Increment</button>
  </div>
</template>
```

## 使用 $patch

`$patch` 允許一次更新多個狀態屬性．

### 物件形式

```ts
const store = useCounterStore();

store.$patch({
  count: 10,
});
```

### 函式形式

```ts
const store = useCounterStore();

store.$patch((state) => {
  state.count += 5;
});
```

## 使用 $reset

對於使用 Options API 風格定義的 store，`$reset` 將狀態重置為初始值．

```ts
const store = useCounterStore();

store.increment(); // count: 1
store.increment(); // count: 2

store.$reset(); // count: 0（回到初始值）
```

## SSR 支援

chibivue-store 支援伺服器端渲染（SSR）．

### store.state 屬性

根 store 的 `state` 屬性允許您序列化和水合所有 store 狀態．

```ts
// Store interface
interface Store {
  install: (app: App) => void;
  state: Ref<Record<string, StateTree>>;  // 保存所有 store 的狀態
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

`state` 作為 `ref({})` 創建，每個 store 的狀態保存在 `state.value[storeId]` 中．
這樣可以：
- SSR 序列化伺服器端狀態: `JSON.stringify(store.state.value)`
- 客戶端水合: `store.state.value = serverState`

### 伺服器端：序列化狀態

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createStore } from "chibivue-store";
import App from "./App.vue";

export async function render() {
  // 重要：為每個請求創建新實例
  // 這可以防止 Cross-Request State Pollution
  const store = createStore();
  const app = createApp(App);
  app.use(store);

  const html = await renderToString(app);

  // 序列化 store 狀態
  const storeState = JSON.stringify(store.state.value);

  return { html, storeState };
}
```

<KawaikoNote variant="warning" title="每個請求新實例">

注意 `createStore()` 和 `createApp()` 是在 `render()` 函式內部呼叫的．
**您不能在模組作用域創建它們作為單例**．

```ts
// 錯誤：在模組作用域創建是危險的
const store = createStore();  // 在所有請求之間共享！
const app = createApp(App);

export async function render() {
  // store 和 app 在所有請求之間共享
}
```

</KawaikoNote>

### 嵌入 HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.__STORE_STATE__ = ${storeState};
    </script>
  </head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 客戶端：水合狀態

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createStore } from "chibivue-store";
import App from "./App.vue";

const store = createStore();
const app = createApp(App);
app.use(store);

// 使用伺服器狀態水合
if (window.__STORE_STATE__) {
  store.state.value = window.__STORE_STATE__;
}

app.mount("#app");
```

<KawaikoNote variant="surprise" title="SSR Ready!">

chibivue-store 現在支援 SSR．
通過將伺服器計算的狀態傳輸到客戶端，您可以在水合後保持一致的狀態．

</KawaikoNote>

## 未來擴展

當前實現涵蓋了基本功能，但 Pinia 還有：

1. **$subscribe**: 訂閱狀態變更
2. **$onAction**: 監控 action 執行
3. **插件系統**: 擴展 store 功能
4. **Devtools 整合**: 狀態視覺化和時間旅行除錯
5. **mapState / mapActions**: Options API 組件的輔助函式

## 總結

chibivue-store 實現包括：

1. **根 Store 創建**: 使用 `createStore` 作為 Vue 插件安裝
2. **依賴注入**: 通過 `provide/inject` 在組件樹中共享 store
3. **兩種定義風格**: 支援 Composition API 和 Options API
4. **Getters**: 使用 `computed` 定義派生狀態
5. **Actions**: 可以存取 state 和 getters 的方法
6. **$patch**: 批量狀態更新
7. **$reset**: 重置狀態為初始值（僅 Options API）
8. **單例模式**: 每個 store ID 只創建一個實例
9. **SSR 支援**: 通過 `store.state` 序列化和水合狀態

通過結合 Vue 的插件系統，provide/inject 和響應式系統，我們實現了全域狀態管理．
