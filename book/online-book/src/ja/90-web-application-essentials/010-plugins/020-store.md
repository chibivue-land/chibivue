# Store

## ストアとは

アプリケーションが大きくなると，複数のコンポーネント間で状態を共有する必要が出てきます．Vue.js のエコシステムでは，Pinia がこの機能を提供しています．

この章では，Pinia の基本的な機能を chibivue-store として実装します．

### なぜライブラリが必要なのか

複数のコンポーネント間で状態を共有するだけなら，モジュールスコープで `ref` や `computed` をエクスポートすれば十分です：

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";

export const count = ref(0);
export const doubleCount = computed(() => count.value * 2);
export const increment = () => count.value++;
```

CSR（Client-Side Rendering）ではこれで問題ありません．しかし，SSR（Server-Side Rendering）では重大な問題が発生します．

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

SSR では「**Cross-Request State Pollution**（リクエスト間状態汚染）」に注意が必要です．

サーバーはモジュールを一度だけ初期化するため，上記のようなモジュールスコープの状態は**すべてのリクエスト間で共有**されてしまいます．
これにより，あるユーザーの状態が別のユーザーに漏洩する危険性があります．

</KawaikoNote>

Pinia のような状態管理ライブラリを使うと，setup 内で `useXxxStore()` を呼ぶだけで，ライブラリが自動的にリクエストごとの状態分離を行ってくれます．

<KawaikoNote variant="info" title="Nuxt を使っている場合">

Nuxt を使っている場合は，[useState](https://nuxt.com/docs/api/composables/use-state) という SSR フレンドリーな状態管理のコンポーザブルが提供されています．
シンプルな状態共有であれば，Pinia を導入せずに `useState` で十分な場合もあります．

</KawaikoNote>

この章では，CSR での基本的な使い方から，SSR でのハイドレーションまでを説明します．

SSR の詳細については [SSR の章](/ja/90-web-application-essentials/020-ssr/010-create-ssr-app) を参照してください．

## パッケージ構成

chibivue-store は `@extensions/chibivue-store` パッケージで提供されています．

```
@extensions/chibivue-store/src/
├── index.ts           # エクスポート
├── createStore.ts     # ルートストアの作成
├── rootStore.ts       # ストアのインターフェースとシンボル
└── store.ts           # defineStore の実装
```

## 型定義

### StateTree

ストアが保持する状態の型です．

```ts
// rootStore.ts
export type StateTree = Record<string | number | symbol, any>;
```

### Store インターフェース

ルートストアの公開 API を定義します．

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

- `install`: Vue プラグインとしてのインストールメソッド
- `use`: プラグインを追加するメソッド
- `state`: すべてのストアの状態を保持する ref（SSR 用）
- `_p`: インストールされたプラグイン
- `_a`: このストアにリンクされた App
- `_e`: ストアがアタッチされた EffectScope
- `_s`: 定義されたストアを ID で管理する Map

### StoreInstance インターフェース

各ストアインスタンスが持つメソッドを定義します．

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

- `$id`: ストアの識別子
- `$state`: ストアの状態（Options API スタイルのみ）
- `$patch`: 状態の一括更新
- `$reset`: 状態の初期値へのリセット（Options API スタイルのみ）

## Dependency Injection のキー

ストアを provide/inject で共有するためのキーを定義します．

```ts
// rootStore.ts
import type { InjectionKey } from "chibivue";

export const storeSymbol: InjectionKey<Store> = Symbol();
```

このシンボルを使って，`createStore()` で作成したストアをアプリ全体に provide します．

## createStore の実装

ルートストアを作成する関数です．

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

ポイント：
- `effectScope()` で detached スコープを作成し，ストアのライフサイクルを管理
- `state` は `ref({})` で，すべてのストアの状態を一元管理（SSR 用）
- `markRaw` でストアオブジェクト自体をリアクティブ化から除外
- `install` メソッドで `app.provide` を呼び出し，ストアをアプリ全体で利用可能にする

### activeStore の管理

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

`activeStore` は，コンポーネント外からストアにアクセスする場合（例：他のストア内）に使用されます．

`getActiveStore` は `hasInjectionContext()` を使って injection context を確認し，SSR 環境で context がない場合は警告を出します．これにより，Cross-Request State Pollution のリスクを開発者に知らせます．

## defineStore の実装

個別のストアを定義する関数です．Pinia と同様に，2 つのスタイルで定義できます．

### Composition API スタイル

```ts
// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;
```

`setup` 関数を渡して，`ref` や `computed` を使って状態を定義します．

### Options API スタイル

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

`state`, `getters`, `actions` を持つオブジェクトで定義します．

### StoreOptions インターフェース

```ts
interface StoreOptions<Id extends string, S extends StateTree, G extends _GettersTree<S>, A> {
  id: Id;
  state?: () => S;
  getters?: G & ThisType<S & { [K in keyof G]: ReturnType<G[K]> }>;
  actions?: A & ThisType<S & A & { [K in keyof G]: ReturnType<G[K]> }>;
}
```

<KawaikoNote variant="funny" title="ThisType の魔法">

`ThisType` を使うことで，`getters` や `actions` 内の `this` の型を正しく推論できます．
例えば `actions` 内では `this.count` で state にアクセスでき，`this.doubleCount` で getters にもアクセスできます．

</KawaikoNote>

### useStore 関数の実装

```ts
function useStore(outerStore?: Store | null): StoreGeneric {
  const hasContext = hasInjectionContext();
  // injection context から store を取得し，なければ activeStore にフォールバック
  outerStore =
    outerStore || (hasContext ? inject(storeSymbol, null) : null);

  if (outerStore) setActiveStore(outerStore);

  if (__DEV__ && !activeStore) {
    throw new Error(
      `[chibivue-store]: "getActiveStore()" was called but there was no active Store. ` +
        `Are you trying to use a store before calling "app.use(createStore())"?`,
    );
  }

  const store = activeStore!;

  if (!store._s.has(id)) {
    if (isSetupStore) {
      createSetupStore(id, setup!, store);
    } else if (options) {
      createOptionsStore(id, options, store);
    }
  }

  return store._s.get(id)!;
}
```

処理の流れ：
1. `hasInjectionContext()` で injection context があるか確認
2. context があれば `inject(storeSymbol)` でルートストアを取得，なければ `activeStore` にフォールバック
3. ストアが未作成なら `createSetupStore` または `createOptionsStore` で作成
4. 作成済みのストアを返却

<KawaikoNote variant="warning" title="hasInjectionContext の重要性">

`hasInjectionContext()` は SSR で重要な役割を果たします．
setup 関数内では injection context があるため，`inject()` でリクエストごとのストアを取得できます．
context がない場合（他のストア内など）は `activeStore` にフォールバックします．

</KawaikoNote>

### createSetupStore（Composition API 用）

```ts
function createSetupStore<Id extends string>(id: Id, setup: () => StateTree, store: Store) {
  // ルート state にこのストアの状態を初期化
  if (!store.state.value[id]) {
    store.state.value[id] = {};
  }

  const initialState = store.state.value[id];
  const setupStore = store._e.run(() => setup())!;

  // setup store の戻り値を処理
  for (const key in setupStore) {
    const prop = setupStore[key];

    // ref または reactive な値をルート state に同期
    if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
      // SSR hydration: 初期状態があれば復元
      if (initialState && key in initialState) {
        if (isRef(prop)) {
          prop.value = initialState[key];
        } else {
          Object.assign(prop, initialState[key]);
        }
      }
      // ルート state に同期
      store.state.value[id][key] = prop;
    }
  }

  const _store = reactive({
    $id: id,
    ...setupStore,
    $patch(partialState: Partial<StateTree> | ((state: StateTree) => void)) {
      if (typeof partialState === "function") {
        partialState(store.state.value[id]);
      } else {
        for (const key in partialState) {
          const value = store.state.value[id][key];
          if (isRef(value)) {
            value.value = partialState[key];
          } else {
            store.state.value[id][key] = partialState[key];
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

ポイント：
- `store._e.run()` で EffectScope 内で setup を実行
- ref/reactive な値を `store.state.value[id]` に同期（SSR 用）
- hydration 時は `initialState` から値を復元

<KawaikoNote variant="warning" title="$reset の制限">

Composition API スタイルでは，初期状態を保持していないため `$reset` は使用できません．
`$reset` が必要な場合は Options API スタイルを使用してください．

</KawaikoNote>

### createOptionsStore（Options API 用）

```ts
function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(id: Id, options: Omit<StoreOptions<Id, S, G, A>, "id">, store: Store) {
  const { state: stateFn, getters, actions } = options;

  // ルート state から初期状態を取得（SSR hydration 用）
  const initialState = store.state.value[id] as S | undefined;

  function setup() {
    // 初期状態がなければ state() を実行
    if (!initialState) {
      store.state.value[id] = stateFn ? stateFn() : {};
    }

    const localState = toRefs(store.state.value[id]);

    // getters を computed に変換
    const computedGetters: Record<string, ComputedRef<unknown>> = {};
    if (getters) {
      for (const key in getters) {
        const getter = getters[key];
        computedGetters[key] = markRaw(
          computed(() => {
            setActiveStore(store);
            const _store = store._s.get(id)!;
            return getter.call(_store, _store);
          }),
        );
      }
    }

    return {
      ...localState,
      ...computedGetters,
      ...actions,
    };
  }

  const setupStore = store._e.run(() => setup())!;

  const _store = reactive({
    $id: id,
    ...setupStore,
    ...boundActions,
    $patch(partialState: Partial<S> | ((state: S) => void)) {
      if (typeof partialState === "function") {
        partialState(store.state.value[id] as S);
      } else {
        mergeReactiveObjects(store.state.value[id], partialState);
      }
    },
    $reset() {
      const newState = stateFn ? stateFn() : ({} as S);
      this.$patch(($state: S) => {
        Object.assign($state, newState);
      });
    },
  });

  // $state を getter/setter として定義
  Object.defineProperty(_store, "$state", {
    get: () => store.state.value[id],
    set: (state) => {
      _store.$patch(($state: S) => {
        Object.assign($state, state);
      });
    },
  });

  store._s.set(id, _store);
}
```

ポイント：
- 状態は `store.state.value[id]` に保存（Pinia と同じパターン）
- `toRefs` で状態を ref に変換し，リアクティビティを維持
- `store._e.run()` で EffectScope 内で setup を実行
- `getters` は `computed` に変換し，`markRaw` でリアクティブ化を回避
- `$state` は getter/setter として定義し，状態全体にアクセス可能

## 使用例

### Composition API スタイル

```ts
// stores/counter.ts
import { ref, computed } from "chibivue";
import { defineStore } from "chibivue-store";

export const useCounterStore = defineStore("counter", () => {
  // State
  const count = ref(0);

  // Getters (computed を使用)
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

### Options API スタイル

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
    // this を使って他の getter にアクセス
    quadrupleCount() {
      return this.doubleCount * 2;
    },
  },

  actions: {
    increment() {
      this.count++;
    },
    // 非同期アクションも可能
    async incrementAsync() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.count++;
    },
  },
});
```

<KawaikoNote variant="funny" title="どちらのスタイルを選ぶ？">

- **Composition API スタイル**: 柔軟性が高く，通常のコンポーネントと同じ書き方ができる
- **Options API スタイル**: 構造が明確で，`$reset` が使える

どちらも同等の機能を提供しますが，プロジェクトの方針に合わせて選んでください．

</KawaikoNote>

### アプリケーションへの登録

```ts
// main.ts
import { createApp } from "chibivue";
import App from "./App.vue";
import { createStore } from "chibivue-store";

const app = createApp(App);
app.use(createStore());
app.mount("#app");
```

### コンポーネントでの使用

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

## $patch の使い方

`$patch` を使うと，複数の状態を一度に更新できます．

### オブジェクト形式

```ts
const store = useCounterStore();

// 複数のプロパティを一度に更新
store.$patch({
  count: 10,
});
```

### 関数形式

```ts
const store = useCounterStore();

// state を直接操作
store.$patch((state) => {
  state.count += 5;
});
```

<KawaikoNote variant="warning" title="$patch の利点">

複数の状態変更を `$patch` でまとめると，リアクティビティのトリガーが一度だけになり，パフォーマンスが向上します．

</KawaikoNote>

## $reset の使い方

Options API スタイルで定義したストアでは，`$reset` を使って状態を初期値に戻せます．

```ts
const store = useCounterStore();

store.increment(); // count: 1
store.increment(); // count: 2

store.$reset(); // count: 0 (初期値に戻る)
```

## 処理フロー

```
app.use(createStore())
  ↓
store.install(app)
  ├── setActiveStore(store)
  └── app.provide(storeSymbol, store)
  ↓
コンポーネントで useCounterStore() を呼び出し
  ↓
useStore()
  ├── inject(storeSymbol) で store を取得
  └── store._s.has("counter") をチェック
      ↓ (なければ)
      createSetupStore() または createOptionsStore()
        ├── setup() / state() を実行
        ├── getters を computed に変換
        ├── actions をバインド
        └── store._s.set("counter", 結果)
  ↓
store._s.get("counter") を返却
  ↓
コンポーネントでリアクティブな状態を使用
```

## 複数のストア

複数のストアを定義して使い分けることができます．

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

### ストア間の連携

あるストアから別のストアを使用することもできます．

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

<KawaikoNote variant="warning" title="循環参照に注意">

ストア A がストア B を使用し，ストア B がストア A を使用すると循環参照が発生します．
このような場合は，共通の状態を別のストアに切り出すことを検討してください．

</KawaikoNote>

## SSR 対応

chibivue-store はサーバーサイドレンダリング（SSR）に対応しています．

### store.state プロパティ

ルートストアの `state` プロパティを使って，すべてのストアの状態をシリアライズ・ハイドレートできます．

```ts
// Store interface
interface Store {
  install: (app: App) => void;
  state: Ref<Record<string, StateTree>>;  // すべてのストアの状態を保持
  _e: EffectScope;
  _s: Map<string, StoreGeneric>;
}
```

`state` は `ref({})` として作成され，各ストアの状態が `state.value[storeId]` に保存されます．
これにより：
- SSR でサーバー側の状態をシリアライズ: `JSON.stringify(store.state.value)`
- クライアント側でハイドレート: `store.state.value = serverState`

### サーバー側：状態のシリアライズ

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createStore } from "chibivue-store";
import App from "./App.vue";

export async function render() {
  // 重要: リクエストごとに新しいインスタンスを作成
  // これにより Cross-Request State Pollution を防ぐ
  const store = createStore();
  const app = createApp(App);
  app.use(store);

  const html = await renderToString(app);

  // ストアの状態をシリアライズ
  const storeState = JSON.stringify(store.state.value);

  return { html, storeState };
}
```

<KawaikoNote variant="warning" title="リクエストごとに新しいインスタンス">

`render()` 関数内で `createStore()` と `createApp()` を呼び出していることに注目してください．
**モジュールスコープでシングルトンとして作成してはいけません**．

```ts
// NG: モジュールスコープでの作成は危険
const store = createStore();  // 全リクエストで共有されてしまう
const app = createApp(App);

export async function render() {
  // store と app が全リクエストで共有される
}
```

</KawaikoNote>

### HTML への埋め込み

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // サーバーでシリアライズした状態を埋め込む
      window.__STORE_STATE__ = ${storeState};
    </script>
  </head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### クライアント側：状態のハイドレート

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createStore } from "chibivue-store";
import App from "./App.vue";

const store = createStore();
const app = createApp(App);
app.use(store);

// サーバーの状態でハイドレート
if (window.__STORE_STATE__) {
  store.state.value = window.__STORE_STATE__;
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="ストアの初期化順序">

ハイドレートを行う前に，各ストアが初期化されている必要があります．
コンポーネントが使用するストア（`useXxxStore()`）は，`app.mount()` 時に自動的に初期化されます．

もし mount 前にハイドレートが必要な場合は，事前にストアを呼び出しておいてください：

```ts
// 事前にストアを初期化
useCounterStore();
useUserStore();

// その後ハイドレート
store.state = window.__STORE_STATE__;

app.mount("#app");
```

</KawaikoNote>

### state の仕組み

新しい実装では，`state` は `ref({})` として作成され，各ストアの状態が直接保存されます：

```ts
// createStore.ts
const state = scope.run(() => ref({}))!;
```

各ストアが作成されると，状態は `store.state.value[id]` に保存されます：

```ts
// store.ts (createSetupStore, createOptionsStore 内)
store.state.value[id] = stateFn ? stateFn() : {};
```

この設計により：
- SSR: `store.state.value` をそのまま `JSON.stringify` でシリアライズ
- Hydration: `store.state.value = serverState` で直接復元
- 各ストアの setup/state 関数は，既存の `state.value[id]` があればそれを使用（hydration）

<KawaikoNote variant="surprise" title="SSR Ready!">

これで chibivue-store は SSR に対応しました．
サーバーで計算した状態をクライアントに引き継ぐことで，ハイドレーション後も一貫した状態を維持できます．

</KawaikoNote>

## 今後の拡張

現在の実装は基本的な機能をカバーしていますが，Pinia には以下のような機能もあります：

1. **$subscribe**: 状態変更の購読
2. **$onAction**: アクション実行の監視
3. **プラグインシステム**: ストアの機能を拡張
4. **Devtools 連携**: 状態の可視化とタイムトラベルデバッグ
5. **mapState / mapActions**: Options API コンポーネント用のヘルパー

<KawaikoNote variant="surprise" title="実装完了！">

これで Pinia ライクなストアが完成しました．
約 150 行のコードで状態管理を実現できています．
Pinia の仕組みを理解する良い出発点になったでしょう．

</KawaikoNote>

## まとめ

chibivue-store の実装は以下の要素で構成されています：

1. **ルートストアの作成**: `createStore` で Vue プラグインとしてインストール
2. **Dependency Injection**: `provide/inject` でストアをコンポーネントツリー全体に共有
3. **2 つの定義スタイル**: Composition API と Options API の両方をサポート
4. **Getters**: `computed` を使った派生状態の定義
5. **Actions**: state と getters にアクセスできるメソッド
6. **$patch**: 状態の一括更新
7. **$reset**: 状態の初期値へのリセット（Options API のみ）
8. **シングルトンパターン**: 同じ ID のストアは一度だけ作成
9. **SSR 対応**: `store.state` による状態のシリアライズとハイドレート

Vue のプラグインシステム，provide/inject，リアクティビティシステムを組み合わせることで，グローバルな状態管理を実現しています．
