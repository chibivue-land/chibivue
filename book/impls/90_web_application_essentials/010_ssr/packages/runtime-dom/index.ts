import {
  type CreateAppFunction,
  createAppAPI,
  createRenderer,
  createHydrationRenderer,
} from "../runtime-core";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

const { render } = createRenderer({ ...nodeOps, patchProp });
const _createApp = createAppAPI(render);

export const createApp = ((...args) => {
  const app = _createApp(...args);
  const { mount } = app;
  app.mount = (selector: string) => {
    const container = document.querySelector(selector);
    if (!container) return;
    mount(container);
  };

  return app;
}) as CreateAppFunction<Element>;

// SSR Hydration support
const { hydrate: hydrateVNode } = createHydrationRenderer({
  patchProp,
  nextSibling: nodeOps.nextSibling,
});

export const createSSRApp = ((...args) => {
  const app = _createApp(...args);
  const { mount } = app;

  // Override mount to support hydration
  app.mount = (selector: string) => {
    const container = document.querySelector(selector);
    if (!container) return;

    // Check if container has SSR content (has children)
    if (container.hasChildNodes()) {
      // Hydrate instead of replacing
      const proxy = mount(container, true /* isHydrate */);
      return proxy;
    } else {
      // No SSR content, do normal mount
      mount(container);
    }
  };

  return app;
}) as CreateAppFunction<Element>;

export * from "../runtime-core";
export * from "./directives/vOn";
