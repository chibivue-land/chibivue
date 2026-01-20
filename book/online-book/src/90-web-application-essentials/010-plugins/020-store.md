# Store

## What is a Store?

As applications grow larger, you often need to share state across multiple components. In the Vue.js ecosystem, Pinia provides this functionality.

In this chapter, we'll implement basic Pinia functionality as chibivue-store.

### Why Do We Need a Library?

If you just want to share state across components, exporting `ref` and `computed` at module scope is sufficient:

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";

export const count = ref(0);
export const doubleCount = computed(() => count.value * 2);
export const increment = () => count.value++;
```

This works fine for CSR (Client-Side Rendering). However, it causes serious problems in SSR (Server-Side Rendering).

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

In SSR, you must be aware of "**Cross-Request State Pollution**".

Since the server initializes modules only once, module-scoped state like above is **shared across all requests**.
This can lead to one user's state leaking to another user.

</KawaikoNote>

With a state management library like Pinia, simply calling `useXxxStore()` inside setup automatically handles per-request state isolation.

<KawaikoNote variant="info" title="If You're Using Nuxt">

If you're using Nuxt, it provides [useState](https://nuxt.com/docs/api/composables/use-state), an SSR-friendly composable for state management.
For simple state sharing, `useState` may be sufficient without introducing Pinia.

</KawaikoNote>

This chapter covers basic CSR usage through to SSR hydration.

For more details on SSR, see the [SSR chapter](/90-web-application-essentials/020-ssr/010-create-ssr-app).

## Package Structure

chibivue-store is provided in the `@extensions/chibivue-store` package.

```
@extensions/chibivue-store/src/
├── index.ts           # Exports
├── createStore.ts     # Root store creation
├── rootStore.ts       # Store interface and symbols
└── store.ts           # defineStore implementation
```

## Type Definitions

### StateTree

The type representing state held by a store.

```ts
// rootStore.ts
export type StateTree = Record<string | number | symbol, any>;
```

### Store Interface

Defines the public API of the root store.

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

- `install`: Installation method as a Vue plugin
- `use`: Method to add plugins
- `state`: Ref holding all store states (for SSR)
- `_p`: Installed plugins
- `_a`: App linked to this store
- `_e`: EffectScope the store is attached to
- `_s`: Map managing defined stores by ID

### StoreInstance Interface

Defines methods available on each store instance.

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

- `$id`: Store identifier
- `$state`: Store state (Options API style only)
- `$patch`: Batch state update
- `$reset`: Reset state to initial values (Options API style only)

## Dependency Injection Key

Defining a key for sharing the store via provide/inject.

```ts
// rootStore.ts
import type { InjectionKey } from "chibivue";

export const storeSymbol: InjectionKey<Store> = Symbol();
```

This symbol is used to provide the store created by `createStore()` throughout the app.

## createStore Implementation

A function that creates the root store.

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

Key points:
- `effectScope(true)` creates a detached scope to manage the store's lifecycle
- `state` is `ref({})`, centrally managing all store states (for SSR)
- `markRaw` prevents the store object itself from being made reactive
- The `install` method calls `app.provide` to make the store available app-wide

### Managing activeStore

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

`activeStore` is used when accessing stores from outside components (e.g., within other stores).

`getActiveStore` uses `hasInjectionContext()` to check the injection context and warns in SSR environments when no context is found. This alerts developers to the risk of Cross-Request State Pollution.

## defineStore Implementation

A function for defining individual stores. Like Pinia, it supports two definition styles.

### Composition API Style

```ts
// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;
```

Pass a `setup` function and define state using `ref` and `computed`.

### Options API Style

```ts
// Options API style
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(options: StoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;

// Options API style (id as first argument)
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

Define with an object containing `state`, `getters`, and `actions`.

### StoreOptions Interface

```ts
interface StoreOptions<Id extends string, S extends StateTree, G extends _GettersTree<S>, A> {
  id: Id;
  state?: () => S;
  getters?: G & ThisType<S & { [K in keyof G]: ReturnType<G[K]> }>;
  actions?: A & ThisType<S & A & { [K in keyof G]: ReturnType<G[K]> }>;
}
```

<KawaikoNote variant="funny" title="The Magic of ThisType">

Using `ThisType` allows proper type inference for `this` inside `getters` and `actions`.
For example, in `actions` you can access state via `this.count` and getters via `this.doubleCount`.

</KawaikoNote>

### useStore Function Implementation

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

Processing flow:
1. Get component instance with `getCurrentInstance()`
2. Get root store with `inject(storeSymbol)`
3. If store doesn't exist, create with `createSetupStore` or `createOptionsStore`
4. Return the created store

### createSetupStore (for Composition API)

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

<KawaikoNote variant="warning" title="$reset Limitation">

In Composition API style, `$reset` is not available because initial state is not preserved.
Use Options API style if you need `$reset`.

</KawaikoNote>

### createOptionsStore (for Options API)

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

  // Create getters as computed properties
  const computedGetters: Record<string, ComputedRef<unknown>> = {};
  if (getters) {
    for (const key in getters) {
      const getter = getters[key];
      computedGetters[key] = computed(() => getter.call(state, state));
    }
  }

  // Bind actions to state
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

Key points:
- `state` is made reactive with `reactive`
- `getters` are converted to `computed`
- `actions` are bound to access state and getters
- `$reset` re-executes the `state` function to restore initial values

## Usage Examples

### Composition API Style

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";
import { defineStore } from "chibivue-store";

export const useCounterStore = defineStore("counter", () => {
  // State
  const count = ref(0);

  // Getters (using computed)
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

### Options API Style

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
    // Use this to access other getters
    quadrupleCount() {
      return this.doubleCount * 2;
    },
  },

  actions: {
    increment() {
      this.count++;
    },
    // Async actions are also possible
    async incrementAsync() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.count++;
    },
  },
});
```

<KawaikoNote variant="funny" title="Which Style to Choose?">

- **Composition API style**: More flexible, same syntax as regular components
- **Options API style**: Clear structure, `$reset` available

Both provide equivalent functionality, choose based on your project's conventions.

</KawaikoNote>

### Registering with Application

```ts
// main.ts
import { createApp } from "chibivue";
import App from "./App.vue";
import { createStore } from "chibivue-store";

const app = createApp(App);
app.use(createStore());
app.mount("#app");
```

### Using in Components

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

## Using $patch

`$patch` allows updating multiple state properties at once.

### Object Form

```ts
const store = useCounterStore();

// Update multiple properties at once
store.$patch({
  count: 10,
});
```

### Function Form

```ts
const store = useCounterStore();

// Directly manipulate state
store.$patch((state) => {
  state.count += 5;
});
```

<KawaikoNote variant="warning" title="Benefits of $patch">

Batching multiple state changes with `$patch` triggers reactivity only once, improving performance.

</KawaikoNote>

## Using $reset

For stores defined with Options API style, `$reset` resets state to initial values.

```ts
const store = useCounterStore();

store.increment(); // count: 1
store.increment(); // count: 2

store.$reset(); // count: 0 (back to initial value)
```

## Processing Flow

```
app.use(createStore())
  ↓
store.install(app)
  ├── setActiveStore(store)
  └── app.provide(storeSymbol, store)
  ↓
Call useCounterStore() in component
  ↓
useStore()
  ├── inject(storeSymbol) to get store
  └── Check store._s.has("counter")
      ↓ (if not exists)
      createSetupStore() or createOptionsStore()
        ├── Execute setup() / state()
        ├── Convert getters to computed
        ├── Bind actions
        └── store._s.set("counter", result)
  ↓
Return store._s.get("counter")
  ↓
Use reactive state in component
```

## Multiple Stores

You can define and use multiple stores.

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

### Store Composition

You can use one store from within another.

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

<KawaikoNote variant="warning" title="Beware of Circular References">

If Store A uses Store B and Store B uses Store A, you'll create a circular reference.
In such cases, consider extracting common state into a separate store.

</KawaikoNote>

## SSR Support

chibivue-store supports Server-Side Rendering (SSR).

### store.state Property

The root store's `state` property allows you to serialize and hydrate all store states.

```ts
// Store interface
interface Store {
  install: (app: App) => void;
  state: Ref<Record<string, StateTree>>;  // Holds all store states
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

`state` is created as `ref({})`, and each store's state is saved in `state.value[storeId]`.
This enables:
- SSR: Serialize server-side state with `JSON.stringify(store.state.value)`
- Client hydration: Restore with `store.state.value = serverState`

### Server-Side: Serializing State

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createStore } from "chibivue-store";
import App from "./App.vue";

export async function render() {
  // Important: Create new instances for each request
  // This prevents Cross-Request State Pollution
  const store = createStore();
  const app = createApp(App);
  app.use(store);

  const html = await renderToString(app);

  // Serialize store state
  const storeState = JSON.stringify(store.state.value);

  return { html, storeState };
}
```

<KawaikoNote variant="warning" title="New Instance Per Request">

Note that `createStore()` and `createApp()` are called inside the `render()` function.
**You must not create them as singletons at module scope**.

```ts
// BAD: Creating at module scope is dangerous
const store = createStore();  // Shared across all requests!
const app = createApp(App);

export async function render() {
  // store and app are shared across all requests
}
```

</KawaikoNote>

### Embedding in HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // Embed serialized state from server
      window.__STORE_STATE__ = ${storeState};
    </script>
  </head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### Client-Side: Hydrating State

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createStore } from "chibivue-store";
import App from "./App.vue";

const store = createStore();
const app = createApp(App);
app.use(store);

// Hydrate with server state
if (window.__STORE_STATE__) {
  store.state.value = window.__STORE_STATE__;
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="Store Initialization Order">

Stores must be initialized before hydration.
Stores used by components (`useXxxStore()`) are automatically initialized during `app.mount()`.

If you need to hydrate before mounting, initialize the stores first:

```ts
// Initialize stores first
useCounterStore();
useUserStore();

// Then hydrate
store.state.value = window.__STORE_STATE__;

app.mount("#app");
```

</KawaikoNote>

### How state Works

In the new implementation, `state` is created as `ref({})` and stores state directly:

```ts
// createStore.ts
const state = scope.run(() => ref({}))!;
```

When each store is created, its state is saved to `store.state.value[id]`:

```ts
// store.ts (inside createSetupStore, createOptionsStore)
store.state.value[id] = stateFn ? stateFn() : {};
```

This design enables:
- SSR: Directly serialize `store.state.value` with `JSON.stringify`
- Hydration: Directly restore with `store.state.value = serverState`
- Each store's setup/state function uses existing `state.value[id]` if present (for hydration)

<KawaikoNote variant="surprise" title="SSR Ready!">

chibivue-store now supports SSR.
By transferring state computed on the server to the client, you can maintain consistent state after hydration.

</KawaikoNote>

## Future Extensions

The current implementation covers basic functionality, but Pinia also has:

1. **$subscribe**: Subscribe to state changes
2. **$onAction**: Monitor action execution
3. **Plugin System**: Extend store functionality
4. **Devtools Integration**: State visualization and time-travel debugging
5. **mapState / mapActions**: Helpers for Options API components

<KawaikoNote variant="surprise" title="Implementation Complete!">

We've completed a Pinia-like store.
With about 150 lines of code, we've achieved state management.
This should be a good starting point for understanding how Pinia works.

</KawaikoNote>

## Summary

The chibivue-store implementation consists of:

1. **Root Store Creation**: Install as Vue plugin with `createStore`
2. **Dependency Injection**: Share store throughout component tree via `provide/inject`
3. **Two Definition Styles**: Support both Composition API and Options API
4. **Getters**: Define derived state using `computed`
5. **Actions**: Methods with access to state and getters
6. **$patch**: Batch state updates
7. **$reset**: Reset state to initial values (Options API only)
8. **Singleton Pattern**: Each store ID creates only one instance
9. **SSR Support**: Serialize and hydrate state via `store.state`

By combining Vue's plugin system, provide/inject, and reactivity system, we've achieved global state management.
