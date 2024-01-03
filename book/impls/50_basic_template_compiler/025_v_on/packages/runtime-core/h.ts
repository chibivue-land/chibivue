import { VNodeProps, createVNode } from './vnode'

export function h(type: string | object, props: VNodeProps, children: any) {
  return createVNode(type, props, children)
}
