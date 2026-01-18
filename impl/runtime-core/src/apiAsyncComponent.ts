import { ref } from "@chibivue/reactivity";
import { isFunction, isObject } from "@chibivue/shared";
import type { Component, ComponentInternalInstance } from "./component";
import { currentInstance } from "./component";
import type { VNode } from "./vnode";
import { createVNode } from "./vnode";

export type AsyncComponentResolveResult<T = Component> = T | { default: T };

export type AsyncComponentLoader<T = any> = () => Promise<AsyncComponentResolveResult<T>>;

export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>;
  loadingComponent?: Component;
  errorComponent?: Component;
  delay?: number;
  timeout?: number;
  onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => any;
}

export function defineAsyncComponent<T extends Component = { new (): any }>(
  source: AsyncComponentLoader<T> | AsyncComponentOptions<T>,
): T {
  if (isFunction(source)) {
    source = { loader: source };
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout,
    onError: userOnError,
  } = source;

  let pendingRequest: Promise<Component> | null = null;
  let resolvedComp: Component | undefined;

  let retries = 0;
  const retry = (): Promise<Component> => {
    retries++;
    pendingRequest = null;
    return load();
  };

  const load = (): Promise<Component> => {
    let thisRequest: Promise<Component>;
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch((err: Error) => {
            err = err instanceof Error ? err : new Error(String(err));
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry());
                const userFail = () => reject(err);
                userOnError(err, userRetry, userFail, retries + 1);
              });
            } else {
              throw err;
            }
          })
          .then((comp: AsyncComponentResolveResult) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest;
            }
            if (comp && (comp as any).__esModule) {
              comp = (comp as any).default;
            }
            if (comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`);
            }
            resolvedComp = comp as Component;
            return comp as Component;
          }))
    );
  };

  return {
    name: "AsyncComponentWrapper",
    __asyncLoader: load,
    get __asyncResolved(): Component | undefined {
      return resolvedComp;
    },
    setup() {
      const instance = currentInstance as ComponentInternalInstance;

      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance);
      }

      const onError = (err: Error): void => {
        pendingRequest = null;
        error.value = err;
      };

      const loaded = ref(false);
      const error = ref<Error | undefined>();
      const delayed = ref(!!delay);

      if (delay) {
        setTimeout(() => {
          delayed.value = false;
        }, delay);
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(`Async component timed out after ${timeout}ms.`);
            onError(err);
          }
        }, timeout);
      }

      load()
        .then(() => {
          loaded.value = true;
        })
        .catch((err) => {
          onError(err);
        });

      return (): VNode | null => {
        if (loaded.value && resolvedComp) {
          return createInnerComp(resolvedComp, instance);
        } else if (error.value && errorComponent) {
          return createVNode(errorComponent, { error: error.value });
        } else if (loadingComponent && !delayed.value) {
          return createVNode(loadingComponent);
        }
        return null;
      };
    },
  } as any;
}

function createInnerComp(comp: Component, parent: ComponentInternalInstance): VNode {
  const { props, children } = parent.vnode;
  const vnode = createVNode(comp, props, children);
  return vnode;
}
