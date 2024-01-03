import { type ComputedRef, inject } from 'chibivue'
import { routeLocationKey, routerKey } from './injectionSymbols'
import { Router } from './router'
import { RouteLocationNormalizedLoaded } from './types'

export function useRouter(): Router {
  return inject(routerKey)!
}

export function useRoute(): ComputedRef<RouteLocationNormalizedLoaded> {
  return inject(routeLocationKey)!
}
