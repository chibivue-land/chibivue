import {
  type VaporComponentInternalInstance,
  createVaporComponentInstance,
  initialRenderVaporComponent,
} from "@chibivue/runtime-vapor";
import { ReactiveEffect } from "@chibivue/reactivity";
import { ShapeFlags, invokeArrayFns, isFunction } from "@chibivue/shared";

import { createAppAPI } from "./apiCreateApp";
import {
  type ComponentInternalInstance,
  type Data,
  createComponentInstance,
  setupComponent,
} from "./component";
import { updateProps } from "./componentProps";
import { updateSlots } from "./componentSlots";
import { renderComponentRoot } from "./componentRenderUtils";
import { invokeDirectiveHook } from "./directives";
import { setRef } from "./rendererTemplateRef";
import {
  type SchedulerJob,
  flushPostFlushCbs,
  flushPreFlushCbs,
  queueJob,
  queuePostFlushCb,
} from "./scheduler";
import {
  Comment,
  Fragment,
  Text,
  type VNode,
  type VNodeArrayChildren,
  isSameVNodeType,
  normalizeVNode,
} from "./vnode";
import {
  isTeleport,
  Teleport,
  type TeleportInternals,
  type TeleportVNode,
} from "./components/Teleport";
import { isKeepAlive, type KeepAliveContext } from "./components/KeepAlive";

export type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

export interface RendererOptions<HostNode = RendererNode, HostElement = RendererElement> {
  patchProp(el: HostElement, key: string, prevValue: any, nextValue: any): void;

  insert(parentNode: HostNode, newNode: HostNode, anchor?: HostNode | null): void;
  remove(child: HostNode): void;

  createElement(tagName: string): HostElement;
  createComment(text: string): HostNode;
  createText(text: string): Text;

  setText(node: HostNode, text: string): void;
  setElementText(node: HostElement, text: string): void;

  parentNode(node: HostNode): HostNode | null;
  nextSibling(node: HostNode): HostNode | null;

  querySelector?(selector: string): HostElement | null;
}

// Renderer Node can technically be any object in the context of core renderer
// logic - they are never directly operated on and always passed to the node op
// functions provided via options, so the internal constraint is really just
// a generic object.
export interface RendererNode {
  [key: string]: any;
}

export interface RendererElement extends RendererNode {}

// These functions are created inside a closure and therefore their types cannot
// be directly exported. In order to avoid maintaining function signatures in
// two places, we declare them once here and use them inside the closure.
type PatchFn = (
  n1: VNode | null, // null means this is a mount
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

type ProcessVaporComponentFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

type ProcessTextOrCommentFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
) => void;

type MountChildrenFn = (
  children: VNodeArrayChildren,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

type PatchChildrenFn = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

type MoveFn = (vnode: VNode, container: RendererElement, anchor: RendererNode | null) => void;

type MountComponentFn = (
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
) => void;

type NextFn = (vnode: VNode) => RendererNode | null;

type UnmountFn = (vnode: VNode, parentComponent?: ComponentInternalInstance) => void;
type RemoveFn = (vnode: VNode) => void;

type UnmountChildrenFn = (children: VNode[]) => void;

type SetupRenderEffectFn = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
) => void;

export interface Renderer {
  render: RootRenderFunction;
  createApp: ReturnType<typeof createAppAPI>;
}

// implementation
export function createRenderer(options: RendererOptions): Renderer {
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
  } = options;

  const patch: PatchFn = (n1, n2, container, anchor, parentComponent = null) => {
    if (n1 === n2) {
      return;
    }

    // patching & not same type, unmount old tree
    if (n1 && !isSameVNodeType(n1, n2)) {
      // If the old vnode will be kept alive, its element will be moved to storage,
      // so we can't use it or its siblings as anchor. Use the passed anchor instead.
      const willBeKeptAlive = n1.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
      if (!willBeKeptAlive) {
        anchor = getNextHostNode(n1);
      }
      unmount(n1, parentComponent as ComponentInternalInstance);
      n1 = null;
    }

    const { type, ref, shapeFlag } = n2;
    if (isFunction(type)) {
      processVaporComponent(n1, n2, container, anchor, parentComponent);
    } else if (type === Text) {
      processText(n1, n2, container, anchor);
    } else if (type === Comment) {
      processCommentNode(n1, n2, container, anchor);
    } else if (type === Fragment) {
      processFragment(n1, n2, container, anchor, parentComponent);
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      (type as typeof Teleport).process(
        n1 as TeleportVNode,
        n2 as TeleportVNode,
        container,
        anchor,
        parentComponent as ComponentInternalInstance,
        internals,
      );
    } else if (shapeFlag & ShapeFlags.ELEMENT) {
      processElement(n1, n2, container, anchor, parentComponent);
    } else if (shapeFlag & ShapeFlags.COMPONENT) {
      processComponent(n1, n2, container, anchor, parentComponent);
    }

    if (ref) {
      setRef(ref, n2);
    }
  };

  const processVaporComponent: ProcessVaporComponentFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
  ) => {
    if (n1 == null) {
      mountVaporComponent(n2, container, anchor, parentComponent);
    } else {
      // do nothing
      // reactivity patch
    }
  };

  const mountVaporComponent = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    const instance = createVaporComponentInstance(vnode, parentComponent);
    const el = (vnode.el = initialRenderVaporComponent(instance));
    const { bm, m } = instance;
    if (bm) invokeArrayFns(bm);
    hostInsert(el, container, anchor);
    instance.isMounted = true;
    if (m) queuePostFlushCb(m);
  };

  const processText: ProcessTextOrCommentFn = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateText(n2.children as string)), container, anchor!);
    } else {
      const el = (n2.el = n1.el!);
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string);
      }
    }
  };

  const processCommentNode = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererElement | null,
  ) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateComment((n2.children as string) || "")), container, anchor);
    } else {
      n2.el = n1.el;
    }
  };

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    if (n1 == null) {
      mountElement(n2, container, anchor, parentComponent);
    } else {
      patchElement(n1, n2, parentComponent);
    }
  };

  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    let el: RendererElement;
    const { type, props, shapeFlag, dirs } = vnode;

    el = vnode.el = hostCreateElement(type as string);

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children as VNodeArrayChildren, el, null, parentComponent);
    }

    dirs && invokeDirectiveHook(vnode, null, "created");

    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }

    dirs && invokeDirectiveHook(vnode, null, "beforeMount");
    hostInsert(el, container, anchor!);
    dirs && invokeDirectiveHook(vnode, null, "mounted");
  };

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    const el = (n2.el = n1.el!);
    const { dirs } = n2;

    const oldProps = n1.props ?? {};
    const newProps = n2.props ?? {};

    dirs && invokeDirectiveHook(n2, n1, "beforeUpdate");
    patchChildren(n1, n2, el, null, parentComponent);
    patchProps(el, oldProps, newProps);
    dirs && invokeDirectiveHook(n2, n1, "updated");
  };

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null = null,
  ) => {
    if (n1 == null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        (parentComponent as KeepAliveContext).activate(
          n2,
          container,
          anchor,
          parentComponent as ComponentInternalInstance,
        );
      } else {
        mountComponent(n2, container, anchor, parentComponent);
      }
    } else {
      updateComponent(n1, n2);
    }
  };

  const patchProps = (el: RendererElement, oldProps: Data, newProps: Data) => {
    for (const key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
    for (const key in newProps) {
      const next = newProps[key];
      const prev = oldProps[key];
      // defer patching value
      if (next !== prev) {
        hostPatchProp(el, key, prev, next);
      }
    }
  };

  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(""))!;
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(""))!;

    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor);
      hostInsert(fragmentEndAnchor, container, anchor);
      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
      );
    } else {
      patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent);
    }
  };

  const mountChildren: MountChildrenFn = (children, container, anchor, parentComponent) => {
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]));
      patch(null, child, container, anchor, parentComponent);
    }
  };

  const mountComponent: MountComponentFn = (initialVNode, container, anchor, parentComponent) => {
    // prettier-ignore
    const instance: ComponentInternalInstance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent));

    if (isKeepAlive(initialVNode)) {
      (instance as KeepAliveContext).renderer = {
        p: patch,
        m: move,
        um: unmount,
        o: options,
      };
    }

    setupComponent(instance);
    setupRenderEffect(instance, initialVNode, container, anchor);
  };

  const updateComponent = (n1: VNode, n2: VNode) => {
    const instance = (n2.component = n1.component)!;
    instance.next = n2;
    instance.update();
  };

  const setupRenderEffect: SetupRenderEffectFn = (instance, initialVNode, container, anchor) => {
    const componentUpdateFn = () => {
      const { bm, m, bu, u } = instance;

      if (!instance.isMounted) {
        // beforeMount hook
        if (bm) {
          invokeArrayFns(bm);
        }

        const subTree = (instance.subTree = renderComponentRoot(instance));
        patch(null, subTree, container, anchor, instance);
        initialVNode.el = subTree.el;
        instance.isMounted = true;

        // mounted hook
        if (m) {
          queuePostFlushCb(m);
        }
      } else {
        let { next, vnode } = instance;

        // beforeUpdate hook
        if (bu) {
          invokeArrayFns(bu);
        }

        if (next) {
          next.el = vnode.el;
          updateComponentPreRender(instance, next);
        } else {
          next = vnode;
        }

        const prevTree = instance.subTree;
        const nextTree = renderComponentRoot(instance);
        instance.subTree = nextTree;

        // If prevTree will be kept alive, its element will be moved to storage,
        // so we can't use it as anchor reference. Use null instead.
        const prevTreeWillBeKeptAlive = prevTree.shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
        const anchor = prevTreeWillBeKeptAlive ? null : getNextHostNode(prevTree);

        patch(prevTree, nextTree, hostParentNode(prevTree.el!)!, anchor, instance);
        next.el = nextTree.el;

        // updated hook
        if (u) {
          queuePostFlushCb(u);
        }
      }
    };
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(update),
      instance.scope,
    ));
    const update: SchedulerJob = (instance.update = () => effect.run());
    update.id = instance.uid;

    update();
  };

  const updateComponentPreRender = (instance: ComponentInternalInstance, nextVNode: VNode) => {
    nextVNode.component = instance;
    instance.vnode = nextVNode;
    instance.next = null;
    updateProps(instance, nextVNode.props);
    updateSlots(instance, nextVNode.children);
    flushPreFlushCbs();
  };

  const patchChildren: PatchChildrenFn = (n1, n2, container, anchor, parentComponent) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const { shapeFlag } = n2;

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[]);
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          patchKeyedChildren(c1 as VNode[], c2 as VNode[], container, anchor, parentComponent);
        } else {
          // no new children, just unmount old
          unmountChildren(c1 as VNode[]);
        }
      } else {
        // prev children was text OR null
        // new children is array OR null
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, "");
        }
        // mount new if array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2 as VNodeArrayChildren, container, anchor, parentComponent);
        }
      }
    }
  };

  // can be all-keyed or mixed
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNode[],
    container: RendererElement,
    parentAnchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | VaporComponentInternalInstance | null,
  ) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1; // prev ending index
    let e2 = l2 - 1; // next ending index

    // 1. sync from start
    // (a b) c
    // (a b) d e
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = (c2[i] = normalizeVNode(c2[i]));
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      i++;
    }

    // 2. sync from end
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = (c2[i] = normalizeVNode(c2[i]));
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, null, parentComponent);
      } else {
        break;
      }
      e1--;
      e2--;
    }

    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1;
        const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor;
        while (i <= e2) {
          patch(null, (c2[i] = normalizeVNode(c2[i])), container, anchor, parentComponent);
          i++;
        }
      }
    }

    // 4. common sequence + unmount
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    }

    // 5. unknown sequence
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      const s1 = i; // prev starting index
      const s2 = i; // next starting index

      // 5.1 build key:index map for newChildren
      const keyToNewIndexMap: Map<string | number | symbol, number> = new Map();
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = normalizeVNode(c2[i]));
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }

      // 5.2 loop through old children left to be patched and try to patch
      // matching nodes & remove nodes that are no longer present
      let j;
      let patched = 0;
      const toBePatched = e2 - s2 + 1;
      let moved = false;
      // used to track whether any node has moved
      let maxNewIndexSoFar = 0;
      // works as Map<newIndex, oldIndex>
      // Note that oldIndex is offset by +1
      // and oldIndex = 0 is a special value indicating the new node has
      // no corresponding old node.
      // used for determining longest stable subsequence
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;

      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i];
        if (patched >= toBePatched) {
          // all new children have been patched so this can only be a removal
          unmount(prevChild);
          continue;
        }
        let newIndex;
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key);
        } else {
          // key-less node, try to locate a key-less node of the same type
          for (j = s2; j <= e2; j++) {
            if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j] as VNode)) {
              newIndex = j;
              break;
            }
          }
        }
        if (newIndex === undefined) {
          unmount(prevChild);
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(prevChild, c2[newIndex] as VNode, container, null, parentComponent);
          patched++;
        }
      }

      // 5.3 move and mount
      // generate longest stable subsequence only when nodes have moved
      const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : [];
      j = increasingNewIndexSequence.length - 1;
      // looping backwards so that we can use last patched node as anchor
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i;
        const nextChild = c2[nextIndex] as VNode;
        const anchor = nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor;
        if (newIndexToOldIndexMap[i] === 0) {
          // mount new
          patch(null, nextChild, container, anchor, parentComponent);
        } else if (moved) {
          // move if:
          // There is no stable subsequence (e.g. a reverse)
          // OR current node is not among the stable sequence
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor);
          } else {
            j--;
          }
        }
      }
    }
  };

  const move: MoveFn = (vnode, container, anchor) => {
    const { type, children, el, shapeFlag } = vnode;
    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component!.subTree, container, anchor);
      return;
    }

    if (shapeFlag & ShapeFlags.TELEPORT) {
      (type as typeof Teleport).move(vnode as TeleportVNode, container, anchor, internals);
      return;
    }

    if (type === Fragment) {
      hostInsert(el!, container, anchor);
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, anchor);
      }
      hostInsert(vnode.anchor!, container, anchor);
      return;
    }

    hostInsert(el!, container, anchor!);
  };

  const unmount: UnmountFn = (vnode, parentComponent?: ComponentInternalInstance) => {
    const { type, shapeFlag, children } = vnode;

    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      (parentComponent as KeepAliveContext).deactivate(vnode);
      return;
    }

    if (shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode.component!);
    } else if (shapeFlag & ShapeFlags.TELEPORT) {
      (type as typeof Teleport).remove(vnode as TeleportVNode, internals);
      return;
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      unmountChildren(children as VNode[]);
    }
    remove(vnode);
  };

  const remove: RemoveFn = (vnode) => {
    const { el, type, anchor } = vnode;
    if (type === Fragment) {
      removeFragment(el!, anchor!);
    }

    hostRemove(el!);
  };

  const removeFragment = (cur: RendererNode, end: RendererNode) => {
    let next;
    while (cur !== end) {
      next = hostNextSibling(cur)!;
      hostRemove(cur);
      cur = next;
    }
    hostRemove(end);
  };

  const unmountComponent = (instance: ComponentInternalInstance) => {
    const { subTree, scope, bum, um } = instance;

    // beforeUnmount hook
    if (bum) {
      invokeArrayFns(bum);
    }

    scope.stop();
    unmount(subTree);

    // unmounted hook
    if (um) {
      queuePostFlushCb(um);
    }
  };

  const unmountChildren: UnmountChildrenFn = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  const getNextHostNode: NextFn = (vnode) => {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      return getNextHostNode(vnode.component!.subTree);
    }
    return hostNextSibling(vnode.el!);
  };

  const internals: TeleportInternals = {
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchChildren,
    um: unmount,
    m: move,
    o: options,
  };

  const render: RootRenderFunction = (vnode, container, parent) => {
    if (vnode === null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      patch((container as any)._vnode || null, vnode, container, null, parent);
    }
    flushPreFlushCbs();
    flushPostFlushCbs();
    (container as any)._vnode = vnode;
  };

  return {
    render: render,
    createApp: createAppAPI(render),
  };
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
