import { hasOwn } from "../shared";
import type { ComponentInternalInstance, Data } from "./component";

export type ComponentPublicInstanceConstructor<
  T extends ComponentPublicInstance<Props, RawBindings> = ComponentPublicInstance<any>,
  Props = any,
  RawBindings = any,
> = {
  new (...args: any[]): T;
};

export type ComponentPublicInstance<P = {}, B = {}> = {
  $: ComponentInternalInstance;
} & P &
  B;

export interface ComponentRenderContext {
  [key: string]: any;
  _: ComponentInternalInstance;
}

const hasSetupBinding = (state: Data, key: string) => hasOwn(state, key);

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    const { setupState, props } = instance;

    let normalizedProps;
    if (hasSetupBinding(setupState, key)) {
      return setupState[key];
    } else if ((normalizedProps = instance.propsOptions) && hasOwn(normalizedProps, key)) {
      return props![key];
    }
  },
  set({ _: instance }: ComponentRenderContext, key: string, value: any): boolean {
    const { setupState } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    }
    return true;
  },

  has({ _: { setupState, ctx, propsOptions } }: ComponentRenderContext, key: string) {
    let normalizedProps;
    return (
      hasOwn(setupState, key) ||
      ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
      hasOwn(ctx, key)
    );
  },
};
