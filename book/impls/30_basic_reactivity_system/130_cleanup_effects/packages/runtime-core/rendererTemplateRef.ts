import { Ref } from '../reactivity'
import { ShapeFlags } from '../shared/shapeFlags'
import { VNode } from './vnode'

export function setRef(rawRef: Ref, vnode: VNode) {
  const { shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.COMPONENT) {
    rawRef.value = vnode.component?.setupState // TODO: proxy
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    rawRef.value = vnode.el
  }
}
