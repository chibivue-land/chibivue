import type { ComponentPublicInstance } from "./componentPublicInstance";
import { type Fragment, type VNodeProps, createVNode } from "./vnode";

export function h(
  type: string | ComponentPublicInstance | typeof Fragment,
  props: VNodeProps,
  children: any,
) {
  return createVNode(type, props, children);
}
