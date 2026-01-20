import { type App, effectScope, markRaw, ref, type Ref } from "chibivue";
import {
  type StateTree,
  type Store,
  type StoreGeneric,
  type StorePlugin,
  setActiveStore,
  storeSymbol,
} from "./rootStore";

export function createStore(): Store {
  const scope = effectScope(true);

  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({}),
  )!;

  let _p: StorePlugin[] = [];
  let toBeInstalled: StorePlugin[] = [];

  const store: Store = markRaw({
    install(app: App) {
      setActiveStore(store);
      store._a = app;
      app.provide(storeSymbol, store);
      app.config.globalProperties.$store = store;
      toBeInstalled.forEach((plugin) => _p.push(plugin));
      toBeInstalled = [];
    },

    use(plugin: StorePlugin) {
      if (!this._a) {
        toBeInstalled.push(plugin);
      } else {
        _p.push(plugin);
      }
      return this;
    },

    _p,
    _a: null,
    _e: scope,
    _s: new Map<string, StoreGeneric>(),
    state,
  });

  return store;
}

/**
 * Dispose a Store instance by stopping its effectScope and removing the state, plugins and stores.
 */
export function disposeStore(store: Store) {
  store._e.stop();
  store._s.clear();
  store._p.splice(0);
  store.state.value = {};
  store._a = null;
}
