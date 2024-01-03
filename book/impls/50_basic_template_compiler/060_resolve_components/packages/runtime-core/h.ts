import { ComponentPublicInstance } from './componentPublicInstance'
import { Fragment, VNodeProps, createVNode } from './vnode'

export function h(
  type: string | ComponentPublicInstance | typeof Fragment,
  props: VNodeProps,
  children: any,
) {
  return createVNode(type, props, children)
}
