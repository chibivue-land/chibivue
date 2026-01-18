# 路由器

## 什麼是路由器？

在單頁應用（SPA）中，我們需要根據 URL 顯示不同的組件．在 Vue.js 生態系統中，Vue Router 提供了這個功能．

<KawaikoNote variant="question" title="SPA 路由？">

在傳統網站中，每次 URL 變化時都會從伺服器獲取新的 HTML 頁面．
在 SPA 中，頁面切換由 JavaScript 處理，無需請求伺服器即可更新螢幕．
這被稱為「客戶端路由」．

</KawaikoNote>

在本章中，我們將實現基本的 Vue Router 功能，命名為 chibivue-router．

## 套件結構

chibivue-router 位於 `@extensions/chibivue-router` 套件中．

```
@extensions/chibivue-router/src/
├── index.ts              # 匯出
├── router.ts             # 主路由邏輯
├── history.ts            # History API 封裝
├── RouterView.ts         # RouterView 組件
├── useApi.ts             # Composition API 鉤子
├── injectionSymbols.ts   # 依賴注入鍵
└── types/
    └── index.ts          # 類型定義
```

## 類型定義

### RouteLocationNormalizedLoaded

表示當前路由資訊的類型．

```ts
// types/index.ts
export interface RouteLocationNormalizedLoaded {
  fullPath: string;
  component: any;
}
```

### RouteRecord

表示路由定義的類型．

```ts
// router.ts
export interface RouteRecord {
  path: string;
  component: any;
}
```

### Router 介面

定義路由器的公開 API．

```ts
// router.ts
export interface Router {
  install(app: App): void;
  push(to: string): void;
  replace(to: string): void;
}
```

## History API 抽象

封裝瀏覽器的 History API，使其更易於在路由器中使用．

### RouterHistory 介面

```ts
// history.ts
export interface RouterHistory {
  location: Location;
  push(to: string): void;
  replace(to: string): void;
  go(delta: number, triggerListeners?: boolean): void;
}
```

### createWebHistory 函數

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

要點：
- `pushState`：向歷史記錄添加新條目（可以用返回按鈕返回）
- `replaceState`：替換當前歷史記錄條目（不會保留在歷史記錄中）
- `go`：在歷史記錄中前進或後退

<KawaikoNote variant="funny" title="pushState vs replaceState">

可以把 `pushState` 想像成「在書架上添加一本新書」．
`replaceState` 就像「用另一本書替換你正在讀的書」．
返回按鈕就像「回到你之前讀的書」．

</KawaikoNote>

## 依賴注入鍵

定義用於通過 provide/inject 共享路由相關值的鍵．

```ts
// injectionSymbols.ts
import type { ComputedRef, InjectionKey, Ref } from "@chibivue/runtime-core";
import type { Router } from "./router";
import type { RouteLocationNormalizedLoaded } from "./types";

// 路由器本身
export const routerKey = Symbol() as InjectionKey<Router>;

// 當前路由（包裝在 computed 中）
export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>;

// RouterView 用的路由（Ref）
export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>;
```

需要三個獨立鍵的原因：
1. `routerKey`：用於存取導航方法（`push`，`replace`）
2. `routeLocationKey`：用於通過 `useRoute()` 獲取當前路由資訊（通過 computed 實現響應式）
3. `routerViewLocationKey`：用於 RouterView 組件確定顯示哪個組件

## createRouter 實現

### 路由解析

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

當前實現僅支援精確匹配．Vue Router 的實際實現還支援參數（`/user/:id`）和正規表達式．

### 狀態管理

```ts
// router.ts
const currentRoute = ref<RouteLocationNormalizedLoaded>({
  fullPath: routerHistory.location.pathname,
  component: resolve(routerHistory.location.pathname).component,
});
```

當前路由資訊使用 `ref` 管理．這使得路由變化時 RouterView 可以自動重新渲染．

### 導航方法

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

同時更改 URL 和響應式狀態．

### 外掛安裝

```ts
// router.ts
install(app: App) {
  const router = this;

  // 全域註冊 RouterView 組件
  app.component("RouterView", RouterViewImpl);

  // 建立響應式路由資訊
  const reactiveRoute = computed(() => currentRoute.value);

  // 提供值
  app.provide(routerKey, router);
  app.provide(routeLocationKey, reactive(reactiveRoute));
  app.provide(routerViewLocationKey, currentRoute);
}
```

當呼叫 `app.use(router)` 時，會執行這個 `install` 方法．

## RouterView 組件

顯示與當前路由對應的組件．

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

      // 包裝在 Fragment 中進行渲染
      const component = h(Fragment, [
        h(ViewComponent, { key: injectedRoute.value.fullPath }),
      ]);

      return component;
    };
  },
};
```

<KawaikoNote variant="warning" title="key 屬性很重要！">

通過指定 `fullPath` 作為 `key`，每當路由變化時組件都會完全重新掛載．
如果沒有這個，相同的組件會被重用，`setup` 不會重新執行．

</KawaikoNote>

包裝在 Fragment 中的原因是為了確保正確的子元素補丁行為．

## Composition API 鉤子

### useRouter

獲取路由器實例．

```ts
// useApi.ts
export function useRouter(): Router {
  return inject(routerKey)!;
}
```

用法：
```ts
const router = useRouter()
router.push('/about')
```

### useRoute

獲取當前路由資訊．

```ts
// useApi.ts
export function useRoute(): ComputedRef<RouteLocationNormalizedLoaded> {
  return inject(routeLocationKey)!;
}
```

用法：
```ts
const route = useRoute()
console.log(route.value.fullPath) // '/about'
```

## 使用範例

### 路由器設定

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

### 註冊到應用程式

```ts
// main.ts
import { createApp } from 'chibivue'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

### 在模板中使用

```vue
<!-- App.vue -->
<script setup>
import { useRouter } from 'chibivue-router'

const router = useRouter()
</script>

<template>
  <header>
    <nav>
      <button @click="router.push('/')">首頁</button>
      <button @click="router.push('/about')">關於</button>
      <button @click="router.push('/contact')">聯絡</button>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>
</template>
```

## 處理流程

```
app.use(router)
  ↓
router.install(app)
  ├── app.component("RouterView", RouterViewImpl)
  ├── app.provide(routerKey, router)
  ├── app.provide(routeLocationKey, ...)
  └── app.provide(routerViewLocationKey, currentRoute)
  ↓
RouterView 渲染
  ↓
inject(routerViewLocationKey) 獲取 currentRoute
  ↓
渲染 currentRoute.value.component

--- 導航 ---

router.push('/about')
  ↓
routerHistory.push('/about')  ← URL 變化
  ↓
currentRoute.value = resolve('/about')  ← 狀態更新
  ↓
RouterView 重新渲染
  ↓
顯示新組件
```

## 未來擴展

當前實現是最小化的，但 Vue Router 還有以下功能：

1. **RouterLink 組件**：包裝 `<a>` 標籤的導航組件
2. **路由參數**：動態片段如 `/user/:id`
3. **查詢參數**：解析 `?key=value`
4. **導航守衛**：`beforeEach`，`afterEach` 等鉤子
5. **popstate 事件**：處理瀏覽器返回/前進按鈕
6. **巢狀路由**：定義子路由

<KawaikoNote variant="surprise" title="實現完成！">

我們完成了一個簡單的路由器．
用大約 100 行程式碼，我們實現了 SPA 路由．
這應該是理解 Vue Router 工作原理的一個好起點．

</KawaikoNote>

## 總結

chibivue-router 實現由以下部分組成：

1. **History API 封裝**：用 `createWebHistory` 抽象瀏覽器歷史操作
2. **響應式狀態管理**：用 `ref` 管理當前路由
3. **依賴注入**：通過 `provide/inject` 在組件樹中共享路由資訊
4. **RouterView 組件**：動態顯示與當前路由對應的組件
5. **Composition API 鉤子**：通過 `useRouter` 和 `useRoute` 輕鬆存取

通過結合 Vue 的外掛系統，provide/inject 和響應式系統，我們實現了客戶端路由．
