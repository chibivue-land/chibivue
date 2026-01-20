import type { App, InjectionKey, EffectScope } from "chibivue";
import { hasInjectionContext, inject, shallowRef, markRaw, triggerRef } from "chibivue";
import type {
  EntryKey,
  UseQueryEntry,
  UseQueryOptionsWithDefaults,
  DataState,
  QueryCacheOptions,
  SerializedQueryCache,
  UseQueryEntryNodeSerialized,
  QueryMeta,
  QueryContext,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STALE_TIME = 5000; // 5 seconds
const DEFAULT_GC_TIME = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Key Utilities
// ============================================================================

/**
 * Convert entry key to cache key string
 */
export function toKeyHash(key: EntryKey): string {
  return JSON.stringify(key, (_, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce(
          (sorted, k) => {
            sorted[k] = value[k];
            return sorted;
          },
          {} as Record<string, unknown>,
        );
    }
    return value;
  });
}

/**
 * Check if a key is a subset of another key (for partial matching)
 */
export function isSubsetOf(subsetKey: EntryKey, fullKey: EntryKey): boolean {
  if (subsetKey.length > fullKey.length) return false;
  return subsetKey.every((item, index) => {
    const fullItem = fullKey[index];
    if (
      typeof item === "object" &&
      item !== null &&
      typeof fullItem === "object" &&
      fullItem !== null
    ) {
      return JSON.stringify(item) === JSON.stringify(fullItem);
    }
    return item === fullItem;
  });
}

// ============================================================================
// Query Cache Interface
// ============================================================================

export interface QueryCache {
  install: (app: App) => void;

  /** Internal cache map */
  caches: Map<string, UseQueryEntry>;

  /** Default options */
  options: Required<QueryCacheOptions>;

  /** Create a new query entry */
  create<TData = unknown, TError = Error>(
    key: EntryKey,
    options: UseQueryOptionsWithDefaults<TData, TError> | null,
    data?: TData,
    error?: TError | null,
    when?: number,
    meta?: QueryMeta,
  ): UseQueryEntry<TData, TError>;

  /** Ensure a query entry exists (create or retrieve) */
  ensure<TData = unknown, TError = Error>(
    key: EntryKey,
    options: UseQueryOptionsWithDefaults<TData, TError>,
  ): UseQueryEntry<TData, TError>;

  /** Fetch data for a query entry */
  fetch<TData = unknown, TError = Error>(
    entry: UseQueryEntry<TData, TError>,
  ): Promise<DataState<TData, TError>>;

  /** Refresh a query (only if stale or has error) */
  refresh<TData = unknown, TError = Error>(
    entry: UseQueryEntry<TData, TError>,
  ): Promise<DataState<TData, TError>>;

  /** Invalidate a query (mark as stale) */
  invalidate<TData = unknown, TError = Error>(entry: UseQueryEntry<TData, TError>): void;

  /** Invalidate queries by key (partial match) */
  invalidateQueries(key?: EntryKey): void;

  /** Remove a query entry */
  remove<TData = unknown, TError = Error>(entry: UseQueryEntry<TData, TError>): void;

  /** Track a dependency for a query entry */
  track<TData = unknown, TError = Error>(
    entry: UseQueryEntry<TData, TError>,
    effect: EffectScope | object | null,
  ): void;

  /** Untrack a dependency for a query entry */
  untrack<TData = unknown, TError = Error>(
    entry: UseQueryEntry<TData, TError>,
    effect: EffectScope | object | null,
  ): void;

  /** Set query data manually */
  setQueryData<TData>(key: EntryKey, data: TData): void;

  /** Get query data */
  getQueryData<TData>(key: EntryKey): TData | undefined;

  /** Prefetch a query */
  prefetchQuery<TData>(
    key: EntryKey,
    queryFn: (ctx: QueryContext) => Promise<TData>,
    options?: Partial<UseQueryOptionsWithDefaults<TData>>,
  ): Promise<void>;

  /** Check if entry is stale */
  isStale<TData = unknown, TError = Error>(entry: UseQueryEntry<TData, TError>): boolean;
}

// ============================================================================
// Injection Key
// ============================================================================

export const queryCacheSymbol: InjectionKey<QueryCache> = Symbol("chibivue-fetch:query-cache");

let activeQueryCache: QueryCache | undefined;

export const setActiveQueryCache = (cache: QueryCache | undefined): QueryCache | undefined =>
  (activeQueryCache = cache);

export const getActiveQueryCache = (): QueryCache | undefined => {
  const cache = hasInjectionContext() && inject(queryCacheSymbol, null);

  if (__DEV__ && !cache && typeof window === "undefined") {
    console.warn(
      `[chibivue-fetch]: QueryCache not found in context. This falls back to the global activeQueryCache ` +
        `which exposes you to cross-request state pollution on the server.`,
    );
  }

  return cache || activeQueryCache;
};

// ============================================================================
// Create Query Cache
// ============================================================================

export function createQueryCache(options: QueryCacheOptions = {}): QueryCache {
  const caches = new Map<string, UseQueryEntry>();

  const defaultOptions: Required<QueryCacheOptions> = {
    staleTime: options.staleTime ?? DEFAULT_STALE_TIME,
    gcTime: options.gcTime ?? DEFAULT_GC_TIME,
  };

  function scheduleGarbageCollection(entry: UseQueryEntry): void {
    if (entry.deps.size > 0 || !entry.options) return;

    clearTimeout(entry.gcTimeout);

    // Abort any pending request
    entry.pending?.abortController.abort();

    if (Number.isFinite(entry.options.gcTime)) {
      entry.gcTimeout = setTimeout(() => {
        cache.remove(entry);
      }, entry.options.gcTime);
    }
  }

  const cache: QueryCache = {
    install(app: App) {
      setActiveQueryCache(cache);
      app.provide(queryCacheSymbol, cache);
    },

    caches,
    options: defaultOptions,

    create<TData = unknown, TError = Error>(
      key: EntryKey,
      options: UseQueryOptionsWithDefaults<TData, TError> | null,
      data?: TData,
      error?: TError | null,
      when?: number,
      meta?: QueryMeta,
    ): UseQueryEntry<TData, TError> {
      const keyHash = toKeyHash(key);
      const now = Date.now();

      let initialState: DataState<TData, TError>;
      if (data !== undefined) {
        initialState = { status: "success", data, error: null };
      } else if (error != null) {
        initialState = { status: "error", data: undefined, error };
      } else {
        initialState = { status: "pending", data: undefined, error: null };
      }

      const entry = markRaw<UseQueryEntry<TData, TError>>({
        state: shallowRef(initialState),
        asyncStatus: shallowRef("idle"),
        key,
        keyHash,
        when: when != null ? now - when : 0, // Convert relative time back to absolute
        meta,
        deps: new Set(),
        pending: null,
        options,
      });

      return entry;
    },

    ensure<TData = unknown, TError = Error>(
      key: EntryKey,
      options: UseQueryOptionsWithDefaults<TData, TError>,
    ): UseQueryEntry<TData, TError> {
      const keyHash = toKeyHash(key);
      let entry = caches.get(keyHash) as UseQueryEntry<TData, TError> | undefined;

      if (!entry) {
        // Get initial data if provided
        let initialData: TData | undefined;
        if (options.initialData !== undefined) {
          initialData =
            typeof options.initialData === "function"
              ? (options.initialData as () => TData)()
              : options.initialData;
        }

        entry = cache.create(key, options, initialData);
        caches.set(keyHash, entry as UseQueryEntry);
      } else {
        // Update options if entry exists
        entry.options = options;
        clearTimeout(entry.gcTimeout);
      }

      return entry;
    },

    async fetch<TData = unknown, TError = Error>(
      entry: UseQueryEntry<TData, TError>,
    ): Promise<DataState<TData, TError>> {
      if (!entry.options) {
        throw new Error("[chibivue-fetch]: Cannot fetch without options");
      }

      // Abort any existing request
      entry.pending?.abortController.abort();

      const abortController = new AbortController();
      const when = Date.now();

      const refreshCall = (async (): Promise<DataState<TData, TError>> => {
        entry.asyncStatus.value = "loading";

        let retryCount = 0;
        const maxRetries =
          entry.options!.retry === true
            ? 3
            : entry.options!.retry === false
              ? 0
              : entry.options!.retry;

        while (true) {
          try {
            const data = await entry.options!.query({ signal: abortController.signal });

            const newState: DataState<TData, TError> = {
              status: "success",
              data,
              error: null,
            };

            entry.state.value = newState;
            entry.when = Date.now();
            entry.asyncStatus.value = "idle";
            entry.pending = null;

            return newState;
          } catch (err) {
            // Don't retry if aborted
            if (abortController.signal.aborted) {
              throw err;
            }

            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, entry.options!.retryDelay));
              continue;
            }

            const newState: DataState<TData, TError> = {
              status: "error",
              data: entry.state.value.data,
              error: err as TError,
            };

            entry.state.value = newState;
            entry.when = Date.now();
            entry.asyncStatus.value = "idle";
            entry.pending = null;

            return newState;
          }
        }
      })();

      entry.pending = { abortController, refreshCall, when };

      return refreshCall;
    },

    async refresh<TData = unknown, TError = Error>(
      entry: UseQueryEntry<TData, TError>,
    ): Promise<DataState<TData, TError>> {
      // Return existing pending request if one exists
      if (entry.pending) {
        return entry.pending.refreshCall;
      }

      // Only fetch if stale or has error
      if (!cache.isStale(entry) && entry.state.value.status !== "error") {
        return entry.state.value;
      }

      return cache.fetch(entry);
    },

    invalidate(entry: UseQueryEntry<any, any>): void {
      entry.when = 0;
      entry.pending?.abortController.abort();
      entry.pending = null;
    },

    invalidateQueries(key?: EntryKey): void {
      if (key) {
        for (const entry of caches.values()) {
          if (isSubsetOf(key, entry.key)) {
            cache.invalidate(entry);
          }
        }
      } else {
        for (const entry of caches.values()) {
          cache.invalidate(entry);
        }
      }
    },

    remove(entry: UseQueryEntry<any, any>): void {
      clearTimeout(entry.gcTimeout);
      entry.pending?.abortController.abort();
      caches.delete(entry.keyHash);
    },

    track(entry: UseQueryEntry<any, any>, effect: EffectScope | object | null): void {
      if (!effect) return;
      entry.deps.add(effect);
      clearTimeout(entry.gcTimeout);
    },

    untrack(entry: UseQueryEntry<any, any>, effect: EffectScope | object | null): void {
      if (!effect) return;
      entry.deps.delete(effect);
      scheduleGarbageCollection(entry);
    },

    setQueryData<TData>(key: EntryKey, data: TData): void {
      const keyHash = toKeyHash(key);
      const entry = caches.get(keyHash);

      if (entry) {
        entry.state.value = { status: "success", data, error: null };
        entry.when = Date.now();
        triggerRef(entry.state);
      } else {
        // Create a new entry with the data
        const newEntry = cache.create(key, null, data);
        caches.set(keyHash, newEntry);
      }
    },

    getQueryData<TData>(key: EntryKey): TData | undefined {
      const keyHash = toKeyHash(key);
      const entry = caches.get(keyHash);
      if (!entry || entry.state.value.status !== "success") return undefined;
      return entry.state.value.data as TData;
    },

    async prefetchQuery<TData>(
      key: EntryKey,
      queryFn: (ctx: QueryContext) => Promise<TData>,
      options?: Partial<UseQueryOptionsWithDefaults<TData>>,
    ): Promise<void> {
      const fullOptions: UseQueryOptionsWithDefaults<TData> = {
        key,
        query: queryFn,
        staleTime: options?.staleTime ?? defaultOptions.staleTime,
        gcTime: options?.gcTime ?? defaultOptions.gcTime,
        refetchOnMount: options?.refetchOnMount ?? true,
        retry: options?.retry ?? 3,
        retryDelay: options?.retryDelay ?? 1000,
      };

      const entry = cache.ensure(key, fullOptions);

      // Only fetch if no data yet or stale
      if (entry.state.value.status === "pending" || cache.isStale(entry)) {
        await cache.fetch(entry);
      }
    },

    isStale(entry: UseQueryEntry<any, any>): boolean {
      if (!entry.options || !entry.when) return true;
      return Date.now() >= entry.when + entry.options.staleTime;
    },
  };

  return cache;
}

// ============================================================================
// SSR Serialization / Hydration
// ============================================================================

/**
 * Serialize query cache for SSR
 */
export function serializeQueryCache(queryCache: QueryCache): SerializedQueryCache {
  const serialized: SerializedQueryCache = {};
  const now = Date.now();

  for (const [keyHash, entry] of queryCache.caches) {
    // Only serialize entries with data
    if (entry.state.value.status === "pending" && entry.state.value.data === undefined) {
      continue;
    }

    const state = entry.state.value;
    const relativeWhen = entry.when ? now - entry.when : undefined;

    serialized[keyHash] = [
      state.data,
      state.error,
      relativeWhen,
      entry.meta,
    ] as UseQueryEntryNodeSerialized;
  }

  return serialized;
}

/**
 * Hydrate query cache from SSR state
 */
export function hydrateQueryCache(
  queryCache: QueryCache,
  serializedCache: SerializedQueryCache,
): void {
  for (const keyHash in serializedCache) {
    const [data, error, when, meta] = serializedCache[keyHash] ?? [];

    // Parse key from keyHash
    const key = JSON.parse(keyHash) as EntryKey;

    const entry = queryCache.create(key, null, data, error, when, meta);
    queryCache.caches.set(keyHash, entry);
  }
}

// ============================================================================
// Dispose
// ============================================================================

export function disposeQueryCache(cache: QueryCache): void {
  for (const entry of cache.caches.values()) {
    clearTimeout(entry.gcTimeout);
    entry.pending?.abortController.abort();
  }
  cache.caches.clear();
}
