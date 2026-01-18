# Router

## What is a Router?

In Single Page Applications (SPAs), we need to display different components based on the URL. In the Vue.js ecosystem, Vue Router provides this functionality.

<KawaikoNote variant="question" title="SPA Routing?">

In traditional websites, a new HTML page was fetched from the server every time the URL changed.
In SPAs, page transitions are handled by JavaScript, updating the screen without server requests.
This is called "client-side routing."

</KawaikoNote>

In this chapter, we'll implement basic Vue Router functionality as chibivue-router.

## Package Structure

chibivue-router is provided in the `@extensions/chibivue-router` package.

```
@extensions/chibivue-router/src/
├── index.ts              # Exports
├── router.ts             # Main router logic
├── history.ts            # History API wrapper
├── RouterView.ts         # RouterView component
├── useApi.ts             # Composition API hooks
├── injectionSymbols.ts   # Dependency Injection keys
└── types/
    └── index.ts          # Type definitions
```

## Type Definitions

### RouteLocationNormalizedLoaded

A type representing current route information.

```ts
// types/index.ts
export interface RouteLocationNormalizedLoaded {
  fullPath: string;
  component: any;
}
```

### RouteRecord

A type representing route definitions.

```ts
// router.ts
export interface RouteRecord {
  path: string;
  component: any;
}
```

### Router Interface

Defines the router's public API.

```ts
// router.ts
export interface Router {
  install(app: App): void;
  push(to: string): void;
  replace(to: string): void;
}
```

## History API Abstraction

Wrapping the browser's History API to make it easier to use from the router.

### RouterHistory Interface

```ts
// history.ts
export interface RouterHistory {
  location: Location;
  push(to: string): void;
  replace(to: string): void;
  go(delta: number, triggerListeners?: boolean): void;
}
```

### createWebHistory Function

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

Key points:
- `pushState`: Adds a new entry to the history (allows going back with the back button)
- `replaceState`: Replaces the current history entry (doesn't remain in history)
- `go`: Navigates forward or backward in history

<KawaikoNote variant="funny" title="pushState vs replaceState">

Think of `pushState` as "adding a new book to the bookshelf."
`replaceState` is like "replacing the book you're currently reading with another one."
The back button is like "going back to the book you were reading before."

</KawaikoNote>

## Dependency Injection Keys

Defining keys for sharing router-related values via provide/inject.

```ts
// injectionSymbols.ts
import type { ComputedRef, InjectionKey, Ref } from "@chibivue/runtime-core";
import type { Router } from "./router";
import type { RouteLocationNormalizedLoaded } from "./types";

// The router itself
export const routerKey = Symbol() as InjectionKey<Router>;

// Current route (wrapped in computed)
export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>;

// Route for RouterView (Ref)
export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>;
```

Reasons for having three separate keys:
1. `routerKey`: For accessing navigation methods (`push`, `replace`)
2. `routeLocationKey`: For getting current route info with `useRoute()` (reactive via computed)
3. `routerViewLocationKey`: For RouterView component to determine which component to display

## createRouter Implementation

### Route Resolution

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

The current implementation only supports exact matching. Vue Router's actual implementation also supports parameters (`/user/:id`) and regular expressions.

### State Management

```ts
// router.ts
const currentRoute = ref<RouteLocationNormalizedLoaded>({
  fullPath: routerHistory.location.pathname,
  component: resolve(routerHistory.location.pathname).component,
});
```

Current route information is managed with `ref`. This allows RouterView to automatically re-render when the route changes.

### Navigation Methods

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

Changes the URL and simultaneously updates the reactive state.

### Plugin Installation

```ts
// router.ts
install(app: App) {
  const router = this;

  // Register RouterView component globally
  app.component("RouterView", RouterViewImpl);

  // Create reactive route information
  const reactiveRoute = computed(() => currentRoute.value);

  // Provide values
  app.provide(routerKey, router);
  app.provide(routeLocationKey, reactive(reactiveRoute));
  app.provide(routerViewLocationKey, currentRoute);
}
```

When `app.use(router)` is called, this `install` method is executed.

## RouterView Component

Displays the component corresponding to the current route.

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

      // Wrap in Fragment for rendering
      const component = h(Fragment, [
        h(ViewComponent, { key: injectedRoute.value.fullPath }),
      ]);

      return component;
    };
  },
};
```

<KawaikoNote variant="warning" title="The key attribute is important!">

By specifying `fullPath` as the `key`, the component is completely remounted whenever the route changes.
Without this, the same component would be reused and `setup` wouldn't be re-executed.

</KawaikoNote>

The reason for wrapping in Fragment is to ensure proper patch children behavior.

## Composition API Hooks

### useRouter

Gets the router instance.

```ts
// useApi.ts
export function useRouter(): Router {
  return inject(routerKey)!;
}
```

Usage:
```ts
const router = useRouter()
router.push('/about')
```

### useRoute

Gets current route information.

```ts
// useApi.ts
export function useRoute(): ComputedRef<RouteLocationNormalizedLoaded> {
  return inject(routeLocationKey)!;
}
```

Usage:
```ts
const route = useRoute()
console.log(route.value.fullPath) // '/about'
```

## Usage Example

### Router Configuration

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

### Registering with Application

```ts
// main.ts
import { createApp } from 'chibivue'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

### Using in Templates

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

## Processing Flow

```
app.use(router)
  ↓
router.install(app)
  ├── app.component("RouterView", RouterViewImpl)
  ├── app.provide(routerKey, router)
  ├── app.provide(routeLocationKey, ...)
  └── app.provide(routerViewLocationKey, currentRoute)
  ↓
RouterView renders
  ↓
inject(routerViewLocationKey) gets currentRoute
  ↓
Render currentRoute.value.component

--- Navigation ---

router.push('/about')
  ↓
routerHistory.push('/about')  ← URL change
  ↓
currentRoute.value = resolve('/about')  ← State update
  ↓
RouterView re-renders
  ↓
Display new component
```

## Future Extensions

The current implementation is minimal, but Vue Router has features like:

1. **RouterLink component**: A navigation component wrapping `<a>` tags
2. **Route parameters**: Dynamic segments like `/user/:id`
3. **Query parameters**: Parsing `?key=value`
4. **Navigation guards**: Hooks like `beforeEach`, `afterEach`
5. **popstate event**: Handling browser back/forward buttons
6. **Nested routes**: Defining child routes

<KawaikoNote variant="surprise" title="Implementation complete!">

We've completed a simple router.
With about 100 lines of code, we've achieved SPA routing.
This should be a good starting point for understanding how Vue Router works.

</KawaikoNote>

## Summary

The chibivue-router implementation consists of:

1. **History API wrapper**: Abstract browser history operations with `createWebHistory`
2. **Reactive state management**: Manage current route with `ref`
3. **Dependency Injection**: Share router information throughout the component tree via `provide/inject`
4. **RouterView component**: Dynamically display components corresponding to the current route
5. **Composition API hooks**: Easy access with `useRouter` and `useRoute`

By combining Vue's plugin system, provide/inject, and reactivity system, we've achieved client-side routing.
