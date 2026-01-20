# Data Fetch

## What is a Data Fetch Library?

Modern web applications frequently fetch data from servers. In the Vue.js ecosystem, libraries like Pinia Colada and TanStack Query provide this functionality.

In this chapter, we'll implement basic data fetching functionality similar to Pinia Colada as chibivue-fetch.

### Why Do We Need a Library?

Simple data fetching might seem sufficient with just `fetch` and `ref`:

```ts
// composables/useUser.ts
import { ref, onMounted } from "chibivue";

export function useUser(id: number) {
  const user = ref(null);
  const isLoading = ref(true);
  const error = ref(null);

  onMounted(async () => {
    try {
      const response = await fetch(`/api/users/${id}`);
      user.value = await response.json();
    } catch (e) {
      error.value = e;
    } finally {
      isLoading.value = false;
    }
  });

  return { user, isLoading, error };
}
```

However, this implementation has the following problems:

1. **No caching**: Same data is fetched multiple times
2. **SSR is difficult**: Cannot transfer server-fetched data to the client
3. **Duplicate requests**: Multiple mounts of the same component cause duplicate requests
4. **Error handling**: Retry and refetch logic becomes complex

Data fetching libraries solve these problems and provide a declarative API.

## Package Structure

chibivue-fetch is provided in the `@extensions/chibivue-fetch` package.

```
@extensions/chibivue-fetch/src/
├── index.ts           # Exports
├── queryCache.ts      # QueryCache implementation (cache management)
├── useQuery.ts        # Data fetching hook
├── useMutation.ts     # Data mutation hook
└── types.ts           # Type definitions
```

## Data State Pattern

Similar to Pinia Colada, chibivue-fetch represents data state with three states:

```ts
type DataStateStatus = "pending" | "error" | "success";

type DataState<TData, TError> =
  | { status: "pending"; data: undefined; error: null }
  | { status: "error"; data: TData | undefined; error: TError }
  | { status: "success"; data: TData; error: null };
```

This state model allows clear tracking of data state.

## QueryCache

`QueryCache` manages caching and state management for SSR.

```ts
// queryCache.ts
export interface QueryCache {
  install: (app: App) => void;
  caches: Map<string, UseQueryEntry>;
  options: Required<QueryCacheOptions>;
  create: <TData>(key: EntryKey, options: UseQueryOptionsWithDefaults | null, ...) => UseQueryEntry;
  ensure: <TData>(key: EntryKey, options: UseQueryOptionsWithDefaults) => UseQueryEntry;
  fetch: <TData>(entry: UseQueryEntry) => Promise<DataState>;
  refresh: <TData>(entry: UseQueryEntry) => Promise<DataState>;
  invalidate: (entry: UseQueryEntry) => void;
  invalidateQueries: (key?: EntryKey) => void;
  remove: (entry: UseQueryEntry) => void;
  track: (entry: UseQueryEntry, effect: EffectScope | object | null) => void;
  untrack: (entry: UseQueryEntry, effect: EffectScope | object | null) => void;
  setQueryData: <TData>(key: EntryKey, data: TData) => void;
  getQueryData: <TData>(key: EntryKey) => TData | undefined;
  prefetchQuery: <TData>(key: EntryKey, queryFn: (ctx: QueryContext) => Promise<TData>, options?: Partial<UseQueryOptionsWithDefaults>) => Promise<void>;
  isStale: (entry: UseQueryEntry) => boolean;
}
```

### Key Methods

- `ensure`: Get or create an entry
- `fetch`: Execute the query (always executes)
- `refresh`: Refresh the query (only executes if stale or error)
- `invalidate`: Invalidate an entry (mark as stale)
- `invalidateQueries`: Invalidate entries matching a key
- `track` / `untrack`: Track component dependencies
- `setQueryData` / `getQueryData`: Direct cache data manipulation
- `prefetchQuery`: Prefetch data and store in cache

### createQueryCache

```ts
import { createQueryCache } from "chibivue-fetch";

const queryCache = createQueryCache({
  staleTime: 5000,       // Default stale time (5 seconds)
  gcTime: 300000,        // Default GC time (5 minutes)
});

app.use(queryCache);
```

## useQuery

`useQuery` is a composable for data fetching.

```ts
// useQuery.ts
export interface UseQueryOptions<TData = unknown, TError = Error> {
  key: EntryKey | EntryKeyFn;
  query: (context: QueryContext) => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean | "always";
  initialData?: TData | (() => TData);
  enabled?: boolean | Ref<boolean> | ComputedRef<boolean>;
  retry?: number | boolean;
  retryDelay?: number;
  meta?: QueryMeta;
}

export interface UseQueryReturn<TData = unknown, TError = Error> {
  state: ComputedRef<DataState<TData, TError>>;
  asyncStatus: ComputedRef<AsyncStatus>;
  data: ComputedRef<TData | undefined>;
  error: ComputedRef<TError | null>;
  status: ComputedRef<DataStateStatus>;
  isPending: ComputedRef<boolean>;
  isLoading: ComputedRef<boolean>;
  isSuccess: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refresh: () => Promise<DataState<TData, TError>>;
  refetch: () => Promise<DataState<TData, TError>>;
}
```

### Options

- `key`: Unique key for the query (used as cache key)
- `query`: Async function to fetch data (receives `{ signal }`)
- `staleTime`: Time until data becomes "stale"
- `gcTime`: Time to keep unused cache (garbage collection)
- `enabled`: Whether to enable the query
- `retry`: Number of retries on error
- `initialData`: Initial data

### States

- `status`: Current status (`"pending"` | `"error"` | `"success"`)
- `asyncStatus`: Async status (`"idle"` | `"loading"`)
- `isPending`: No initial data yet
- `isLoading`: Initial fetching (`isPending` and `asyncStatus === "loading"`)
- `isSuccess`: Fetch succeeded
- `isError`: Fetch failed

### Difference between refresh and refetch

- `refresh()`: Only fetches if stale or error
- `refetch()`: Always fetches (invalidates cache first)

### Usage Example

```ts
import { useQuery } from "chibivue-fetch";

const { data, isLoading, error, refresh } = useQuery({
  key: ["user", userId],
  query: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then((res) => res.json()),
  staleTime: 60000, // Use cache for 1 minute
});
```

## useMutation

`useMutation` is a composable for data mutations (POST, PUT, DELETE, etc.).

```ts
// useMutation.ts
export interface UseMutationOptions<TData, TError, TVariables, TContext> {
  mutation: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
}

export interface UseMutationReturn<TData, TError, TVariables> {
  state: ComputedRef<DataState<TData, TError>>;
  asyncStatus: ComputedRef<AsyncStatus>;
  data: ComputedRef<TData | undefined>;
  error: ComputedRef<TError | null>;
  status: ComputedRef<DataStateStatus>;
  isPending: ComputedRef<boolean>;
  isLoading: ComputedRef<boolean>;
  isSuccess: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  variables: ShallowRef<TVariables | undefined>;
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}
```

### Lifecycle Callbacks

- `onMutate`: Called before mutation executes (returns context)
- `onSuccess`: Called on success
- `onError`: Called on error
- `onSettled`: Called at the end regardless of success or error

### Usage Example

```ts
import { useMutation } from "chibivue-fetch";

const { mutate, isLoading, isSuccess } = useMutation({
  mutation: (newUser) => fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(newUser),
  }).then((res) => res.json()),
  onSuccess: (data) => {
    console.log("User created:", data);
    // Invalidate cache to trigger refetch
    queryCache.invalidateQueries(["users"]);
  },
});

// Usage
mutate({ name: "John", email: "john@example.com" });
```

## How Caching Works

### Entry Key

`key` is used as the cache key. Array format allows hierarchical keys:

```ts
// Simple key
key: ["users"]

// Hierarchical key
key: ["users", userId]

// Key with object
key: ["users", { status: "active", page: 1 }]
```

Queries with the same `key` share the cache. Keys are serialized as sorted JSON, so object property order doesn't matter.

### Stale Time and GC Time

```
       ← staleTime →|← refetch window →|← gcTime →|
  fetch             stale               inactive   gc
    |-----------------|----------------------|-----|
    data arrives      data is stale         data removed
```

- **staleTime**: Period during which data is "fresh". Calling `refresh()` during this time won't fetch
- **gcTime**: Period to keep unused cache. After a component unmounts, cache is deleted after this period

```ts
// No refetch for 1 minute, keep cache for 5 minutes
useQuery({
  key: ["users"],
  query: fetchUsers,
  staleTime: 60 * 1000,  // 1 minute
  gcTime: 5 * 60 * 1000, // 5 minutes
});
```

### Dependency Tracking

Similar to Pinia Colada, chibivue-fetch tracks which components are using each query entry:

```ts
// Track when component mounts
onMounted(() => {
  queryCache.track(entry, currentInstance);
});

// Untrack when component unmounts
onUnmounted(() => {
  queryCache.untrack(entry, currentInstance);
});
```

When there are no more dependencies, the cache is garbage collected after `gcTime`.

## SSR Support

chibivue-fetch supports Server-Side Rendering (SSR).

### Server-Side: Serializing State

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createQueryCache, serializeQueryCache } from "chibivue-fetch";
import App from "./App.vue";

export async function render() {
  // Create new instances for each request
  const queryCache = createQueryCache();
  const app = createApp(App);
  app.use(queryCache);

  // Prefetch data on server
  await queryCache.prefetchQuery(
    ["users"],
    ({ signal }) => fetch("http://api/users", { signal }).then((r) => r.json()),
  );

  const html = await renderToString(app);

  // Serialize cache state
  const queryState = JSON.stringify(serializeQueryCache(queryCache));

  return { html, queryState };
}
```

### Serialization Format

Similar to Pinia Colada, we use relative timestamps for serialization:

```ts
// UseQueryEntryNodeSerialized = [data, error, when (relative), meta]
{
  '["users"]': [
    [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], // data
    null,                                                // error
    0,                                                   // when (relative: now - fetchTime)
    undefined                                            // meta
  ]
}
```

Relative timestamps handle time differences between server and client.

### Embedding in HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.__QUERY_STATE__ = ${queryState};
    </script>
  </head>
  <body>
    <div id="app">${html}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### Client-Side: Hydrating State

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createQueryCache, hydrateQueryCache } from "chibivue-fetch";
import App from "./App.vue";

const queryCache = createQueryCache();
const app = createApp(App);
app.use(queryCache);

// Hydrate with server state
if (window.__QUERY_STATE__) {
  hydrateQueryCache(queryCache, window.__QUERY_STATE__);
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

In SSR, similar to Store, you must be aware of **Cross-Request State Pollution**.
Call `createQueryCache()` inside the `render()` function and create new instances for each request.

</KawaikoNote>

## Practical Examples

### Reactive Query Key

```ts
import { ref, computed } from "chibivue";
import { useQuery } from "chibivue-fetch";

const page = ref(1);
const filters = ref({ status: "active" });

const { data, isLoading } = useQuery({
  // Function format for dynamic keys
  key: () => ["users", { page: page.value, ...filters.value }],
  query: ({ signal }) => fetchUsers(page.value, filters.value, signal),
});

// Automatically refetches when page or filters change
function nextPage() {
  page.value++;
}
```

### Conditional Query

```ts
const userId = ref<number | null>(null);

const { data: user } = useQuery({
  key: () => ["user", userId.value],
  query: ({ signal }) => fetchUser(userId.value!, signal),
  // Query won't execute while userId is null
  enabled: computed(() => userId.value !== null),
});
```

### Cache Update After Mutation

```ts
const queryCache = getActiveQueryCache();

const { mutate: createUser } = useMutation({
  mutation: (newUser) => api.createUser(newUser),
  onSuccess: (createdUser) => {
    // Method 1: Invalidate cache and refetch
    queryCache.invalidateQueries(["users"]);

    // Method 2: Update cache directly (optimistic update)
    const currentUsers = queryCache.getQueryData<User[]>(["users"]);
    if (currentUsers) {
      queryCache.setQueryData(["users"], [...currentUsers, createdUser]);
    }
  },
});
```

### Error Handling and Retry

```ts
const { data, error, refresh } = useQuery({
  key: ["users"],
  query: fetchUsers,
  retry: 3,        // Retry up to 3 times
  retryDelay: 1000, // Retry after 1 second
});

// In component
if (error.value) {
  // Show error and retry button
}
```

### Cancellation with AbortController

```ts
const { data } = useQuery({
  key: ["users"],
  query: async ({ signal }) => {
    const response = await fetch("/api/users", { signal });
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
  },
});
```

When a query is cancelled (e.g., when a new request starts), the `signal` is aborted.

## Summary

chibivue-fetch implementation consists of the following elements:

1. **QueryCache**: Centralized cache management and dependency tracking
2. **Data State Pattern**: Three-state model of `pending | error | success`
3. **useQuery**: Declarative data fetching API
4. **useMutation**: Data mutation management with lifecycle callbacks
5. **Cache Strategy**: Flexible control with staleTime / gcTime
6. **SSR Support**: State transfer via `serializeQueryCache()` / `hydrateQueryCache()`
7. **Reactive Keys**: Dynamic query key support
8. **Error Handling**: Automatic retry and state management
9. **AbortController**: Request cancellation support

By implementing the core features of Pinia Colada minimally, you can understand how data fetching works.
