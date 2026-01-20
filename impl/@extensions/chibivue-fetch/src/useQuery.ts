import {
  computed,
  onMounted,
  onUnmounted,
  watch,
  shallowRef,
  getCurrentInstance,
  isRef,
} from "chibivue";
import { getActiveQueryCache, toKeyHash, type QueryCache } from "./queryCache";
import type {
  EntryKey,
  EntryKeyFn,
  UseQueryOptions,
  UseQueryOptionsWithDefaults,
  UseQueryReturn,
  UseQueryEntry,
  DataState,
} from "./types";

// ============================================================================
// Defaults
// ============================================================================

const USE_QUERY_DEFAULTS = {
  staleTime: 5000,
  gcTime: 5 * 60 * 1000,
  refetchOnMount: true,
  retry: 3,
  retryDelay: 1000,
} as const;

// ============================================================================
// Utilities
// ============================================================================

function resolveKey(keyOrFn: EntryKey | EntryKeyFn): EntryKey {
  return typeof keyOrFn === "function" ? keyOrFn() : keyOrFn;
}

function isEnabled(enabled: UseQueryOptions["enabled"]): boolean {
  if (enabled === undefined) return true;
  if (isRef(enabled)) return enabled.value;
  return enabled;
}

// ============================================================================
// useQuery
// ============================================================================

export function useQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError>,
): UseQueryReturn<TData, TError> {
  const cache = getActiveQueryCache();

  if (__DEV__ && !cache) {
    throw new Error(
      `[chibivue-fetch]: QueryCache not found. Did you forget to call app.use(createQueryCache())?`,
    );
  }

  const queryCache = cache!;

  // Merge options with defaults
  const fullOptions: UseQueryOptionsWithDefaults<TData, TError> = {
    ...USE_QUERY_DEFAULTS,
    ...options,
    staleTime: options.staleTime ?? queryCache.options.staleTime,
    gcTime: options.gcTime ?? queryCache.options.gcTime,
  };

  // Current entry reference (can change if key changes)
  const entry = shallowRef<UseQueryEntry<TData, TError>>();

  // Track current component instance for dependency tracking
  const currentInstance = getCurrentInstance();

  // Get or create entry
  function ensureEntry(): UseQueryEntry<TData, TError> {
    const key = resolveKey(fullOptions.key);
    const currentEntry = entry.value;

    // Check if key changed
    if (currentEntry && toKeyHash(key) === currentEntry.keyHash) {
      return currentEntry;
    }

    // Untrack old entry
    if (currentEntry) {
      queryCache.untrack(currentEntry, currentInstance);
    }

    // Get or create new entry
    const newEntry = queryCache.ensure(key, fullOptions);
    entry.value = newEntry;

    return newEntry;
  }

  // Initialize entry
  ensureEntry();

  // Track this component as a dependency
  function trackEntry(): void {
    const e = entry.value;
    if (e) {
      queryCache.track(e, currentInstance);
    }
  }

  // Untrack this component
  function untrackEntry(): void {
    const e = entry.value;
    if (e) {
      queryCache.untrack(e, currentInstance);
    }
  }

  // Refresh: only fetch if stale or error
  async function refresh(): Promise<DataState<TData, TError>> {
    const e = ensureEntry();
    if (!isEnabled(fullOptions.enabled)) {
      return e.state.value;
    }
    return queryCache.refresh(e);
  }

  // Refetch: always fetch
  async function refetch(): Promise<DataState<TData, TError>> {
    const e = ensureEntry();
    if (!isEnabled(fullOptions.enabled)) {
      return e.state.value;
    }
    queryCache.invalidate(e);
    return queryCache.fetch(e);
  }

  // Watch for key changes (reactive queries)
  if (typeof fullOptions.key === "function") {
    watch(
      () => resolveKey(fullOptions.key),
      (newKey, oldKey) => {
        if (toKeyHash(newKey) !== toKeyHash(oldKey as EntryKey)) {
          ensureEntry();
          if (isEnabled(fullOptions.enabled)) {
            refresh();
          }
        }
      },
      { deep: true },
    );
  }

  // Watch enabled state
  if (isRef(fullOptions.enabled) || typeof fullOptions.enabled === "object") {
    watch(
      () => isEnabled(fullOptions.enabled),
      (enabled) => {
        if (enabled) {
          refresh();
        }
      },
    );
  }

  // Lifecycle
  onMounted(() => {
    trackEntry();

    const e = entry.value;
    if (!e || !isEnabled(fullOptions.enabled)) return;

    // Handle refetchOnMount
    const shouldRefetch =
      fullOptions.refetchOnMount === "always" ||
      (fullOptions.refetchOnMount && queryCache.isStale(e));

    if (shouldRefetch || e.state.value.status === "pending") {
      refresh();
    }
  });

  onUnmounted(() => {
    untrackEntry();
  });

  // Initial fetch if enabled and no data
  if (isEnabled(fullOptions.enabled) && entry.value?.state.value.status === "pending") {
    refresh();
  }

  // Return computed refs
  const state = computed(
    () =>
      entry.value?.state.value ?? ({ status: "pending", data: undefined, error: null } as const),
  );
  const asyncStatus = computed(() => entry.value?.asyncStatus.value ?? ("idle" as const));

  return {
    state,
    asyncStatus,
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    status: computed(() => state.value.status),
    isPending: computed(() => state.value.status === "pending"),
    isLoading: computed(() => state.value.status === "pending" && asyncStatus.value === "loading"),
    isSuccess: computed(() => state.value.status === "success"),
    isError: computed(() => state.value.status === "error"),
    refresh,
    refetch,
  };
}
