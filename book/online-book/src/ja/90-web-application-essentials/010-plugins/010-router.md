# Router

## ルーターとは

シングルページアプリケーション（SPA）では，URL に応じて異なるコンポーネントを表示する必要があります．Vue.js のエコシステムでは，Vue Router がこの機能を提供しています．

<KawaikoNote variant="question" title="SPAのルーティングって？">

従来の Web サイトでは，URL が変わるたびにサーバーから新しい HTML を取得していました．
SPA では，JavaScript でページの切り替えを行い，サーバーへのリクエストなしに画面を更新します．
これを「クライアントサイドルーティング」と呼びます．

</KawaikoNote>

この章では，Vue Router の基本的な機能を chibivue-router として実装します．

## パッケージ構成

chibivue-router は `@extensions/chibivue-router` パッケージで提供されています．

```
@extensions/chibivue-router/src/
├── index.ts              # エクスポート
├── router.ts             # メインのルーターロジック
├── history.ts            # History API ラッパー
├── RouterView.ts         # RouterView コンポーネント
├── useApi.ts             # Composition API フック
├── injectionSymbols.ts   # Dependency Injection のキー
└── types/
    └── index.ts          # 型定義
```

## 型定義

### RouteLocationNormalizedLoaded

現在のルート情報を表す型です．

```ts
// types/index.ts
export interface RouteLocationNormalizedLoaded {
  fullPath: string;
  component: any;
}
```

### RouteRecord

ルート定義を表す型です．

```ts
// router.ts
export interface RouteRecord {
  path: string;
  component: any;
}
```

### Router インターフェース

ルーターの公開 API を定義します．

```ts
// router.ts
export interface Router {
  install(app: App): void;
  push(to: string): void;
  replace(to: string): void;
}
```

## History API の抽象化

ブラウザの History API をラップして，ルーターから使いやすくします．

### RouterHistory インターフェース

```ts
// history.ts
export interface RouterHistory {
  location: Location;
  push(to: string): void;
  replace(to: string): void;
  go(delta: number, triggerListeners?: boolean): void;
}
```

### createWebHistory 関数

```ts
// history.ts
export const createWebHistory = (): RouterHistory => {
  return {
    location: window.location,
    push(to: string) {
      window.history.pushState({}, "", to);
    },
    replace(to: string) {
      window.history.replaceState({}, "", to);
    },
    go(delta: number, triggerListeners?: boolean) {
      window.history.go(delta);
    },
  };
};
```

ポイント：
- `pushState`: 履歴に新しいエントリを追加（戻るボタンで前のページに戻れる）
- `replaceState`: 現在の履歴エントリを置き換え（履歴には残らない）
- `go`: 履歴を前後に移動

<KawaikoNote variant="funny" title="pushState vs replaceState">

`pushState` は「本棚に新しい本を追加する」イメージ．
`replaceState` は「今読んでいる本を別の本に交換する」イメージ．
戻るボタンは「前に読んでいた本に戻る」ことに相当します．

</KawaikoNote>

## Dependency Injection のキー

ルーター関連の値を provide/inject で共有するためのキーを定義します．

```ts
// injectionSymbols.ts
import type { ComputedRef, InjectionKey, Ref } from "@chibivue/runtime-core";
import type { Router } from "./router";
import type { RouteLocationNormalizedLoaded } from "./types";

// ルーター本体
export const routerKey = Symbol() as InjectionKey<Router>;

// 現在のルート（computed でラップ）
export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>;

// RouterView 用のルート（Ref）
export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>;
```

3 つのキーを分けている理由：
1. `routerKey`: ナビゲーションメソッド（`push`, `replace`）へのアクセス用
2. `routeLocationKey`: `useRoute()` で現在のルート情報を取得する用（computed でリアクティブ）
3. `routerViewLocationKey`: `RouterView` コンポーネントが表示するコンポーネントを決定する用

## createRouter の実装

### ルート解決

```ts
// router.ts
const resolve = (to: string) => {
  const route = options.routes.find((route) => route.path === to);
  return {
    fullPath: to,
    component: route?.component ?? null,
  };
};
```

現在の実装では完全一致のみをサポートしています．Vue Router の本家実装ではパラメータ（`/user/:id`）や正規表現にも対応しています．

### 状態管理

```ts
// router.ts
const currentRoute = ref<RouteLocationNormalizedLoaded>({
  fullPath: routerHistory.location.pathname,
  component: resolve(routerHistory.location.pathname).component,
});
```

現在のルート情報を `ref` で管理します．これにより，ルートが変わると `RouterView` が自動的に再レンダリングされます．

### ナビゲーションメソッド

```ts
// router.ts
function push(to: string) {
  routerHistory.push(to);
  currentRoute.value = resolve(to);
}

function replace(to: string) {
  routerHistory.replace(to);
  currentRoute.value = resolve(to);
}
```

URL を変更し，同時にリアクティブな状態も更新します．

### プラグインのインストール

```ts
// router.ts
install(app: App) {
  const router = this;

  // RouterView コンポーネントをグローバル登録
  app.component("RouterView", RouterViewImpl);

  // リアクティブなルート情報を作成
  const reactiveRoute = computed(() => currentRoute.value);

  // 値を provide
  app.provide(routerKey, router);
  app.provide(routeLocationKey, reactive(reactiveRoute));
  app.provide(routerViewLocationKey, currentRoute);
}
```

`app.use(router)` を呼び出すと，この `install` メソッドが実行されます．

## RouterView コンポーネント

現在のルートに対応するコンポーネントを表示します．

```ts
// RouterView.ts
import { type ComponentOptions, Fragment, h, inject } from "chibivue";
import { routerViewLocationKey } from "./injectionSymbols";

export const RouterViewImpl: ComponentOptions = {
  name: "RouterView",
  setup() {
    const injectedRoute = inject(routerViewLocationKey)!;

    return () => {
      const ViewComponent = injectedRoute.value.component;

      // Fragment でラップしてレンダリング
      const component = h(Fragment, [
        h(ViewComponent, { key: injectedRoute.value.fullPath }),
      ]);

      return component;
    };
  },
};
```

<KawaikoNote variant="warning" title="key 属性が重要！">

`key` に `fullPath` を指定することで，ルートが変わるたびにコンポーネントが完全に再マウントされます．
これがないと，同じコンポーネントが使い回され，`setup` が再実行されません．

</KawaikoNote>

Fragment でラップしている理由は，patch children の動作を正しく行うためです．

## Composition API フック

### useRouter

ルーターインスタンスを取得します．

```ts
// useApi.ts
export function useRouter(): Router {
  return inject(routerKey)!;
}
```

使用例：
```ts
const router = useRouter()
router.push('/about')
```

### useRoute

現在のルート情報を取得します．

```ts
// useApi.ts
export function useRoute(): ComputedRef<RouteLocationNormalizedLoaded> {
  return inject(routeLocationKey)!;
}
```

使用例：
```ts
const route = useRoute()
console.log(route.value.fullPath) // '/about'
```

## 使用例

### ルーターの設定

```ts
// router.ts
import { createRouter, createWebHistory } from 'chibivue-router'
import Home from './pages/Home.vue'
import About from './pages/About.vue'
import Contact from './pages/Contact.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/contact', component: Contact },
  ],
})
```

### アプリケーションへの登録

```ts
// main.ts
import { createApp } from 'chibivue'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

### テンプレートでの使用

```vue
<!-- App.vue -->
<script setup>
import { useRouter } from 'chibivue-router'

const router = useRouter()
</script>

<template>
  <header>
    <nav>
      <button @click="router.push('/')">Home</button>
      <button @click="router.push('/about')">About</button>
      <button @click="router.push('/contact')">Contact</button>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>
</template>
```

## 処理フロー

```
app.use(router)
  ↓
router.install(app)
  ├── app.component("RouterView", RouterViewImpl)
  ├── app.provide(routerKey, router)
  ├── app.provide(routeLocationKey, ...)
  └── app.provide(routerViewLocationKey, currentRoute)
  ↓
RouterView がレンダリング
  ↓
inject(routerViewLocationKey) で currentRoute を取得
  ↓
currentRoute.value.component をレンダリング

--- ナビゲーション ---

router.push('/about')
  ↓
routerHistory.push('/about')  ← URL 変更
  ↓
currentRoute.value = resolve('/about')  ← 状態更新
  ↓
RouterView が再レンダリング
  ↓
新しいコンポーネントを表示
```

## 今後の拡張

現在の実装は最小限ですが，Vue Router には以下のような機能があります：

1. **RouterLink コンポーネント**: `<a>` タグをラップしたナビゲーション用コンポーネント
2. **ルートパラメータ**: `/user/:id` のような動的セグメント
3. **クエリパラメータ**: `?key=value` の解析
4. **ナビゲーションガード**: `beforeEach`, `afterEach` などのフック
5. **popstate イベント**: ブラウザの戻る/進むボタンへの対応
6. **ネストされたルート**: 子ルートの定義

<KawaikoNote variant="surprise" title="実装完了！">

これでシンプルなルーターが完成しました．
約 100 行のコードで SPA のルーティングを実現できています．
Vue Router の仕組みを理解する良い出発点になったでしょう．

</KawaikoNote>

## まとめ

chibivue-router の実装は以下の要素で構成されています：

1. **History API のラップ**: `createWebHistory` でブラウザの履歴操作を抽象化
2. **リアクティブな状態管理**: `ref` で現在のルートを管理
3. **Dependency Injection**: `provide/inject` でルーター情報をコンポーネントツリー全体に共有
4. **RouterView コンポーネント**: 現在のルートに対応するコンポーネントを動的に表示
5. **Composition API フック**: `useRouter` と `useRoute` で簡単にアクセス

Vue のプラグインシステム，provide/inject，リアクティビティシステムを組み合わせることで，クライアントサイドルーティングを実現しています．
