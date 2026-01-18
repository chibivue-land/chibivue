import {
  Comment,
  type Component,
  type ComponentInternalInstance,
  type DirectiveBinding,
  Fragment,
  Text,
  type VNode,
  type VNodeArrayChildren,
  type VNodeProps,
  mergeProps,
  createComponentInstance,
  setupComponent,
  setCurrentInstance,
  unsetCurrentInstance,
  normalizeVNode,
} from "@chibivue/runtime-core";
import { ShapeFlags, isArray, isFunction, isPromise, isString } from "@chibivue/shared";
import { ssrRenderAttrs } from "./helpers/ssrRenderAttrs";
import { escapeHtml, escapeHtmlComment, isVoidTag } from "./helpers/ssrUtils";

export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean };
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
export type PushFn = (item: SSRBufferItem) => void;
export type Props = Record<string, unknown>;

export type SSRContext = {
  [key: string]: any;
  teleports?: Record<string, string>;
  /**
   * @internal
   */
  __teleportBuffers?: Record<string, SSRBuffer>;
  /**
   * @internal
   */
  __watcherHandles?: (() => void)[];
};

// Each component has a buffer array.
export function createBuffer(): { getBuffer: () => SSRBuffer; push: PushFn } {
  let appendable = false;
  const buffer: SSRBuffer = [];
  return {
    getBuffer(): SSRBuffer {
      return buffer;
    },
    push(item: SSRBufferItem): void {
      const isStringItem = isString(item);
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string;
        return;
      }
      buffer.push(item);
      appendable = isStringItem;
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true;
      }
    },
  };
}

export function renderComponentVNode(
  vnode: VNode,
  parentComponent: ComponentInternalInstance | null = null,
): SSRBuffer | Promise<SSRBuffer> {
  const instance = (vnode.component = createComponentInstance(vnode, parentComponent));
  const res = setupComponent(instance);
  const hasAsyncSetup = isPromise(res);

  if (hasAsyncSetup) {
    return (res as Promise<void>).then(() => renderComponentSubTree(instance));
  } else {
    return renderComponentSubTree(instance);
  }
}

function renderComponentSubTree(
  instance: ComponentInternalInstance,
): SSRBuffer | Promise<SSRBuffer> {
  const comp = instance.type as Component;
  const { getBuffer, push } = createBuffer();

  if (isFunction(comp)) {
    const root = comp(instance.props, {
      slots: instance.slots,
      emit: instance.emit,
      attrs: {},
    });
    if (root) {
      renderVNode(push, normalizeVNode(root), instance);
    }
  } else if (instance.render) {
    const prev = setCurrentInstance(instance);
    try {
      const root = instance.render(instance.proxy!, instance.data, instance.ctx);
      if (root) {
        instance.subTree = normalizeVNode(root);
        renderVNode(push, instance.subTree, instance);
      }
    } finally {
      unsetCurrentInstance();
    }
  } else {
    console.warn(`Component is missing render function.`);
    push(`<!---->`);
  }

  return getBuffer();
}

export function renderVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const { type, shapeFlag, children, dirs, props } = vnode;

  if (dirs) {
    vnode.props = applySSRDirectives(vnode, props, dirs);
  }

  switch (type) {
    case Text:
      push(escapeHtml(children as string));
      break;
    case Comment:
      push(children ? `<!--${escapeHtmlComment(children as string)}-->` : `<!---->`);
      break;
    case Fragment:
      push(`<!--[-->`);
      renderVNodeChildren(push, children as VNodeArrayChildren, parentComponent);
      push(`<!--]-->`);
      break;
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        renderElementVNode(push, vnode, parentComponent);
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        push(renderComponentVNode(vnode, parentComponent));
      } else if (shapeFlag & ShapeFlags.TELEPORT) {
        renderTeleportVNode(push, vnode, parentComponent);
      }
  }
}

export function renderVNodeChildren(
  push: PushFn,
  children: VNodeArrayChildren,
  parentComponent: ComponentInternalInstance,
): void {
  for (let i = 0; i < children.length; i++) {
    renderVNode(push, normalizeVNode(children[i]), parentComponent);
  }
}

function renderElementVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const tag = vnode.type as string;
  const { props, children, shapeFlag } = vnode;
  let openTag = `<${tag}`;

  if (props) {
    openTag += ssrRenderAttrs(props, tag);
  }

  push(openTag + `>`);

  if (!isVoidTag(tag)) {
    let hasChildrenOverride = false;
    if (props) {
      if (props.innerHTML) {
        hasChildrenOverride = true;
        push(props.innerHTML as string);
      } else if (props.textContent) {
        hasChildrenOverride = true;
        push(escapeHtml(props.textContent as string));
      } else if (tag === "textarea" && props.value) {
        hasChildrenOverride = true;
        push(escapeHtml(props.value as string));
      }
    }
    if (!hasChildrenOverride) {
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        push(escapeHtml(children as string));
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        renderVNodeChildren(push, children as VNodeArrayChildren, parentComponent);
      }
    }
    push(`</${tag}>`);
  }
}

function applySSRDirectives(
  vnode: VNode,
  rawProps: VNodeProps | null,
  dirs: DirectiveBinding[],
): VNodeProps {
  const toMerge: VNodeProps[] = [];
  for (let i = 0; i < dirs.length; i++) {
    const binding = dirs[i];
    const {
      dir: { getSSRProps },
    } = binding as any;
    if (getSSRProps) {
      const props = getSSRProps(binding, vnode);
      if (props) toMerge.push(props);
    }
  }
  return mergeProps(rawProps || {}, ...toMerge);
}

function renderTeleportVNode(
  push: PushFn,
  vnode: VNode,
  parentComponent: ComponentInternalInstance,
): void {
  const target = vnode.props && vnode.props.to;
  const disabled = vnode.props && vnode.props.disabled;

  if (!target) {
    if (!disabled) {
      console.warn(`Teleport is missing target prop.`);
    }
    return;
  }

  if (!isString(target)) {
    console.warn(`Teleport target must be a query selector string.`);
    return;
  }

  // For disabled teleport, render children inline
  if (disabled) {
    renderVNodeChildren(push, vnode.children as VNodeArrayChildren, parentComponent);
  } else {
    // For enabled teleport, we render a placeholder comment
    push(`<!--teleport start-->`);
    push(`<!--teleport end-->`);
  }
}
