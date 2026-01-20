import type { App, EffectScope, InjectionKey, Ref } from "chibivue";
import { hasInjectionContext, inject } from "chibivue";

export type StateTree = Record<string | number | symbol, any>;

export interface Store {
  install: (app: App) => void;
  /** Add a store plugin */
  use(plugin: StorePlugin): Store;
  /** Root state - stores all store states as ref */
  state: Ref<Record<string, StateTree>>;
  /** Installed store plugins */
  _p: StorePlugin[];
  /** App linked to this store */
  _a: App | null;
  /** Effect scope the store is attached to */
  _e: EffectScope;
  /** Registry of stores */
  _s: Map<string, StoreGeneric>;
}

export type StoreGeneric = Record<string, any>;

export interface StorePluginContext {
  store: Store;
  app: App;
}

export interface StorePlugin {
  (context: StorePluginContext): void;
}

export const storeSymbol: InjectionKey<Store> = Symbol();

/**
 * setActiveStore must be called to handle SSR at the top of functions like
 * `fetch`, `setup`, `serverPrefetch` and others
 */
export let activeStore: Store | undefined;

export const setActiveStore = (store: Store | undefined): Store | undefined =>
  (activeStore = store);

/**
 * Get the currently active store if there is any.
 */
export const getActiveStore = (): Store | undefined => {
  const store = hasInjectionContext() && inject(storeSymbol, null);

  if (__DEV__ && !store && typeof window === "undefined") {
    console.warn(
      `[chibivue-store]: Store instance not found in context. This falls back to the global activeStore which exposes you to cross-request state pollution on the server.`,
    );
  }

  return store || activeStore;
};
