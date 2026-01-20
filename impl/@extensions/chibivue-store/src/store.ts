import {
  type ComputedRef,
  computed,
  hasInjectionContext,
  inject,
  isReactive,
  isRef,
  markRaw,
  reactive,
  toRaw,
  toRef,
} from "chibivue";
import {
  type StateTree,
  type Store,
  type StoreGeneric,
  activeStore,
  setActiveStore,
  storeSymbol,
} from "./rootStore";

type _GettersTree<S extends StateTree> = Record<string, (state: S) => unknown>;

export interface StoreDefinition<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A = Record<string, (...args: any[]) => any>,
> {
  (): StoreInstance<Id, S, G, A>;
}

export interface StoreInstance<
  Id extends string = string,
  S extends StateTree = StateTree,
  G extends _GettersTree<S> = _GettersTree<S>,
  A = Record<string, (...args: any[]) => any>,
> {
  $id: Id;
  $state: S;
  $patch: (partialState: Partial<S> | ((state: S) => void)) => void;
  $reset: () => void;
}

interface StoreOptions<Id extends string, S extends StateTree, G extends _GettersTree<S>, A> {
  id: Id;
  state?: () => S;
  getters?: G & ThisType<S & { [K in keyof G]: ReturnType<G[K]> }>;
  actions?: A & ThisType<S & A & { [K in keyof G]: ReturnType<G[K]> }>;
}

// Composition API style (setup function)
export function defineStore<Id extends string, SS extends StateTree>(
  id: Id,
  setup: () => SS,
): () => SS;

// Options API style
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(options: StoreOptions<Id, S, G, A>): StoreDefinition<Id, S, G, A>;

// Options API style (id as first argument)
export function defineStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(id: Id, options: Omit<StoreOptions<Id, S, G, A>, "id">): StoreDefinition<Id, S, G, A>;

export function defineStore(
  idOrOptions: string | StoreOptions<string, StateTree, _GettersTree<StateTree>, any>,
  setupOrOptions?:
    | (() => StateTree)
    | Omit<StoreOptions<string, StateTree, _GettersTree<StateTree>, any>, "id">,
): any {
  let id: string;
  let setup: (() => StateTree) | undefined;
  let options:
    | Omit<StoreOptions<string, StateTree, _GettersTree<StateTree>, any>, "id">
    | undefined;

  const isSetupStore = typeof setupOrOptions === "function";

  if (typeof idOrOptions === "string") {
    id = idOrOptions;
    if (isSetupStore) {
      setup = setupOrOptions;
    } else {
      options = setupOrOptions;
    }
  } else {
    id = idOrOptions.id;
    options = idOrOptions;
  }

  function useStore(outerStore?: Store | null): StoreGeneric {
    const hasContext = hasInjectionContext();
    // Try to get store from injection context first, then fall back to activeStore
    outerStore = outerStore || (hasContext ? inject(storeSymbol, null) : null);

    if (outerStore) setActiveStore(outerStore);

    if (__DEV__ && !activeStore) {
      throw new Error(
        `[chibivue-store]: "getActiveStore()" was called but there was no active Store. ` +
          `Are you trying to use a store before calling "app.use(createStore())"?`,
      );
    }

    const store = activeStore!;

    if (!store._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup!, store);
      } else if (options) {
        createOptionsStore(id, options, store);
      }
    }

    return store._s.get(id)!;
  }

  useStore.$id = id;

  return useStore;
}

function isComputed<T>(value: ComputedRef<T> | unknown): value is ComputedRef<T> {
  return !!(isRef(value) && (value as any).effect);
}

function createSetupStore<Id extends string>(id: Id, setup: () => StateTree, store: Store) {
  // Initialize state for this store in the root state
  if (!store.state.value[id]) {
    store.state.value[id] = {};
  }

  const initialState = store.state.value[id];
  const setupStore = store._e.run(() => setup())!;

  // Process setup store return values
  for (const key in setupStore) {
    const prop = setupStore[key];

    // State: ref or reactive
    if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
      // Hydrate from initial state if exists
      if (initialState && key in initialState) {
        if (isRef(prop)) {
          prop.value = initialState[key];
        } else {
          Object.assign(prop, initialState[key]);
        }
      }
      // Sync to root state
      store.state.value[id][key] = prop;
    }
  }

  const _store = reactive({
    $id: id,
    ...setupStore,
    $patch(partialState: Partial<StateTree> | ((state: StateTree) => void)) {
      if (typeof partialState === "function") {
        partialState(store.state.value[id]);
      } else {
        for (const key in partialState) {
          const value = store.state.value[id][key];
          if (isRef(value)) {
            value.value = partialState[key];
          } else {
            store.state.value[id][key] = partialState[key];
          }
        }
      }
    },
    $reset() {
      if (__DEV__) {
        console.warn(
          `[chibivue-store]: Store "${id}" is built using the setup syntax and does not implement $reset().`,
        );
      }
    },
  }) as StoreGeneric;

  store._s.set(id, _store);
}

function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends Record<string, (...args: any[]) => any>,
>(id: Id, options: Omit<StoreOptions<Id, S, G, A>, "id">, store: Store) {
  const { state: stateFn, getters, actions } = options;

  // Get initial state from root state (for SSR hydration) or create new
  const initialState = store.state.value[id] as S | undefined;

  function setup() {
    // Initialize state in root state if not exists
    if (!initialState) {
      store.state.value[id] = stateFn ? stateFn() : {};
    }

    const localState = toRefs(store.state.value[id]);

    // Create getters as computed
    const computedGetters: Record<string, ComputedRef<unknown>> = {};
    if (getters) {
      for (const key in getters) {
        const getter = getters[key];
        computedGetters[key] = markRaw(
          computed(() => {
            setActiveStore(store);
            const _store = store._s.get(id)!;
            return getter.call(_store, _store);
          }),
        );
      }
    }

    return {
      ...localState,
      ...computedGetters,
      ...actions,
    };
  }

  const setupStore = store._e.run(() => setup())!;

  // Bind actions to store context
  const boundActions: Record<string, (...args: any[]) => any> = {};
  if (actions) {
    for (const key in actions) {
      const action = actions[key];
      boundActions[key] = function (this: any, ...args: any[]) {
        setActiveStore(store);
        return action.apply(store._s.get(id), args);
      };
    }
  }

  const _store = reactive({
    $id: id,
    ...setupStore,
    ...boundActions,
    $patch(partialState: Partial<S> | ((state: S) => void)) {
      if (typeof partialState === "function") {
        partialState(store.state.value[id] as S);
      } else {
        mergeReactiveObjects(store.state.value[id], partialState);
      }
    },
    $reset() {
      const newState = stateFn ? stateFn() : ({} as S);
      this.$patch(($state: S) => {
        Object.assign($state, newState);
      });
    },
  }) as StoreGeneric;

  // Define $state as getter/setter
  Object.defineProperty(_store, "$state", {
    get: () => store.state.value[id],
    set: (state) => {
      _store.$patch(($state: S) => {
        Object.assign($state, state);
      });
    },
  });

  store._s.set(id, _store);
}

function toRefs<T extends StateTree>(obj: T): { [K in keyof T]: any } {
  const refs = {} as { [K in keyof T]: any };
  for (const key in obj) {
    refs[key] = toRef(obj, key);
  }
  return refs;
}

function mergeReactiveObjects<T extends Record<any, unknown>>(
  target: T,
  patchToApply: Partial<T>,
): T {
  for (const key in patchToApply) {
    if (!Object.prototype.hasOwnProperty.call(patchToApply, key)) continue;
    const subPatch = patchToApply[key];
    const targetValue = target[key];
    if (
      isPlainObject(targetValue) &&
      isPlainObject(subPatch) &&
      Object.prototype.hasOwnProperty.call(target, key) &&
      !isRef(subPatch) &&
      !isReactive(subPatch)
    ) {
      target[key] = mergeReactiveObjects(targetValue as any, subPatch as any);
    } else {
      target[key] = subPatch as T[Extract<keyof T, string>];
    }
  }
  return target;
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return (
    obj !== null &&
    typeof obj === "object" &&
    Object.prototype.toString.call(obj) === "[object Object]"
  );
}
