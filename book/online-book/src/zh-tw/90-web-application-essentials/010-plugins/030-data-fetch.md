# Data Fetch

## 什麼是資料獲取庫？

現代 Web 應用程式頻繁地從伺服器獲取資料．在 Vue.js 生態系統中，Pinia Colada 和 TanStack Query 等庫提供了這個功能．

在本章中，我們將實現類似 Pinia Colada 的基本資料獲取功能，作為 chibivue-fetch．

### 為什麼需要庫？

簡單的資料獲取用 `fetch` 和 `ref` 似乎就足夠了：

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

但是，這個實現有以下問題：

1. **沒有快取**：相同的資料會被多次獲取
2. **SSR 困難**：無法將伺服器獲取的資料傳輸到客戶端
3. **重複請求**：相同組件多次掛載會導致重複請求
4. **錯誤處理**：重試和重新獲取的邏輯變得複雜

資料獲取庫解決了這些問題，並提供了宣告式的 API．

## 套件結構

chibivue-fetch 在 `@extensions/chibivue-fetch` 套件中提供．

```
@extensions/chibivue-fetch/src/
├── index.ts           # 導出
├── queryCache.ts      # QueryCache 實現（快取管理）
├── useQuery.ts        # 資料獲取 hook
├── useMutation.ts     # 資料變更 hook
└── types.ts           # 類型定義
```

## Data State 模式

與 Pinia Colada 類似，chibivue-fetch 用三種狀態表示資料狀態：

```ts
type DataStateStatus = "pending" | "error" | "success";

type DataState<TData, TError> =
  | { status: "pending"; data: undefined; error: null }
  | { status: "error"; data: TData | undefined; error: TError }
  | { status: "success"; data: TData; error: null };
```

這種狀態模型可以清楚地追蹤資料狀態．

## QueryCache

`QueryCache` 負責快取管理和 SSR 的狀態管理．

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

- `ensure`: 獲取或創建條目
- `fetch`: 執行查詢（總是執行）
- `refresh`: 刷新查詢（僅在 stale 或 error 時執行）
- `invalidate`: 使條目失效（標記為 stale）
- `invalidateQueries`: 使匹配鍵的條目失效
- `track` / `untrack`: 追蹤組件依賴關係
- `setQueryData` / `getQueryData`: 直接操作快取資料
- `prefetchQuery`: 預先獲取資料並儲存到快取

### createQueryCache

```ts
import { createQueryCache } from "chibivue-fetch";

const queryCache = createQueryCache({
  staleTime: 5000,       // 預設的 stale time (5秒)
  gcTime: 300000,        // 預設的 GC time (5分鐘)
});

app.use(queryCache);
```

## useQuery

`useQuery` 是用於資料獲取的組合式函式．

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

### 選項

- `key`: 查詢的唯一鍵（作為快取鍵使用）
- `query`: 獲取資料的非同步函式（接收 `{ signal }`）
- `staleTime`: 資料變為「stale（過期）」的時間
- `gcTime`: 保留未使用快取的期間（垃圾回收）
- `enabled`: 是否啟用查詢
- `retry`: 錯誤時的重試次數
- `initialData`: 初始資料

### 狀態

- `status`: 當前狀態（`"pending"` | `"error"` | `"success"`）
- `asyncStatus`: 非同步狀態（`"idle"` | `"loading"`）
- `isPending`: 還沒有初始資料
- `isLoading`: 初次獲取中（`isPending` 且 `asyncStatus === "loading"`）
- `isSuccess`: 獲取成功
- `isError`: 獲取失敗

### refresh 和 refetch 的區別

- `refresh()`: 僅在 stale 或 error 時獲取
- `refetch()`: 總是獲取（先使快取失效）

### 使用範例

```ts
import { useQuery } from "chibivue-fetch";

const { data, isLoading, error, refresh } = useQuery({
  key: ["user", userId],
  query: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then((res) => res.json()),
  staleTime: 60000, // 1分鐘內使用快取
});
```

## useMutation

`useMutation` 是用於資料變更（POST，PUT，DELETE 等）的組合式函式．

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

### 生命週期回調

- `onMutate`: mutation 執行前呼叫（返回 context）
- `onSuccess`: 成功時呼叫
- `onError`: 錯誤時呼叫
- `onSettled`: 成功或錯誤後最後呼叫

### 使用範例

```ts
import { useMutation } from "chibivue-fetch";

const { mutate, isLoading, isSuccess } = useMutation({
  mutation: (newUser) => fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(newUser),
  }).then((res) => res.json()),
  onSuccess: (data) => {
    console.log("User created:", data);
    // 使快取失效以觸發重新獲取
    queryCache.invalidateQueries(["users"]);
  },
});

// 使用
mutate({ name: "John", email: "john@example.com" });
```

## 快取的運作方式

### Entry Key

`key` 作為快取鍵使用．陣列格式可以表示階層式的鍵：

```ts
// 簡單的鍵
key: ["users"]

// 階層式的鍵
key: ["users", userId]

// 包含物件的鍵
key: ["users", { status: "active", page: 1 }]
```

具有相同 `key` 的查詢共享快取．鍵會被序列化為排序後的 JSON，因此物件屬性的順序不重要．

### Stale Time 和 GC Time

```
       ← staleTime →|← refetch window →|← gcTime →|
  fetch             stale               inactive   gc
    |-----------------|----------------------|-----|
    data arrives      data is stale         data removed
```

- **staleTime**: 資料保持「fresh」的期間．在此期間呼叫 `refresh()` 不會重新獲取
- **gcTime**: 保留未使用快取的期間．組件卸載後，經過此期間快取會被刪除

```ts
// 1分鐘內不重新獲取，保留快取5分鐘
useQuery({
  key: ["users"],
  query: fetchUsers,
  staleTime: 60 * 1000,  // 1 minute
  gcTime: 5 * 60 * 1000, // 5 minutes
});
```

### 依賴關係追蹤

與 Pinia Colada 類似，chibivue-fetch 追蹤每個查詢條目被哪些組件使用：

```ts
// 組件掛載時追蹤
onMounted(() => {
  queryCache.track(entry, currentInstance);
});

// 組件卸載時取消追蹤
onUnmounted(() => {
  queryCache.untrack(entry, currentInstance);
});
```

當沒有依賴關係時，快取會在 `gcTime` 後被垃圾回收．

## SSR 支援

chibivue-fetch 支援伺服器端渲染（SSR）．

### 伺服器端：序列化狀態

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createQueryCache, serializeQueryCache } from "chibivue-fetch";
import App from "./App.vue";

export async function render() {
  // 為每個請求創建新實例
  const queryCache = createQueryCache();
  const app = createApp(App);
  app.use(queryCache);

  // 在伺服器端預先獲取資料
  await queryCache.prefetchQuery(
    ["users"],
    ({ signal }) => fetch("http://api/users", { signal }).then((r) => r.json()),
  );

  const html = await renderToString(app);

  // 序列化快取狀態
  const queryState = JSON.stringify(serializeQueryCache(queryCache));

  return { html, queryState };
}
```

### 序列化格式

與 Pinia Colada 類似，我們使用相對時間戳進行序列化：

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

相對時間戳可以處理伺服器和客戶端之間的時間差異．

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

### 客戶端：水合狀態

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createQueryCache, hydrateQueryCache } from "chibivue-fetch";
import App from "./App.vue";

const queryCache = createQueryCache();
const app = createApp(App);
app.use(queryCache);

// 使用伺服器狀態水合
if (window.__QUERY_STATE__) {
  hydrateQueryCache(queryCache, window.__QUERY_STATE__);
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

在 SSR 中，與 Store 類似，您必須注意 **Cross-Request State Pollution**．
在 `render()` 函式內呼叫 `createQueryCache()`，為每個請求創建新實例．

</KawaikoNote>

## 實用範例

### 響應式 Query Key

```ts
import { ref, computed } from "chibivue";
import { useQuery } from "chibivue-fetch";

const page = ref(1);
const filters = ref({ status: "active" });

const { data, isLoading } = useQuery({
  // 函式格式用於動態鍵
  key: () => ["users", { page: page.value, ...filters.value }],
  query: ({ signal }) => fetchUsers(page.value, filters.value, signal),
});

// 當 page 或 filters 改變時自動重新獲取
function nextPage() {
  page.value++;
}
```

### 條件式查詢

```ts
const userId = ref<number | null>(null);

const { data: user } = useQuery({
  key: () => ["user", userId.value],
  query: ({ signal }) => fetchUser(userId.value!, signal),
  // userId 為 null 時不執行查詢
  enabled: computed(() => userId.value !== null),
});
```

### Mutation 後更新快取

```ts
const queryCache = getActiveQueryCache();

const { mutate: createUser } = useMutation({
  mutation: (newUser) => api.createUser(newUser),
  onSuccess: (createdUser) => {
    // 方法1：使快取失效並重新獲取
    queryCache.invalidateQueries(["users"]);

    // 方法2：直接更新快取（樂觀更新）
    const currentUsers = queryCache.getQueryData<User[]>(["users"]);
    if (currentUsers) {
      queryCache.setQueryData(["users"], [...currentUsers, createdUser]);
    }
  },
});
```

### 錯誤處理和重試

```ts
const { data, error, refresh } = useQuery({
  key: ["users"],
  query: fetchUsers,
  retry: 3,        // 最多重試3次
  retryDelay: 1000, // 1秒後重試
});

// 在組件中
if (error.value) {
  // 顯示錯誤和重試按鈕
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

當查詢被取消時（例如，當新請求開始時），`signal` 會被 abort．

## 總結

chibivue-fetch 實現包括以下要素：

1. **QueryCache**：集中式快取管理和依賴關係追蹤
2. **Data State 模式**：`pending | error | success` 的三狀態模型
3. **useQuery**：宣告式資料獲取 API
4. **useMutation**：資料變更管理和生命週期回調
5. **快取策略**：通過 staleTime / gcTime 靈活控制
6. **SSR 支援**：通過 `serializeQueryCache()` / `hydrateQueryCache()` 傳輸狀態
7. **響應式鍵**：動態查詢鍵支援
8. **錯誤處理**：自動重試和狀態管理
9. **AbortController**：請求取消支援

通過最小化實現 Pinia Colada 的核心功能，您可以理解資料獲取的運作方式．
