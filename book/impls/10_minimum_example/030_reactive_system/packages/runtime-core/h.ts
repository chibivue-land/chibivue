import type { VNode, VNodeProps } from "./vnode";

export function h(type: string, props: VNodeProps, children: (VNode | string)[]) {
  return { type, props, children };
}
