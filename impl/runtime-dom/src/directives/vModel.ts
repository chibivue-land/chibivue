import type {
  DirectiveBinding,
  DirectiveHook,
  ObjectDirective,
  VNode,
} from "@chibivue/runtime-core";
import { addEventListener } from "../modules/events";

type AssignerFn = (value: any) => void;
const getModelAssigner = (vnode: VNode): AssignerFn => {
  return vnode.props!["onUpdate:modelValue"];
};

type ModelDirective<T> = ObjectDirective<T & { _assign: AssignerFn }>;

export const vModelText: ModelDirective<HTMLInputElement | HTMLTextAreaElement> = {
  created(el, _, vnode) {
    el._assign = getModelAssigner(vnode);
    addEventListener(el, "input", (e) => {
      el._assign(el.value);
    });
  },
  mounted(el, { value }) {
    el.value = value == null ? "" : value;
  },
  beforeUpdate(el, { value }, vnode) {
    el._assign = getModelAssigner(vnode);
    const newValue = value == null ? "" : value;
    if (el.value !== newValue) {
      el.value = newValue;
    }
  },
};

export const vModelDynamic: ObjectDirective<HTMLInputElement | HTMLTextAreaElement> = {
  created(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, "created");
  },
  mounted(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, "mounted");
  },
  beforeUpdate(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, "beforeUpdate");
  },
  updated(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, "updated");
  },
};

// TODO: impl checkbox, radio, select
function resolveDynamicModel(tagName: string, type: string | undefined) {
  switch (tagName) {
    default:
      switch (type) {
        default:
          return vModelText;
      }
  }
}

function callModelHook(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null,
  hook: keyof ObjectDirective,
) {
  const modelToUse = resolveDynamicModel(el.tagName, vnode.props && vnode.props.type);
  const fn = modelToUse[hook] as DirectiveHook;
  fn && fn(el, binding, vnode, prevVNode);
}
