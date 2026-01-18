import type { App, AppContext, VNode, Component, Plugin } from "@chibivue/runtime-core";
import { createAppContext, createVNode } from "@chibivue/runtime-core";
import type { VaporComponentInternalInstance, VaporComponent } from "./component";
import { createVaporComponentInstance, initialRenderVaporComponent } from "./component";
import { hydrateVaporComponent } from "./hydration";
import { setCurrentVaporInstance } from ".";

export interface VaporApp extends App {
  _component: VaporComponent;
  _context: AppContext;
  _container: Element | null;
  _instance: VaporComponentInternalInstance | null;
}

/**
 * Create a Vapor application for client-side rendering.
 * This is the standard way to create a Vapor app.
 */
export function createVaporApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();
  const installedPlugins = new Set<Plugin>();

  const app: VaporApp = {
    _component: rootComponent,
    _props: null,
    _context: context,
    _container: null,
    _instance: null,

    use(plugin: Plugin, ...options: any[]) {
      if (installedPlugins.has(plugin)) return app;
      installedPlugins.add(plugin);
      plugin.install(app, ...options);
      return app;
    },

    component(name: string, component: Component) {
      context.components[name] = component;
      return app;
    },

    provide(key: any, value: any) {
      context.provides[key] = value;
      return app;
    },

    mount(containerOrSelector: Element | string) {
      const container =
        typeof containerOrSelector === "string"
          ? document.querySelector(containerOrSelector)
          : containerOrSelector;

      if (!container) {
        console.warn("Failed to mount app: container not found");
        return;
      }

      app._container = container;

      // Create VNode for the root component
      const vnode = createVNode(rootComponent as any);
      vnode.appContext = context;

      // Create and render the component
      const instance = createVaporComponentInstance(vnode, null);
      app._instance = instance;

      setCurrentVaporInstance(instance);
      const el = initialRenderVaporComponent(instance);
      setCurrentVaporInstance(null);

      // Clear container and append rendered element
      container.innerHTML = "";
      container.appendChild(el);

      // Mark as mounted
      instance.isMounted = true;
    },
  } as VaporApp;

  context.app = app;

  return app;
}

/**
 * Create a Vapor SSR application for hydration.
 *
 * This function is used on the client-side to hydrate SSR-rendered Vapor components.
 * The key differences from createVaporApp:
 * 1. mount() hydrates existing DOM instead of replacing it
 * 2. Template calls find existing elements instead of creating new ones
 * 3. Event listeners are attached to existing elements
 *
 * Usage:
 * ```ts
 * // Server-side
 * const html = await renderToString(createVNode(App));
 *
 * // Client-side
 * createVaporSSRApp(App).mount('#app');
 * ```
 */
export function createVaporSSRApp(rootComponent: VaporComponent): VaporApp {
  const context = createAppContext();
  const installedPlugins = new Set<Plugin>();

  const app: VaporApp = {
    _component: rootComponent,
    _props: null,
    _context: context,
    _container: null,
    _instance: null,

    use(plugin: Plugin, ...options: any[]) {
      if (installedPlugins.has(plugin)) return app;
      installedPlugins.add(plugin);
      plugin.install(app, ...options);
      return app;
    },

    component(name: string, component: Component) {
      context.components[name] = component;
      return app;
    },

    provide(key: any, value: any) {
      context.provides[key] = value;
      return app;
    },

    mount(containerOrSelector: Element | string) {
      const container =
        typeof containerOrSelector === "string"
          ? document.querySelector(containerOrSelector)
          : containerOrSelector;

      if (!container) {
        console.warn("Failed to mount app: container not found");
        return;
      }

      app._container = container;

      // Check if there's SSR content to hydrate
      if (container.hasChildNodes()) {
        // Hydration mode
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;

        const instance = hydrateVaporComponent(vnode, container, null);
        app._instance = instance;
      } else {
        // No SSR content, fall back to normal mount
        const vnode = createVNode(rootComponent as any);
        vnode.appContext = context;

        const instance = createVaporComponentInstance(vnode, null);
        app._instance = instance;

        setCurrentVaporInstance(instance);
        const el = initialRenderVaporComponent(instance);
        setCurrentVaporInstance(null);

        container.appendChild(el);
        instance.isMounted = true;
      }
    },
  } as VaporApp;

  context.app = app;

  return app;
}
