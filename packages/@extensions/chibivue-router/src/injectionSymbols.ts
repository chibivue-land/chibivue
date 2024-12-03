import type { ComputedRef, InjectionKey, Ref } from '@chibivue/runtime-core'
import type { Router } from './router'
import type { RouteLocationNormalizedLoaded } from './types'

export const routerKey = Symbol() as InjectionKey<Router>

export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>

export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>
