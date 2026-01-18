import { hasOwn } from "@chibivue/shared";
import type { ComponentInternalInstance, Data } from "./component";
import type { EmitFn, EmitsOptions } from "./componentEmits";
import type {
  ComponentInjectOptions,
  ComputedOptions,
  ExtractComputedReturns,
  InjectToObject,
  MethodOptions,
  ResolveProps,
} from "./componentOptions";
import type { SlotsType, UnwrapSlotsType } from "./componentSlots";
import type { nextTick } from "./scheduler";

export type ComponentPublicInstanceConstructor<
  T extends ComponentPublicInstance<Props, RawBindings, D, C, M, I, S, E, EE> =
    ComponentPublicInstance<any>,
  Props = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = any,
  M extends MethodOptions = MethodOptions,
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  E extends EmitsOptions = {},
  EE extends string = string,
> = {
  new (...args: any[]): T;
};

export type CreateComponentPublicInstance<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  E extends EmitsOptions = {},
  EE extends string = string,
> = ComponentPublicInstance<P, B, D, C, M, I, S, E, EE>;

export type ComponentPublicInstance<
  P = {},
  B = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = MethodOptions,
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  E extends EmitsOptions = {},
  _EE extends string = string,
> = {
  $: ComponentInternalInstance;
  $data: D;
  $props: ResolveProps<P>;
  $slots: UnwrapSlotsType<S>;
  $parent: ComponentPublicInstance | null;
  $emit: EmitFn<E>;
  $el: any;
  $forceUpdate: () => void;
  $nextTick: typeof nextTick;
} & P &
  B &
  D &
  M &
  ExtractComputedReturns<C> &
  InjectToObject<I>;

export interface ComponentRenderContext {
  [key: string]: any;
  _: ComponentInternalInstance;
}

const hasSetupBinding = (state: Data, key: string) => hasOwn(state, key);

export const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get({ _: instance }: ComponentRenderContext, key: string) {
    const { ctx, setupState, data, props } = instance;

    let normalizedProps;
    if (hasSetupBinding(setupState, key)) {
      return setupState[key];
    } else if (hasOwn(data, key)) {
      return data[key];
    } else if ((normalizedProps = instance.propsOptions) && hasOwn(normalizedProps, key)) {
      return props![key];
    } else if (hasOwn(ctx, key)) {
      return ctx[key];
    }
  },
  set({ _: instance }: ComponentRenderContext, key: string, value: any): boolean {
    const { ctx, data, setupState } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    } else if (hasOwn(data, key)) {
      data[key] = value;
    } else if (hasOwn(ctx, key)) {
      ctx[key] = value;
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
