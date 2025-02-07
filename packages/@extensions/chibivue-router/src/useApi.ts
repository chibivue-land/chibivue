import { type ComputedRef, inject } from 'chibivue'
import { routeLocationKey, routerKey } from './injectionSymbols'
import type { Router } from './router'
import type { RouteLocationNormalizedLoaded } from './types'

export function useRouter(): Router {
  return inject(routerKey)!
}

export function useRoute(): ComputedRef<RouteLocationNormalizedLoaded> {
  return inject(routeLocationKey)!
}
