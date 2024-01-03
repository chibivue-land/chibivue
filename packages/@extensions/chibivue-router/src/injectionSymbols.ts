import type { ComputedRef, InjectionKey, Ref } from '@chibivue/runtime-core'
import { Router } from './router'
import { RouteLocationNormalizedLoaded } from './types'

export const routerKey = Symbol() as InjectionKey<Router>

export const routeLocationKey = Symbol() as InjectionKey<
  ComputedRef<RouteLocationNormalizedLoaded>
>

export const routerViewLocationKey = Symbol() as InjectionKey<
  Ref<RouteLocationNormalizedLoaded>
>
