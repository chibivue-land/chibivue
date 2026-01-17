import type { ReactiveEffect } from "../reactivity";
import type { ComponentOptions } from "./componentOptions";
import type { Props } from "./componentProps";
import type { VNode, VNodeChild } from "./vnode";

export type Component = ComponentOptions;

export type Data = Record<string, unknown>;

export interface ComponentInternalInstance {
  type: Component;

  vnode: VNode;
  subTree: VNode;
  next: VNode | null;
  effect: ReactiveEffect;
  render: InternalRenderFunction;
  update: () => void;

  propsOptions: Props;
  props: Data;

  isMounted: boolean;
}

export type InternalRenderFunction = {
  (): VNodeChild;
};

export function createComponentInstance(vnode: VNode): ComponentInternalInstance {
  const type = vnode.type as Component;

  const instance: ComponentInternalInstance = {
    type,

    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,

    propsOptions: type.props || {},
    props: {},

    isMounted: false,
  };

  return instance;
}
