import type { Ref } from "../reactivity";
import { isArray, isFunction, isObject, isString } from "../shared";
import { normalizeClass, normalizeStyle } from "../shared/normalizeProp";
import { ShapeFlags } from "../shared/shapeFlags";
import type { AppContext } from "./apiCreateApp";
import type { Component, ComponentInternalInstance, Data } from "./component";

import type { RawSlots } from "./componentSlots";

export const Fragment = Symbol();
export const Text = Symbol();
export const Comment = Symbol();

export type VNodeTypes = string | Component | typeof Text | typeof Comment | typeof Fragment;

export interface VNode<HostNode = any> {
  __v_isVNode: true;
  type: VNodeTypes;
  props: VNodeProps | null;
  children: VNodeNormalizedChildren;

  el: HostNode | undefined;
  anchor: HostNode | null; // fragment anchor
  key: string | number | symbol | null;
  ref: Ref | null;

  component: ComponentInternalInstance | null;
  shapeFlag: number;

  // application root node only
  appContext: AppContext | null;

  // directives
  dirs?: DirectiveBinding[] | null;
}

export interface DirectiveBinding<V = any> {
  instance: ComponentInternalInstance | null;
  value: V;
  oldValue: V | null;
  arg?: string;
  modifiers: Record<string, boolean>;
  dir: ObjectDirective<any, V>;
}

export interface ObjectDirective<T = any, V = any> {
  created?: DirectiveHook<T, null, V>;
  beforeMount?: DirectiveHook<T, null, V>;
  mounted?: DirectiveHook<T, null, V>;
  beforeUpdate?: DirectiveHook<T, VNode<T>, V>;
  updated?: DirectiveHook<T, VNode<T>, V>;
  beforeUnmount?: DirectiveHook<T, null, V>;
  unmounted?: DirectiveHook<T, null, V>;
  getSSRProps?: (binding: DirectiveBinding<V>, vnode: VNode) => Record<string, unknown> | undefined;
}

export type DirectiveHook<T = any, Prev = VNode<T> | null, V = any> = (
  el: T,
  binding: DirectiveBinding<V>,
  vnode: VNode<T>,
  prevVNode: Prev,
) => void;

export interface VNodeProps {
  [key: string]: any;
}

export type VNodeNormalizedChildren = string | VNodeArrayChildren | RawSlots;
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export type VNodeChild = VNodeChildAtom | VNodeArrayChildren;
type VNodeChildAtom = VNode | string;

export function createVNode(type: VNodeTypes, props: VNodeProps | null, children: any): VNode {
  const shapeFlag = isString(type) ? ShapeFlags.ELEMENT : isObject(type) ? ShapeFlags.COMPONENT : 0;

  const vnode: VNode = {
    __v_isVNode: true,
    type,
    props,
    children: children,
    el: undefined,
    anchor: null,
    key: props?.key ?? null,
    ref: props?.ref ?? null,
    component: null,
    shapeFlag,
    appContext: null,
    dirs: null,
  };

  normalizeChildren(vnode, children);

  return vnode;
}

export function createCommentVNode(text: string = ""): VNode {
  return createVNode(Comment, null, text);
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0;
  const { shapeFlag } = vnode;

  if (children == null) {
    children = null;
  } else if (isFunction(children)) {
    children = { default: children };
    type = ShapeFlags.SLOTS_CHILDREN;
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN;
  } else if (typeof children === "object") {
    if (shapeFlag & ShapeFlags.ELEMENT) {
      return;
    } else {
      type = ShapeFlags.SLOTS_CHILDREN;
    }
  } else {
    children = String(children);
    type = ShapeFlags.TEXT_CHILDREN;
  }
  vnode.children = children as VNodeNormalizedChildren;
  vnode.shapeFlag |= type;
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (child == null || typeof child === "boolean") {
    return createVNode(Comment, null, "");
  } else if (isArray(child)) {
    return createVNode(Fragment, null, child.slice());
  } else if (typeof child === "object") {
    return cloneIfMounted(child as VNode);
  } else {
    return createVNode(Text, null, String(child));
  }
}

function cloneIfMounted(child: VNode): VNode {
  return child.el === null ? child : { ...child, __v_isVNode: true } as VNode;
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key;
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false;
}

export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret: Data = {};
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i];
    for (const key in toMerge) {
      if (key === "class") {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === "style") {
        ret.style = normalizeStyle([ret.style, toMerge.style]);
      } else if (key !== "") {
        ret[key] = toMerge[key];
      } /*if (isOn(key))*/ else {
        // TODO: v-on="object"
      }
    }
  }
  return ret;
}
