import type { InjectionKey } from "./apiInject";
import type { Component } from "./component";
import type { RootRenderFunction } from "./renderer";
import { createVNode } from "./vnode";

export interface App<HostElement = any> {
  component(name: string, component: Component): this;
  mount(rootContainer: HostElement | string): void;
  provide<T>(key: InjectionKey<T> | string, value: T): this;
}

export interface AppContext {
  app: App;
  components: Record<string, Component>;
  provides: Record<string | symbol, any>;
}

export function createAppContext(): AppContext {
  return {
    app: null as any,
    provides: Object.create(null),
    components: {},
  };
}

export type CreateAppFunction<HostElement> = (rootComponent: Component) => App<HostElement>;

export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent) {
    const context = createAppContext();

    const app: App = (context.app = {
      mount(rootContainer: HostElement) {
        const vnode = createVNode(rootComponent, {}, []);
        vnode.appContext = context;
        render(vnode, rootContainer);
      },

      provide(key, value) {
        context.provides[key as string | symbol] = value;

        return app;
      },

      component(name: string, component: Component): any {
        context.components[name] = component;
        return app;
      },
    });

    return app;
  };
}
