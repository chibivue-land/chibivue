import type { ReactiveEffect } from "../reactivity";
import type { ComponentOptions } from "./componentOptions";
import type { VNode, VNodeChild } from "./vnode";

export type Component = ComponentOptions;

export interface ComponentInternalInstance {
  type: Component;
  vnode: VNode;
  subTree: VNode;
  next: VNode | null;
  effect: ReactiveEffect;
  render: InternalRenderFunction;
  update: () => void;
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
    isMounted: false,
  };

  return instance;
}
