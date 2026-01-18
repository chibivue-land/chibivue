# 路由器

## 什么是路由器？

在单页应用（SPA）中，我们需要根据 URL 显示不同的组件．在 Vue.js 生态系统中，Vue Router 提供了这个功能．

<KawaikoNote variant="question" title="SPA 路由？">

在传统网站中，每次 URL 变化时都会从服务器获取新的 HTML 页面．
在 SPA 中，页面切换由 JavaScript 处理，无需请求服务器即可更新屏幕．
这被称为"客户端路由"．

</KawaikoNote>

在本章中，我们将实现基本的 Vue Router 功能，命名为 chibivue-router．

## 包结构

chibivue-router 位于 `@extensions/chibivue-router` 包中．

```
@extensions/chibivue-router/src/
├── index.ts              # 导出
├── router.ts             # 主路由逻辑
├── history.ts            # History API 封装
├── RouterView.ts         # RouterView 组件
├── useApi.ts             # Composition API 钩子
├── injectionSymbols.ts   # 依赖注入键
└── types/
    └── index.ts          # 类型定义
```

## 类型定义

### RouteLocationNormalizedLoaded

表示当前路由信息的类型．

```ts
// types/index.ts
export interface RouteLocationNormalizedLoaded {
  fullPath: string;
  component: any;
}
```

### RouteRecord

表示路由定义的类型．

```ts
// router.ts
export interface RouteRecord {
  path: string;
  component: any;
}
```

### Router 接口

定义路由器的公共 API．

```ts
// router.ts
export interface Router {
  install(app: App): void;
  push(to: string): void;
  replace(to: string): void;
}
```

## History API 抽象

封装浏览器的 History API，使其更易于在路由器中使用．

### RouterHistory 接口

```ts
// history.ts
export interface RouterHistory {
  location: Location;
  push(to: string): void;
  replace(to: string): void;
  go(delta: number, triggerListeners?: boolean): void;
}
```

### createWebHistory 函数

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

要点：
- `pushState`：向历史记录添加新条目（可以用后退按钮返回）
- `replaceState`：替换当前历史记录条目（不会保留在历史记录中）
- `go`：在历史记录中前进或后退

<KawaikoNote variant="funny" title="pushState vs replaceState">

可以把 `pushState` 想象成"在书架上添加一本新书"．
`replaceState` 就像"用另一本书替换你正在读的书"．
后退按钮就像"回到你之前读的书"．

</KawaikoNote>

## 依赖注入键

定义用于通过 provide/inject 共享路由相关值的键．

```ts
// injectionSymbols.ts
import type { ComputedRef, InjectionKey, Ref } from "@chibivue/runtime-core";
import type { Router } from "./router";
import type { RouteLocationNormalizedLoaded } from "./types";

// 路由器本身
export const routerKey = Symbol() as InjectionKey<Router>;

// 当前路由（包装在 computed 中）
export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>;

// RouterView 用的路由（Ref）
export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>;
```

需要三个独立键的原因：
1. `routerKey`：用于访问导航方法（`push`，`replace`）
2. `routeLocationKey`：用于通过 `useRoute()` 获取当前路由信息（通过 computed 实现响应式）
3. `routerViewLocationKey`：用于 RouterView 组件确定显示哪个组件

## createRouter 实现

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

当前实现仅支持精确匹配．Vue Router 的实际实现还支持参数（`/user/:id`）和正则表达式．

### 状态管理

```ts
// router.ts
const currentRoute = ref<RouteLocationNormalizedLoaded>({
  fullPath: routerHistory.location.pathname,
  component: resolve(routerHistory.location.pathname).component,
});
```

当前路由信息使用 `ref` 管理．这使得路由变化时 RouterView 可以自动重新渲染．

### 导航方法

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

同时更改 URL 和响应式状态．

### 插件安装

```ts
// router.ts
install(app: App) {
  const router = this;

  // 全局注册 RouterView 组件
  app.component("RouterView", RouterViewImpl);

  // 创建响应式路由信息
  const reactiveRoute = computed(() => currentRoute.value);

  // 提供值
  app.provide(routerKey, router);
  app.provide(routeLocationKey, reactive(reactiveRoute));
  app.provide(routerViewLocationKey, currentRoute);
}
```

当调用 `app.use(router)` 时，会执行这个 `install` 方法．

## RouterView 组件

显示与当前路由对应的组件．

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

      // 包装在 Fragment 中进行渲染
      const component = h(Fragment, [
        h(ViewComponent, { key: injectedRoute.value.fullPath }),
      ]);

      return component;
    };
  },
};
```

<KawaikoNote variant="warning" title="key 属性很重要！">

通过指定 `fullPath` 作为 `key`，每当路由变化时组件都会完全重新挂载．
如果没有这个，相同的组件会被重用，`setup` 不会重新执行．

</KawaikoNote>

包装在 Fragment 中的原因是为了确保正确的子元素补丁行为．

## Composition API 钩子

### useRouter

获取路由器实例．

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

获取当前路由信息．

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

## 使用示例

### 路由器配置

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

### 注册到应用

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
      <button @click="router.push('/')">首页</button>
      <button @click="router.push('/about')">关于</button>
      <button @click="router.push('/contact')">联系</button>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>
</template>
```

## 处理流程

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
inject(routerViewLocationKey) 获取 currentRoute
  ↓
渲染 currentRoute.value.component

--- 导航 ---

router.push('/about')
  ↓
routerHistory.push('/about')  ← URL 变化
  ↓
currentRoute.value = resolve('/about')  ← 状态更新
  ↓
RouterView 重新渲染
  ↓
显示新组件
```

## 未来扩展

当前实现是最小化的，但 Vue Router 还有以下功能：

1. **RouterLink 组件**：包装 `<a>` 标签的导航组件
2. **路由参数**：动态片段如 `/user/:id`
3. **查询参数**：解析 `?key=value`
4. **导航守卫**：`beforeEach`，`afterEach` 等钩子
5. **popstate 事件**：处理浏览器后退/前进按钮
6. **嵌套路由**：定义子路由

<KawaikoNote variant="surprise" title="实现完成！">

我们完成了一个简单的路由器．
用大约 100 行代码，我们实现了 SPA 路由．
这应该是理解 Vue Router 工作原理的一个好起点．

</KawaikoNote>

## 总结

chibivue-router 实现由以下部分组成：

1. **History API 封装**：用 `createWebHistory` 抽象浏览器历史操作
2. **响应式状态管理**：用 `ref` 管理当前路由
3. **依赖注入**：通过 `provide/inject` 在组件树中共享路由信息
4. **RouterView 组件**：动态显示与当前路由对应的组件
5. **Composition API 钩子**：通过 `useRouter` 和 `useRoute` 轻松访问

通过结合 Vue 的插件系统，provide/inject 和响应式系统，我们实现了客户端路由．
