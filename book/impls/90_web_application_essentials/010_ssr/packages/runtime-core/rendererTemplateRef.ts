import type { Ref } from "../reactivity";
import { ShapeFlags } from "../shared/shapeFlags";
import { getExposeProxy } from "./component";
import type { VNode } from "./vnode";

export function setRef(rawRef: Ref, vnode: VNode) {
  const { shapeFlag } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    rawRef.value = getExposeProxy(vnode.component!) || vnode.component!.proxy;
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    rawRef.value = vnode.el;
  }
}
