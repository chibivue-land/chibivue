import { type App, computed, reactive, ref } from 'chibivue'
import {
  routeLocationKey,
  routerKey,
  routerViewLocationKey,
} from './injectionSymbols'
import type { RouterHistory } from './history'
import type { RouteLocationNormalizedLoaded } from './types'
import { RouterViewImpl } from './RouterView'

export interface RouteRecord {
  path: string
  component: any
}

export interface RouterOptions {
  routes: Readonly<RouteRecord[]>
  history: RouterHistory
}

export interface Router {
  install(app: App): void

  push(to: string): void
  replace(to: string): void
}

export function createRouter(options: RouterOptions): Router {
  const routerHistory = options.history
  const resolve = (to: string) => {
    const route = options.routes.find(route => route.path === to)
    return {
      fullPath: to,
      component: route?.component ?? null,
    }
  }

  const currentRoute = ref<RouteLocationNormalizedLoaded>({
    fullPath: routerHistory.location.pathname,
    component: resolve(routerHistory.location.pathname).component,
  })

  function push(to: string) {
    routerHistory.push(to)
    currentRoute.value = resolve(to)
  }

  function replace(to: string) {
    routerHistory.replace(to)
    currentRoute.value = resolve(to)
  }

  const router: Router = {
    push,
    replace,
    install(app: App) {
      const router = this
      app.component('RouterView', RouterViewImpl)

      const reactiveRoute = computed(() => currentRoute.value)
      app.provide(routerKey, router)
      app.provide(routeLocationKey, reactive(reactiveRoute))
      app.provide(routerViewLocationKey, currentRoute)
    },
  }

  return router
}
