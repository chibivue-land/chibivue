import type { Ref } from '../reactivity'
import { isArray, isObject, isString } from '../shared'
import { ShapeFlags } from '../shared/shapeFlags'
import type { ComponentInternalInstance } from './component'

export type VNodeTypes = string | typeof Text | object

export const Text = Symbol()

export interface VNode<HostNode = any> {
  type: VNodeTypes
  props: VNodeProps | null
  children: VNodeNormalizedChildren

  el: HostNode | undefined
  key: string | number | symbol | null
  ref: Ref | null

  component: ComponentInternalInstance | null
  shapeFlag: number
}

export interface VNodeProps {
  [key: string]: any
}

export type VNodeNormalizedChildren = string | VNodeArrayChildren
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren
type VNodeChildAtom = VNode | string

export function createVNode(
  type: VNodeTypes,
  props: VNodeProps | null,
  children: VNodeNormalizedChildren,
): VNode {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.COMPONENT
      : 0

  const vnode: VNode = {
    type,
    props,
    children: children,
    el: undefined,
    key: props?.key ?? null,
    ref: props?.ref ?? null,
    component: null,
    shapeFlag,
  }
  normalizeChildren(vnode, children)
  return vnode
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (typeof child === 'object') {
    return { ...child } as VNode
  } else {
    return createVNode(Text, null, String(child))
  }
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
