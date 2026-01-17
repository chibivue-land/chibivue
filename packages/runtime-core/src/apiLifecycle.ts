import type { VaporComponentInternalInstance } from "@chibivue/runtime-vapor";
import { type ComponentInternalInstance, currentInstance, setCurrentInstance } from "./component";
import { LifecycleHooks } from "./enums";

export function injectHook(
  type: LifecycleHooks,
  hook: Function,
  target: ComponentInternalInstance | VaporComponentInternalInstance | null = currentInstance,
): Function | undefined {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = (...args: unknown[]) => {
      setCurrentInstance(target);
      const res = hook(...args);
      return res;
    };
    hooks.push(wrappedHook);
    return wrappedHook;
  }
}

export const createHook =
  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>
  (
    hook: T,
    target: ComponentInternalInstance | VaporComponentInternalInstance | null = currentInstance,
  ): Function | undefined =>
    injectHook(lifecycle, (...args: unknown[]) => hook(...args), target);

type LifecycleHookFn<T extends Function = () => any> = (
  hook: T,
  target?: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => Function | undefined;

export const onBeforeMount: LifecycleHookFn = createHook(LifecycleHooks.BEFORE_MOUNT);
export const onMounted: LifecycleHookFn = createHook(LifecycleHooks.MOUNTED);
export const onBeforeUpdate: LifecycleHookFn = createHook(LifecycleHooks.BEFORE_UPDATE);
export const onUpdated: LifecycleHookFn = createHook(LifecycleHooks.UPDATED);
export const onBeforeUnmount: LifecycleHookFn = createHook(LifecycleHooks.BEFORE_UNMOUNT);
export const onUnmounted: LifecycleHookFn = createHook(LifecycleHooks.UNMOUNTED);
