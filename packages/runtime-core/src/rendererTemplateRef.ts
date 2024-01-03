import type { Ref } from '@chibivue/reactivity'
import { ShapeFlags } from '@chibivue/shared'
import type { VNode } from './vnode'

export function setRef(rawRef: Ref, vnode: VNode) {
  const { shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.COMPONENT) {
    rawRef.value = vnode.component?.setupState // TODO: proxy
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    rawRef.value = vnode.el
  }
}
