import type { VaporComponentInternalInstance } from '@chibivue/runtime-vapor'
import {
  type ComponentInternalInstance,
  currentInstance,
  setCurrentInstance,
} from './component'
import { LifecycleHooks } from './enums'

export function injectHook(
  type: LifecycleHooks,
  hook: Function,
  target:
    | ComponentInternalInstance
    | VaporComponentInternalInstance
    | null = currentInstance,
): Function | undefined {
  if (target) {
    const hooks = target[type] || (target[type] = [])
    const wrappedHook = (...args: unknown[]) => {
      setCurrentInstance(target)
      const res = hook(...args)
      return res
    }
    hooks.push(wrappedHook)
    return wrappedHook
  }
}

export const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
  (
    hook: T,
    target:
      | ComponentInternalInstance
      | VaporComponentInternalInstance
      | null = currentInstance,
  ) =>
    injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)
