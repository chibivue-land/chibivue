import { type VaporComponentInternalInstance, isVapor } from "@chibivue/runtime-vapor";
import { EffectScope, type ReactiveEffect, proxyRefs } from "@chibivue/reactivity";
import { isFunction, isObject } from "@chibivue/shared";

import { type AppContext, createAppContext } from "./apiCreateApp";
import { type EmitFn, type EmitsOptions, type ObjectEmitsOptions, emit } from "./componentEmits";
import { type ComponentOptions, applyOptions } from "./componentOptions";
import { type NormalizedProps, initProps } from "./componentProps";
import {
  type ComponentPublicInstance,
  PublicInstanceProxyHandlers,
} from "./componentPublicInstance";
import {
  type InternalSlots,
  type SlotsType,
  type UnwrapSlotsType,
  initSlots,
} from "./componentSlots";
import { LifecycleHooks } from "./enums";
import type { VNode, VNodeChild } from "./vnode";

export type Data = Record<string, unknown>;

export type Component = ConcreteComponent;
export type ConcreteComponent = ComponentOptions;

export type LifecycleHook<TFn = Function> = TFn[] | null;

export interface ComponentInternalInstance {
  uid: number;
  type: ConcreteComponent;
  appContext: AppContext;
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null;

  vnode: VNode;
  next: VNode | null;

  proxy: ComponentPublicInstance | null;
  effect: ReactiveEffect;
  scope: EffectScope;

  components: Record<string, ConcreteComponent> | null;

  propsOptions: NormalizedProps;
  emitsOptions: ObjectEmitsOptions | null;

  subTree: VNode;
  render: InternalRenderFunction | null;
  update: () => void;

  provides: Data;

  exposed: Record<string, any> | null;
  exposeProxy: Record<string, any> | null;
  ctx: Data;
  data: Data;
  props: Data;
  slots: InternalSlots;
  emit: EmitFn;

  setupState: Data;
  setupContext: SetupContext | null;

  // lifecycle
  isMounted: boolean;
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook;
  [LifecycleHooks.UPDATED]: LifecycleHook;
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook;
  [LifecycleHooks.UNMOUNTED]: LifecycleHook;
}

export type SetupContext<E = EmitsOptions, S extends SlotsType = {}> = {
  slots: UnwrapSlotsType<S>;
  emit: EmitFn<E>;
  expose: (exposed?: Record<string, any>) => void;
};

export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    $data: ComponentInternalInstance["data"],
    $options: ComponentInternalInstance["ctx"],
  ): VNodeChild;
};

let uid = 0;
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null,
): ComponentInternalInstance {
  const type = vnode.type as ConcreteComponent;
  const appContext = (parent ? parent.appContext : vnode.appContext) || createAppContext();

  const instance: ComponentInternalInstance = {
    uid: uid++,
    type,
    parent,
    vnode,
    appContext,
    next: null,
    proxy: null,
    effect: null!,
    scope: new EffectScope(),
    subTree: null!,
    update: null!,
    render: null!,

    provides: parent ? parent.provides : Object.create(appContext.provides),
    components: null,
    propsOptions: type.props || {},
    emitsOptions: type.emits || {},
    emit: null!, // to be set immediately

    exposed: null,
    exposeProxy: null,
    ctx: {},
    data: {},
    props: {},
    slots: {},

    setupState: {},
    setupContext: null,

    isMounted: false,
    [LifecycleHooks.BEFORE_MOUNT]: null,
    [LifecycleHooks.MOUNTED]: null,
    [LifecycleHooks.BEFORE_UPDATE]: null,
    [LifecycleHooks.UPDATED]: null,
    [LifecycleHooks.BEFORE_UNMOUNT]: null,
    [LifecycleHooks.UNMOUNTED]: null,
  };

  instance.ctx = { _: instance };
  instance.emit = emit.bind(null, instance);

  return instance;
}

export let currentInstance: ComponentInternalInstance | VaporComponentInternalInstance | null =
  null;
export const getCurrentInstance: () =>
  | ComponentInternalInstance
  | VaporComponentInternalInstance
  | null = () => currentInstance;

export const setCurrentInstance = (
  instance: ComponentInternalInstance | VaporComponentInternalInstance,
): void => {
  currentInstance = instance;
  if (isVapor(instance)) {
    // do nothing
  } else {
    instance.scope?.on();
  }
};

export const unsetCurrentInstance = (): void => {
  if (currentInstance && isVapor(currentInstance)) {
    // do nothing
  } else {
    currentInstance && currentInstance.scope?.off();
  }
  currentInstance = null;
};

export const setupComponent = (instance: ComponentInternalInstance): void => {
  const { props, children } = instance.vnode;
  initProps(instance, props);
  initSlots(instance, children);

  const Component = instance.type as ComponentOptions;

  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);

  // Composition API
  const { setup } = Component;
  if (setup) {
    const setupContext = (instance.setupContext = createSetupContext(instance));
    setCurrentInstance(instance);
    const setupResult = setup(instance.props, setupContext);
    if (isFunction(setupResult)) {
      instance.render = setupResult as InternalRenderFunction;
    } else if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult);
    }
    unsetCurrentInstance();
  }

  if (compile && !Component.render) {
    const template = Component.template ?? "";
    if (template) {
      instance.render = compile(template);
    }
  }

  if (Component.render) {
    instance.render = Component.render as any;
  }

  // Options API
  setCurrentInstance(instance);
  applyOptions(instance);
  unsetCurrentInstance();
};

export function getExposeProxy(
  instance: ComponentInternalInstance,
): Record<string, any> | undefined {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(instance.exposed), {
        get(target, key: string) {
          if (key in target) {
            return target[key];
          }
        },
        has(target, key: string) {
          return key in target;
        },
      }))
    );
  }
}

type CompileFunction = (template: string | object) => InternalRenderFunction;
let compile: CompileFunction | undefined;

export function registerRuntimeCompiler(_compile: any): void {
  compile = _compile;
}

export function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  const expose: SetupContext["expose"] = (exposed) => {
    instance.exposed = exposed || {};
  };
  return { slots: instance.slots, emit: instance.emit, expose };
}
