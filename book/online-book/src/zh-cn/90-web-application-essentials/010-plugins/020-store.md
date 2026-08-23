# Store

## 什么是 Store？

随着应用程序变得越来越大，您通常需要在多个组件之间共享状态。在 Vue.js 生态系统中，Pinia 提供了这个功能。

在本章中，我们将实现 Pinia 的基本功能作为 chibivue-store。

### 为什么需要库？

如果您只是想在组件之间共享状态，在模块作用域导出 `ref` 和 `computed` 就足够了：

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";

export const count = ref(0);
export const doubleCount = computed(() => count.value * 2);
export const increment = () => count.value++;
```

这在 CSR（客户端渲染）中没有问题。但是，在 SSR（服务器端渲染）中会导致严重的问题。

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

在 SSR 中，您必须注意"**Cross-Request State Pollution**（跨请求状态污染）"。

由于服务器只初始化模块一次，上述模块作用域的状态会**在所有请求之间共享**。
这可能导致一个用户的状态泄漏给另一个用户。

</KawaikoNote>

使用像 Pinia 这样的状态管理库，只需在 setup 中调用 `useXxxStore()`，库就会自动处理每个请求的状态隔离。

<KawaikoNote variant="info" title="如果您使用 Nuxt">

如果您使用 Nuxt，它提供了 [useState](https://nuxt.com/docs/api/composables/use-state)，一个 SSR 友好的状态管理组合式函数。
对于简单的状态共享，`useState` 可能足够，无需引入 Pinia。

</KawaikoNote>

本章涵盖从基本的 CSR 使用到 SSR 水合。

有关 SSR 的更多详细信息，请参阅 [SSR 章节](/zh-cn/90-web-application-essentials/020-ssr/010-create-ssr-app)。

## 包结构

chibivue-store 在 `@extensions/chibivue-store` 包中提供。

```
@extensions/chibivue-store/src/
├── index.ts           # 导出
├── createStore.ts     # 根 store 创建
├── rootStore.ts       # Store 接口和符号
└── store.ts           # defineStore 实现
```

## 类型定义

### StateTree

表示 store 持有的状态的类型。

```ts
// rootStore.ts
export type StateTree = Record<string | number | symbol, any>;
```

### Store 接口

定义根 store 的公共 API。

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

定义每个 store 实例可用的方法。

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

定义通过 provide/inject 共享 store 的键。

```ts
// rootStore.ts
import type { InjectionKey } from "chibivue";

export const storeSymbol: InjectionKey<Store> = Symbol();
```

此符号用于在整个应用程序中 provide 由 `createStore()` 创建的 store。

## createStore 实现

创建根 store 的函数。

```ts
// createStore.ts
import { effectScope, markRaw, ref } from "chibivue";
import { type Store, setActiveStore, storeSymbol } from "./rootStore";

export function createStore(): Store {
  const scope = effectScope();

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
- `effectScope()` 创建 detached scope，管理 store 的生命周期
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

`activeStore` 用于从组件外部访问 store（例如，在其他 store 内部）。

`getActiveStore` 使用 `hasInjectionContext()` 确认 injection context，在 SSR 环境中如果没有 context 则发出警告。这可以让开发者了解 Cross-Request State Pollution 的风险。

## defineStore 实现

定义单个 store 的函数。与 Pinia 一样，它支持两种定义风格。

### Composition API 风格

```ts
// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;
```

传递 `setup` 函数并使用 `ref` 和 `computed` 定义状态。

### Options API 风格

```ts
// Options API style
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(options: StoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;

// Options API 风格（将 id 作为第一个参数）
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(
  id: Id,
  options: Omit<StoreOptions<Id, S, G, A>, "id">,
): StoreDefinition<Id, S, G, A>;
```

使用包含 `state`，`getters` 和 `actions` 的对象定义。

### StoreOptions 接口

```ts
interface StoreOptions<Id extends string, S extends StateTree, G extends _GettersTree<S>, A> {
  id: Id;
  state?: () => S;
  getters?: G & ThisType<S & { [K in keyof G]: ReturnType<G[K]> }>;
  actions?: A & ThisType<S & A & { [K in keyof G]: ReturnType<G[K]> }>;
}
```

<KawaikoNote variant="funny" title="ThisType 的妙用">

借助 `ThisType`，`getters` 和 `actions` 内部的 `this` 可以得到正确的类型推断。例如，在 `actions` 中可以通过 `this.count` 访问状态，通过 `this.doubleCount` 访问 getter。

</KawaikoNote>

### useStore 函数的实现

```ts
function useStore(outerStore?: Store | null) {
  const currentInstance = getCurrentInstance();
  let store = currentInstance && inject(storeSymbol);
  if (store) setActiveStore(store);
  store = outerStore ?? activeStore!;

  if (!store._s.has(id)) {
    if (setup) {
      createSetupStore(id, setup, store);
    } else if (options) {
      createOptionsStore(id, options, store);
    }
  }

  const _store = store!._s.get(id)!;
  return _store;
}
```

处理流程如下：

1. 使用 `getCurrentInstance()` 获取组件实例
2. 使用 `inject(storeSymbol)` 获取根 store
3. 如果 store 尚不存在，则通过 `createSetupStore` 或 `createOptionsStore` 创建
4. 返回创建好的 store

### createSetupStore（用于 Composition API）

```ts
function createSetupStore<Id extends string>(id: Id, setup: () => StateTree, store: Store) {
  const setupStore = setup();

  const _store = reactive({
    $id: id,
    ...setupStore,
    $patch(partialState: Partial<StateTree> | ((state: StateTree) => void)) {
      if (typeof partialState === "function") {
        partialState(setupStore);
      } else {
        for (const key in partialState) {
          const value = setupStore[key];
          if (isRef(value)) {
            value.value = partialState[key];
          } else {
            setupStore[key] = partialState[key];
          }
        }
      }
    },
    $reset() {
      console.warn(`[$reset] is not available in setup stores.`);
    },
  });

  store._s.set(id, _store);
}
```

<KawaikoNote variant="warning" title="$reset 的限制">

Composition API 风格不会保留初始状态，因此无法使用 `$reset`。如果需要 `$reset`，请使用 Options API 风格。

</KawaikoNote>

### createOptionsStore（用于 Options API）

```ts
function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(id: Id, options: Omit<StoreOptions<Id, S, G, A>, "id">, store: Store) {
  const { state: stateFn, getters, actions } = options;

  const initialState = stateFn ? stateFn() : ({} as S);
  const state = reactive({ ...initialState }) as S;

  // 将 getters 创建为 computed 属性
  const computedGetters: Record<string, ComputedRef<unknown>> = {};
  if (getters) {
    for (const key in getters) {
      const getter = getters[key];
      computedGetters[key] = computed(() => getter.call(state, state));
    }
  }

  // 将 actions 绑定到 state
  const boundActions: Record<string, (...args: any[]) => any> = {};
  if (actions) {
    for (const key in actions) {
      const action = actions[key];
      boundActions[key] = function (this: any, ...args: any[]) {
        return action.apply(
          { ...state, ...computedGetters, ...boundActions },
          args,
        );
      };
    }
  }

  const _store = reactive({
    $id: id,
    $state: state,
    ...state,
    ...computedGetters,
    ...boundActions,
    $patch(partialState: Partial<S> | ((state: S) => void)) { /* ... */ },
    $reset() {
      const newState = stateFn ? stateFn() : ({} as S);
      for (const key in newState) {
        (state as any)[key] = newState[key];
      }
    },
  });

  store._s.set(id, _store);
}
```

要点如下：

- 使用 `reactive` 使 `state` 具有响应性
- 将 `getters` 转换为 `computed`
- 绑定 `actions`，使其能够访问 state 和 getters
- `$reset` 通过重新执行 `state` 函数恢复初始值

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

<KawaikoNote variant="funny" title="该选择哪种风格？">

- **Composition API 风格**：更加灵活，语法与普通组件一致
- **Options API 风格**：结构清晰，并且可以使用 `$reset`

两者提供的功能相同，请根据项目约定选择。

</KawaikoNote>

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

`$patch` 允许一次更新多个状态属性。

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

<KawaikoNote variant="warning" title="$patch 的优点">

通过 `$patch` 批量处理多个状态变更时，只会触发一次响应式更新，从而提升性能。

</KawaikoNote>

## 使用 $reset

对于使用 Options API 风格定义的 store，`$reset` 将状态重置为初始值。

```ts
const store = useCounterStore();

store.increment(); // count: 1
store.increment(); // count: 2

store.$reset(); // count: 0（回到初始值）
```

## 处理流程

```txt
app.use(createStore())
  ↓
store.install(app)
  ├── setActiveStore(store)
  └── app.provide(storeSymbol, store)
  ↓
在组件中调用 useCounterStore()
  ↓
useStore()
  ├── 通过 inject(storeSymbol) 获取 store
  └── 检查 store._s.has("counter")
      ↓（如果不存在）
      createSetupStore() 或 createOptionsStore()
        ├── 执行 setup() / state()
        ├── 将 getters 转换为 computed
        ├── 绑定 actions
        └── store._s.set("counter", result)
  ↓
返回 store._s.get("counter")
  ↓
在组件中使用响应式状态
```

## 多个 Store

可以定义并使用多个 store。

```ts
// stores/user.ts
import { defineStore } from "chibivue-store";

export const useUserStore = defineStore("user", {
  state: () => ({
    name: "",
    isLoggedIn: false,
  }),

  actions: {
    login(userName: string) {
      this.name = userName;
      this.isLoggedIn = true;
    },
    logout() {
      this.$reset();
    },
  },
});
```

```ts
// stores/cart.ts
import { defineStore } from "chibivue-store";

export const useCartStore = defineStore("cart", {
  state: () => ({
    items: [] as { id: number; name: string; price: number }[],
  }),

  getters: {
    total(state) {
      return state.items.reduce((sum, item) => sum + item.price, 0);
    },
    itemCount(state) {
      return state.items.length;
    },
  },

  actions: {
    addItem(item: { id: number; name: string; price: number }) {
      this.items.push(item);
    },
    clearCart() {
      this.$reset();
    },
  },
});
```

### Store 组合

一个 store 可以在内部使用另一个 store。

```ts
// stores/checkout.ts
import { defineStore } from "chibivue-store";
import { useUserStore } from "./user";
import { useCartStore } from "./cart";

export const useCheckoutStore = defineStore("checkout", {
  actions: {
    checkout() {
      const userStore = useUserStore();
      const cartStore = useCartStore();

      if (!userStore.isLoggedIn) {
        throw new Error("Please login first");
      }

      console.log(`${userStore.name} purchased ${cartStore.itemCount} items`);
      console.log(`Total: ${cartStore.total}`);

      cartStore.clearCart();
    },
  },
});
```

<KawaikoNote variant="warning" title="注意循环引用">

如果 Store A 使用 Store B，而 Store B 又使用 Store A，就会产生循环引用。这种情况下，可以考虑将公共状态提取到单独的 store 中。

</KawaikoNote>

## SSR 支持

chibivue-store 支持服务器端渲染（SSR）。

### store.state 属性

根 store 的 `state` 属性允许您序列化和水合所有 store 状态。

```ts
// Store interface
interface Store {
  install: (app: App) => void;
  state: Ref<Record<string, StateTree>>;  // 保存所有 store 的状态
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

`state` 作为 `ref({})` 创建，每个 store 的状态保存在 `state.value[storeId]` 中。
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

注意 `createStore()` 和 `createApp()` 是在 `render()` 函数内部调用的。
**您不能在模块作用域创建它们作为单例**。

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

<KawaikoNote variant="warning" title="Store 的初始化顺序">

水合之前必须先初始化 store。组件使用的 store（`useXxxStore()`）会在 `app.mount()` 期间自动初始化。

如果需要在挂载前水合，请先初始化这些 store：

```ts
// 先初始化 store
useCounterStore();
useUserStore();

// 然后进行水合
store.state.value = window.__STORE_STATE__;

app.mount("#app");
```

</KawaikoNote>

### state 的工作原理

在新的实现中，`state` 通过 `ref({})` 创建并直接保存各个 store 的状态：

```ts
// createStore.ts
const state = scope.run(() => ref({}))!;
```

创建每个 store 时，其状态都会保存到 `store.state.value[id]`：

```ts
// store.ts（createSetupStore、createOptionsStore 内部）
store.state.value[id] = stateFn ? stateFn() : {};
```

这一设计可以实现：

- SSR：使用 `JSON.stringify` 直接序列化 `store.state.value`
- 水合：通过 `store.state.value = serverState` 直接恢复
- 如果已经存在 `state.value[id]`，各个 store 的 setup/state 函数会复用它，以支持水合

<KawaikoNote variant="surprise" title="SSR Ready!">

chibivue-store 现在支持 SSR。
通过将服务器计算的状态传输到客户端，您可以在水合后保持一致的状态。

</KawaikoNote>

## 未来扩展

当前实现涵盖了基本功能，但 Pinia 还有：

1. **$subscribe**: 订阅状态变更
2. **$onAction**: 监控 action 执行
3. **插件系统**: 扩展 store 功能
4. **Devtools 集成**: 状态可视化和时间旅行调试
5. **mapState / mapActions**: Options API 组件的辅助函数

<KawaikoNote variant="surprise" title="实现完成！">

我们已经完成了一个类似 Pinia 的 store。大约 150 行代码便实现了状态管理，也为理解 Pinia 的工作原理提供了良好的起点。

</KawaikoNote>

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

通过结合 Vue 的插件系统，provide/inject 和响应式系统，我们实现了全局状态管理。
