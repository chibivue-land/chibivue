# Data Fetch

## 什么是数据获取库？

现代 Web 应用程序频繁地从服务器获取数据．在 Vue.js 生态系统中，Pinia Colada 和 TanStack Query 等库提供了这个功能．

在本章中，我们将实现类似 Pinia Colada 的基本数据获取功能，作为 chibivue-fetch．

### 为什么需要库？

简单的数据获取用 `fetch` 和 `ref` 似乎就足够了：

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

但是，这个实现有以下问题：

1. **没有缓存**：相同的数据会被多次获取
2. **SSR 困难**：无法将服务器获取的数据传输到客户端
3. **重复请求**：相同组件多次挂载会导致重复请求
4. **错误处理**：重试和重新获取的逻辑变得复杂

数据获取库解决了这些问题，并提供了声明式的 API．

## 包结构

chibivue-fetch 在 `@extensions/chibivue-fetch` 包中提供．

```
@extensions/chibivue-fetch/src/
├── index.ts           # 导出
├── queryCache.ts      # QueryCache 实现（缓存管理）
├── useQuery.ts        # 数据获取 hook
├── useMutation.ts     # 数据变更 hook
└── types.ts           # 类型定义
```

## Data State 模式

与 Pinia Colada 类似，chibivue-fetch 用三种状态表示数据状态：

```ts
type DataStateStatus = "pending" | "error" | "success";

type DataState<TData, TError> =
  | { status: "pending"; data: undefined; error: null }
  | { status: "error"; data: TData | undefined; error: TError }
  | { status: "success"; data: TData; error: null };
```

这种状态模型可以清楚地追踪数据状态．

## QueryCache

`QueryCache` 负责缓存管理和 SSR 的状态管理．

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

### 主要方法

- `ensure`: 获取或创建条目
- `fetch`: 执行查询（总是执行）
- `refresh`: 刷新查询（仅在 stale 或 error 时执行）
- `invalidate`: 使条目失效（标记为 stale）
- `invalidateQueries`: 使匹配键的条目失效
- `track` / `untrack`: 追踪组件依赖关系
- `setQueryData` / `getQueryData`: 直接操作缓存数据
- `prefetchQuery`: 预先获取数据并存储到缓存

### createQueryCache

```ts
import { createQueryCache } from "chibivue-fetch";

const queryCache = createQueryCache({
  staleTime: 5000,       // 默认的 stale time (5秒)
  gcTime: 300000,        // 默认的 GC time (5分钟)
});

app.use(queryCache);
```

## useQuery

`useQuery` 是用于数据获取的组合式函数．

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

### 选项

- `key`: 查询的唯一键（作为缓存键使用）
- `query`: 获取数据的异步函数（接收 `{ signal }`）
- `staleTime`: 数据变为「stale（过期）」的时间
- `gcTime`: 保留未使用缓存的期间（垃圾回收）
- `enabled`: 是否启用查询
- `retry`: 错误时的重试次数
- `initialData`: 初始数据

### 状态

- `status`: 当前状态（`"pending"` | `"error"` | `"success"`）
- `asyncStatus`: 异步状态（`"idle"` | `"loading"`）
- `isPending`: 还没有初始数据
- `isLoading`: 初次获取中（`isPending` 且 `asyncStatus === "loading"`）
- `isSuccess`: 获取成功
- `isError`: 获取失败

### refresh 和 refetch 的区别

- `refresh()`: 仅在 stale 或 error 时获取
- `refetch()`: 总是获取（先使缓存失效）

### 使用示例

```ts
import { useQuery } from "chibivue-fetch";

const { data, isLoading, error, refresh } = useQuery({
  key: ["user", userId],
  query: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then((res) => res.json()),
  staleTime: 60000, // 1分钟内使用缓存
});
```

## useMutation

`useMutation` 是用于数据变更（POST，PUT，DELETE 等）的组合式函数．

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

### 生命周期回调

- `onMutate`: mutation 执行前调用（返回 context）
- `onSuccess`: 成功时调用
- `onError`: 错误时调用
- `onSettled`: 成功或错误后最后调用

### 使用示例

```ts
import { useMutation } from "chibivue-fetch";

const { mutate, isLoading, isSuccess } = useMutation({
  mutation: (newUser) => fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(newUser),
  }).then((res) => res.json()),
  onSuccess: (data) => {
    console.log("User created:", data);
    // 使缓存失效以触发重新获取
    queryCache.invalidateQueries(["users"]);
  },
});

// 使用
mutate({ name: "John", email: "john@example.com" });
```

## 缓存的工作方式

### Entry Key

`key` 作为缓存键使用．数组格式可以表示层级式的键：

```ts
// 简单的键
key: ["users"]

// 层级式的键
key: ["users", userId]

// 包含对象的键
key: ["users", { status: "active", page: 1 }]
```

具有相同 `key` 的查询共享缓存．键会被序列化为排序后的 JSON，因此对象属性的顺序不重要．

### Stale Time 和 GC Time

```
       ← staleTime →|← refetch window →|← gcTime →|
  fetch             stale               inactive   gc
    |-----------------|----------------------|-----|
    data arrives      data is stale         data removed
```

- **staleTime**: 数据保持「fresh」的期间．在此期间调用 `refresh()` 不会重新获取
- **gcTime**: 保留未使用缓存的期间．组件卸载后，经过此期间缓存会被删除

```ts
// 1分钟内不重新获取，保留缓存5分钟
useQuery({
  key: ["users"],
  query: fetchUsers,
  staleTime: 60 * 1000,  // 1 minute
  gcTime: 5 * 60 * 1000, // 5 minutes
});
```

### 依赖关系追踪

与 Pinia Colada 类似，chibivue-fetch 追踪每个查询条目被哪些组件使用：

```ts
// 组件挂载时追踪
onMounted(() => {
  queryCache.track(entry, currentInstance);
});

// 组件卸载时取消追踪
onUnmounted(() => {
  queryCache.untrack(entry, currentInstance);
});
```

当没有依赖关系时，缓存会在 `gcTime` 后被垃圾回收．

## SSR 支持

chibivue-fetch 支持服务器端渲染（SSR）．

### 服务器端：序列化状态

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createQueryCache, serializeQueryCache } from "chibivue-fetch";
import App from "./App.vue";

export async function render() {
  // 为每个请求创建新实例
  const queryCache = createQueryCache();
  const app = createApp(App);
  app.use(queryCache);

  // 在服务器端预先获取数据
  await queryCache.prefetchQuery(
    ["users"],
    ({ signal }) => fetch("http://api/users", { signal }).then((r) => r.json()),
  );

  const html = await renderToString(app);

  // 序列化缓存状态
  const queryState = JSON.stringify(serializeQueryCache(queryCache));

  return { html, queryState };
}
```

### 序列化格式

与 Pinia Colada 类似，我们使用相对时间戳进行序列化：

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

相对时间戳可以处理服务器和客户端之间的时间差异．

### 嵌入 HTML

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

### 客户端：水合状态

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createQueryCache, hydrateQueryCache } from "chibivue-fetch";
import App from "./App.vue";

const queryCache = createQueryCache();
const app = createApp(App);
app.use(queryCache);

// 使用服务器状态水合
if (window.__QUERY_STATE__) {
  hydrateQueryCache(queryCache, window.__QUERY_STATE__);
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

在 SSR 中，与 Store 类似，您必须注意 **Cross-Request State Pollution**．
在 `render()` 函数内调用 `createQueryCache()`，为每个请求创建新实例．

</KawaikoNote>

## 实用示例

### 响应式 Query Key

```ts
import { ref, computed } from "chibivue";
import { useQuery } from "chibivue-fetch";

const page = ref(1);
const filters = ref({ status: "active" });

const { data, isLoading } = useQuery({
  // 函数格式用于动态键
  key: () => ["users", { page: page.value, ...filters.value }],
  query: ({ signal }) => fetchUsers(page.value, filters.value, signal),
});

// 当 page 或 filters 改变时自动重新获取
function nextPage() {
  page.value++;
}
```

### 条件式查询

```ts
const userId = ref<number | null>(null);

const { data: user } = useQuery({
  key: () => ["user", userId.value],
  query: ({ signal }) => fetchUser(userId.value!, signal),
  // userId 为 null 时不执行查询
  enabled: computed(() => userId.value !== null),
});
```

### Mutation 后更新缓存

```ts
const queryCache = getActiveQueryCache();

const { mutate: createUser } = useMutation({
  mutation: (newUser) => api.createUser(newUser),
  onSuccess: (createdUser) => {
    // 方法1：使缓存失效并重新获取
    queryCache.invalidateQueries(["users"]);

    // 方法2：直接更新缓存（乐观更新）
    const currentUsers = queryCache.getQueryData<User[]>(["users"]);
    if (currentUsers) {
      queryCache.setQueryData(["users"], [...currentUsers, createdUser]);
    }
  },
});
```

### 错误处理和重试

```ts
const { data, error, refresh } = useQuery({
  key: ["users"],
  query: fetchUsers,
  retry: 3,        // 最多重试3次
  retryDelay: 1000, // 1秒后重试
});

// 在组件中
if (error.value) {
  // 显示错误和重试按钮
}
```

### 使用 AbortController 取消

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

当查询被取消时（例如，当新请求开始时），`signal` 会被 abort．

## 总结

chibivue-fetch 实现包括以下要素：

1. **QueryCache**：集中式缓存管理和依赖关系追踪
2. **Data State 模式**：`pending | error | success` 的三状态模型
3. **useQuery**：声明式数据获取 API
4. **useMutation**：数据变更管理和生命周期回调
5. **缓存策略**：通过 staleTime / gcTime 灵活控制
6. **SSR 支持**：通过 `serializeQueryCache()` / `hydrateQueryCache()` 传输状态
7. **响应式键**：动态查询键支持
8. **错误处理**：自动重试和状态管理
9. **AbortController**：请求取消支持

通过最小化实现 Pinia Colada 的核心功能，您可以理解数据获取的工作方式．
