import { type Store, setActiveStore, storeSymbol } from "./rootStore";

export function createStore(): Store {
  const store: Store = {
    install(app) {
      setActiveStore(store);
      app.provide(storeSymbol, store);
    },
    _s: new Map(),
  };

  return store;
}
