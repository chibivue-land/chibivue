# Store

## 什么是 Store？

随着应用程序变得越来越大，您通常需要在多个组件之间共享状态．在 Vue.js 生态系统中，Pinia 提供了这个功能．

在本章中，我们将实现 Pinia 的基本功能作为 chibivue-store．

### 为什么需要库？

如果您只是想在组件之间共享状态，在模块作用域导出 `ref` 和 `computed` 就足够了：

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";

export const count = ref(0);
export const doubleCount = computed(() => count.value * 2);
export const increment = () => count.value++;
```

这在 CSR（客户端渲染）中没有问题．但是，在 SSR（服务器端渲染）中会导致严重的问题．

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

在 SSR 中，您必须注意"**Cross-Request State Pollution**（跨请求状态污染）"．

由于服务器只初始化模块一次，上述模块作用域的状态会**在所有请求之间共享**．
这可能导致一个用户的状态泄漏给另一个用户．

</KawaikoNote>

使用像 Pinia 这样的状态管理库，只需在 setup 中调用 `useXxxStore()`，库就会自动处理每个请求的状态隔离．

<KawaikoNote variant="info" title="如果您使用 Nuxt">

如果您使用 Nuxt，它提供了 [useState](https://nuxt.com/docs/api/composables/use-state)，一个 SSR 友好的状态管理组合式函数．
对于简单的状态共享，`useState` 可能足够，无需引入 Pinia．

</KawaikoNote>

本章涵盖从基本的 CSR 使用到 SSR 水合．

有关 SSR 的更多详细信息，请参阅 [SSR 章节](/zh-cn/90-web-application-essentials/020-ssr/010-create-ssr-app)．

## 包结构

chibivue-store 在 `@extensions/chibivue-store` 包中提供．

```
@extensions/chibivue-store/src/
├── index.ts           # 导出
├── createStore.ts     # 根 store 创建
├── rootStore.ts       # Store 接口和符号
└── store.ts           # defineStore 实现
```

## 类型定义

### StateTree

表示 store 持有的状态的类型．

```ts
// rootStore.ts
export type StateTree = Record<string | number | symbol, any>;
```

### Store 接口

定义根 store 的公共 API．

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

- `install`: 作为 Vue 插件的安装方法
- `use`: 添加插件的方法
- `state`: 保存所有 store 状态的 ref（用于 SSR）
- `_p`: 已安装的插件
- `_a`: 链接到此 store 的 App
- `_e`: store 附加的 EffectScope
- `_s`: 按 ID 管理已定义 store 的 Map

### StoreInstance 接口

定义每个 store 实例可用的方法．

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

- `$id`: Store 标识符
- `$state`: Store 状态（仅 Options API 风格）
- `$patch`: 批量状态更新
- `$reset`: 重置状态为初始值（仅 Options API 风格）

## 依赖注入键

定义通过 provide/inject 共享 store 的键．

```ts
// rootStore.ts
import type { InjectionKey } from "chibivue";

export const storeSymbol: InjectionKey<Store> = Symbol();
```

此符号用于在整个应用程序中 provide 由 `createStore()` 创建的 store．

## createStore 实现

创建根 store 的函数．

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

关键点：
- `effectScope(true)` 创建 detached scope，管理 store 的生命周期
- `state` 是 `ref({})`，集中管理所有 store 的状态（用于 SSR）
- `markRaw` 使 store 对象本身不被响应式化
- `install` 方法调用 `app.provide` 使 store 在整个应用程序中可用

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

`activeStore` 用于从组件外部访问 store（例如，在其他 store 内部）．

`getActiveStore` 使用 `hasInjectionContext()` 确认 injection context，在 SSR 环境中如果没有 context 则发出警告．这可以让开发者了解 Cross-Request State Pollution 的风险．

## defineStore 实现

定义单个 store 的函数．与 Pinia 一样，它支持两种定义风格．

### Composition API 风格

```ts
// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;
```

传递 `setup` 函数并使用 `ref` 和 `computed` 定义状态．

### Options API 风格

```ts
// Options API style
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(options: StoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;
```

使用包含 `state`，`getters` 和 `actions` 的对象定义．

## 使用示例

### Composition API 风格

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

### Options API 风格

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

### 在应用程序中注册

```ts
// main.ts
import { createApp } from "chibivue";
import App from "./App.vue";
import { createStore } from "chibivue-store";

const app = createApp(App);
app.use(createStore());
app.mount("#app");
```

### 在组件中使用

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

`$patch` 允许一次更新多个状态属性．

### 对象形式

```ts
const store = useCounterStore();

store.$patch({
  count: 10,
});
```

### 函数形式

```ts
const store = useCounterStore();

store.$patch((state) => {
  state.count += 5;
});
```

## 使用 $reset

对于使用 Options API 风格定义的 store，`$reset` 将状态重置为初始值．

```ts
const store = useCounterStore();

store.increment(); // count: 1
store.increment(); // count: 2

store.$reset(); // count: 0（回到初始值）
```

## SSR 支持

chibivue-store 支持服务器端渲染（SSR）．

### store.state 属性

根 store 的 `state` 属性允许您序列化和水合所有 store 状态．

```ts
// Store interface
interface Store {
  install: (app: App) => void;
  state: Ref<Record<string, StateTree>>;  // 保存所有 store 的状态
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

`state` 作为 `ref({})` 创建，每个 store 的状态保存在 `state.value[storeId]` 中．
这样可以：
- SSR 序列化服务器端状态: `JSON.stringify(store.state.value)`
- 客户端水合: `store.state.value = serverState`

### 服务器端：序列化状态

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createStore } from "chibivue-store";
import App from "./App.vue";

export async function render() {
  // 重要：为每个请求创建新实例
  // 这可以防止 Cross-Request State Pollution
  const store = createStore();
  const app = createApp(App);
  app.use(store);

  const html = await renderToString(app);

  // 序列化 store 状态
  const storeState = JSON.stringify(store.state.value);

  return { html, storeState };
}
```

<KawaikoNote variant="warning" title="每个请求新实例">

注意 `createStore()` 和 `createApp()` 是在 `render()` 函数内部调用的．
**您不能在模块作用域创建它们作为单例**．

```ts
// 错误：在模块作用域创建是危险的
const store = createStore();  // 在所有请求之间共享！
const app = createApp(App);

export async function render() {
  // store 和 app 在所有请求之间共享
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

### 客户端：水合状态

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createStore } from "chibivue-store";
import App from "./App.vue";

const store = createStore();
const app = createApp(App);
app.use(store);

// 使用服务器状态水合
if (window.__STORE_STATE__) {
  store.state.value = window.__STORE_STATE__;
}

app.mount("#app");
```

<KawaikoNote variant="surprise" title="SSR Ready!">

chibivue-store 现在支持 SSR．
通过将服务器计算的状态传输到客户端，您可以在水合后保持一致的状态．

</KawaikoNote>

## 未来扩展

当前实现涵盖了基本功能，但 Pinia 还有：

1. **$subscribe**: 订阅状态变更
2. **$onAction**: 监控 action 执行
3. **插件系统**: 扩展 store 功能
4. **Devtools 集成**: 状态可视化和时间旅行调试
5. **mapState / mapActions**: Options API 组件的辅助函数

## 总结

chibivue-store 实现包括：

1. **根 Store 创建**: 使用 `createStore` 作为 Vue 插件安装
2. **依赖注入**: 通过 `provide/inject` 在组件树中共享 store
3. **两种定义风格**: 支持 Composition API 和 Options API
4. **Getters**: 使用 `computed` 定义派生状态
5. **Actions**: 可以访问 state 和 getters 的方法
6. **$patch**: 批量状态更新
7. **$reset**: 重置状态为初始值（仅 Options API）
8. **单例模式**: 每个 store ID 只创建一个实例
9. **SSR 支持**: 通过 `store.state` 序列化和水合状态

通过结合 Vue 的插件系统，provide/inject 和响应式系统，我们实现了全局状态管理．
