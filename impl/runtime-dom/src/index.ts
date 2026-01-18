import type { CreateAppFunction, RootRenderFunction } from "@chibivue/runtime-core";
import { createRenderer } from "@chibivue/runtime-core";
import { isString } from "@chibivue/shared";

import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

const renderer = createRenderer({ ...nodeOps, patchProp });

export const render = ((...args) => {
  renderer.render(...args);
}) as RootRenderFunction<Element>;

export const createApp = ((...args) => {
  const app = renderer.createApp(...args);
  const { mount } = app;
  app.mount = (containerOrSelector: Element | string): any => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;
    mount(container);
  };
  return app;
}) as CreateAppFunction<Element>;

function normalizeContainer(container: Element | string): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container);
    return res;
  } else {
    return container;
  }
}

export { vModelText, vModelDynamic } from "./directives/vModel";

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from "@chibivue/runtime-core";

export * from "./directives/vOn";
export * from "./directives/vModel";
export * from "./directives/vShow";
export * from "./runtimeHelpers";
export * from "./nodeOps";
export * from "./patchProp";
export * from "./components/Transition";
