import { createVNode } from "./vnode";
import type { ComponentPublicInstance } from "./componentPublicInstance";
import type { RootRenderFunction } from "./renderer";
import type { Component } from "./component";
import type { InjectionKey } from "./apiInject";

export interface App<HostElement = any> {
  use(plugin: Plugin, ...options: any[]): App;
  component(name: string, component: Component): this;
  mount(rootContainer: HostElement | string): void;
  provide<T>(key: InjectionKey<T> | string, value: T): this;
  /** @internal */
  _component: Component;
  /** @internal */
  _props: Record<string, unknown> | null;
  /** @internal */
  _context: AppContext;
}

export type CreateAppFunction<HostElement> = (rootComponent: Component) => App<HostElement>;

export interface AppContext {
  app: App; // for devtools
  provides: Record<string | symbol, any>;
  components: Record<string, Component>;
}

export type Plugin = {
  install: (app: App, ...options: any[]) => any;
};

export function createAppContext(): AppContext {
  return {
    app: null as any,
    provides: Object.create(null),
    components: Object.create(null),
  };
}

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const context = createAppContext();
    const installedPlugins = new Set();

    const app: App = (context.app = {
      _component: rootComponent,
      _props: null,
      _context: context,

      use(plugin: Plugin, ...options: any[]) {
        // skip duplicate plugins
        if (installedPlugins.has(plugin)) return app;

        installedPlugins.add(plugin);
        plugin.install(app, ...options);
        return app;
      },

      component(name: string, component: Component) {
        context.components[name] = component;
        return app;
      },

      mount(rootContainer: HostElement) {
        const vnode = createVNode(rootComponent as ComponentPublicInstance);
        vnode.appContext = context;
        render(vnode, rootContainer, null);
      },

      provide(key, value) {
        context.provides[key as string | symbol] = value;
        return app;
      },
    });

    return app;
  };
}
