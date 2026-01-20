# Data Fetch

## データフェッチライブラリとは

モダンな Web アプリケーションでは，サーバーからのデータ取得が頻繁に行われます．Vue.js エコシステムでは，Pinia Colada や TanStack Query などのライブラリがこの機能を提供しています．

この章では，Pinia Colada のような基本的なデータフェッチ機能を chibivue-fetch として実装します．

### なぜライブラリが必要なのか

単純なデータ取得は `fetch` と `ref` で十分に見えます：

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

しかし，この実装には以下の問題があります：

1. **キャッシュがない**: 同じデータを何度もフェッチしてしまう
2. **SSR 対応が難しい**: サーバーで取得したデータをクライアントに引き継げない
3. **重複リクエスト**: 同じコンポーネントを複数マウントすると重複リクエストが発生
4. **エラーハンドリング**: リトライや再フェッチのロジックが複雑になる

データフェッチライブラリは，これらの問題を解決し，宣言的な API を提供します．

## パッケージ構成

chibivue-fetch は `@extensions/chibivue-fetch` パッケージで提供されています．

```
@extensions/chibivue-fetch/src/
├── index.ts           # エクスポート
├── queryCache.ts      # QueryCache の実装（キャッシュ管理）
├── useQuery.ts        # データ取得用フック
├── useMutation.ts     # データ変更用フック
└── types.ts           # 型定義
```

## Data State パターン

Pinia Colada と同様に，chibivue-fetch はデータの状態を 3 つの状態で表現します：

```ts
type DataStateStatus = "pending" | "error" | "success";

type DataState<TData, TError> =
  | { status: "pending"; data: undefined; error: null }
  | { status: "error"; data: TData | undefined; error: TError }
  | { status: "success"; data: TData; error: null };
```

この状態モデルにより，データの状態を明確に追跡できます．

## QueryCache

`QueryCache` はキャッシュの管理と SSR のためのステート管理を担います．

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

### 主要なメソッド

- `ensure`: エントリを取得または作成
- `fetch`: クエリを実行（常に実行）
- `refresh`: クエリをリフレッシュ（stale または error の場合のみ実行）
- `invalidate`: エントリを無効化（stale にする）
- `invalidateQueries`: キーに一致するエントリを無効化
- `track` / `untrack`: コンポーネントの依存関係を追跡
- `setQueryData` / `getQueryData`: キャッシュデータの直接操作
- `prefetchQuery`: 事前にデータをフェッチしてキャッシュに格納

### createQueryCache

```ts
import { createQueryCache } from "chibivue-fetch";

const queryCache = createQueryCache({
  staleTime: 5000,       // デフォルトの stale time (5秒)
  gcTime: 300000,        // デフォルトの GC time (5分)
});

app.use(queryCache);
```

## useQuery

`useQuery` はデータ取得のためのコンポーザブルです．

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

### オプション

- `key`: クエリの一意なキー（キャッシュのキーになる）
- `query`: データを取得する非同期関数（`{ signal }` を受け取る）
- `staleTime`: データが「stale（古い）」になるまでの時間
- `gcTime`: 未使用のキャッシュを保持する期間（ガベージコレクション）
- `enabled`: クエリを有効にするかどうか
- `retry`: エラー時のリトライ回数
- `initialData`: 初期データ

### 状態

- `status`: 現在の状態（`"pending"` | `"error"` | `"success"`）
- `asyncStatus`: 非同期状態（`"idle"` | `"loading"`）
- `isPending`: 初期データがまだない状態
- `isLoading`: 初回フェッチ中（`isPending` かつ `asyncStatus === "loading"`）
- `isSuccess`: フェッチ成功
- `isError`: フェッチ失敗

### refresh と refetch の違い

- `refresh()`: stale または error の場合のみフェッチ
- `refetch()`: 常にフェッチ（キャッシュを無効化してから）

### 使用例

```ts
import { useQuery } from "chibivue-fetch";

const { data, isLoading, error, refresh } = useQuery({
  key: ["user", userId],
  query: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then((res) => res.json()),
  staleTime: 60000, // 1分間はキャッシュを使用
});
```

## useMutation

`useMutation` はデータ変更（POST, PUT, DELETE など）のためのコンポーザブルです．

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

### ライフサイクルコールバック

- `onMutate`: mutation 実行前に呼ばれる（context を返す）
- `onSuccess`: 成功時に呼ばれる
- `onError`: エラー時に呼ばれる
- `onSettled`: 成功・エラーに関わらず最後に呼ばれる

### 使用例

```ts
import { useMutation } from "chibivue-fetch";

const { mutate, isLoading, isSuccess } = useMutation({
  mutation: (newUser) => fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(newUser),
  }).then((res) => res.json()),
  onSuccess: (data) => {
    console.log("User created:", data);
    // キャッシュを無効化して再フェッチをトリガー
    queryCache.invalidateQueries(["users"]);
  },
});

// 使用
mutate({ name: "John", email: "john@example.com" });
```

## キャッシュの仕組み

### Entry Key

`key` はキャッシュのキーとして使用されます．配列形式で階層的なキーを表現できます：

```ts
// 単純なキー
key: ["users"]

// 階層的なキー
key: ["users", userId]

// オブジェクトを含むキー
key: ["users", { status: "active", page: 1 }]
```

同じ `key` を持つクエリはキャッシュを共有します．キーはソートされた JSON として直列化されるため，オブジェクトのプロパティの順序は関係ありません．

### Stale Time と GC Time

```
       ← staleTime →|← refetch window →|← gcTime →|
  fetch             stale               inactive   gc
    |-----------------|----------------------|-----|
    data arrives      data is stale         data removed
```

- **staleTime**: データが「fresh」である期間．この間は `refresh()` を呼んでもフェッチしない
- **gcTime**: 未使用のキャッシュを保持する期間．コンポーネントがアンマウントされてから，この期間が経過するとキャッシュが削除される

```ts
// 1分間は再フェッチしない，5分間キャッシュを保持
useQuery({
  key: ["users"],
  query: fetchUsers,
  staleTime: 60 * 1000,  // 1 minute
  gcTime: 5 * 60 * 1000, // 5 minutes
});
```

### 依存関係追跡

Pinia Colada と同様に，chibivue-fetch は各クエリエントリがどのコンポーネントで使用されているかを追跡します：

```ts
// コンポーネントがマウントされると track
onMounted(() => {
  queryCache.track(entry, currentInstance);
});

// コンポーネントがアンマウントされると untrack
onUnmounted(() => {
  queryCache.untrack(entry, currentInstance);
});
```

依存関係がなくなると，`gcTime` 後にキャッシュがガベージコレクションされます．

## SSR 対応

chibivue-fetch は SSR に対応しています．

### サーバー側：状態のシリアライズ

```ts
// server.ts
import { createApp } from "chibivue";
import { renderToString } from "@chibivue/server-renderer";
import { createQueryCache, serializeQueryCache } from "chibivue-fetch";
import App from "./App.vue";

export async function render() {
  // リクエストごとに新しいインスタンスを作成
  const queryCache = createQueryCache();
  const app = createApp(App);
  app.use(queryCache);

  // prefetch でサーバー側でデータを取得
  await queryCache.prefetchQuery(
    ["users"],
    ({ signal }) => fetch("http://api/users", { signal }).then((r) => r.json()),
  );

  const html = await renderToString(app);

  // キャッシュ状態をシリアライズ
  const queryState = JSON.stringify(serializeQueryCache(queryCache));

  return { html, queryState };
}
```

### シリアライズ形式

Pinia Colada と同様に，相対タイムスタンプを使用してシリアライズします：

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

相対タイムスタンプにより，サーバーとクライアントの時刻のずれを考慮できます．

### HTML への埋め込み

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

### クライアント側：状態のハイドレート

```ts
// main.ts (client)
import { createApp } from "chibivue";
import { createQueryCache, hydrateQueryCache } from "chibivue-fetch";
import App from "./App.vue";

const queryCache = createQueryCache();
const app = createApp(App);
app.use(queryCache);

// サーバーの状態でハイドレート
if (window.__QUERY_STATE__) {
  hydrateQueryCache(queryCache, window.__QUERY_STATE__);
}

app.mount("#app");
```

<KawaikoNote variant="warning" title="Cross-Request State Pollution">

SSR では，Store と同様に **Cross-Request State Pollution** に注意が必要です．
`createQueryCache()` は `render()` 関数内で呼び出し，リクエストごとに新しいインスタンスを作成してください．

</KawaikoNote>

## 実践的な使用例

### リアクティブな Query Key

```ts
import { ref, computed } from "chibivue";
import { useQuery } from "chibivue-fetch";

const page = ref(1);
const filters = ref({ status: "active" });

const { data, isLoading } = useQuery({
  // 関数形式で動的なキーを生成
  key: () => ["users", { page: page.value, ...filters.value }],
  query: ({ signal }) => fetchUsers(page.value, filters.value, signal),
});

// page や filters が変わると自動的に再フェッチ
function nextPage() {
  page.value++;
}
```

### 条件付きクエリ

```ts
const userId = ref<number | null>(null);

const { data: user } = useQuery({
  key: () => ["user", userId.value],
  query: ({ signal }) => fetchUser(userId.value!, signal),
  // userId が null の間はクエリを実行しない
  enabled: computed(() => userId.value !== null),
});
```

### Mutation 後のキャッシュ更新

```ts
const queryCache = getActiveQueryCache();

const { mutate: createUser } = useMutation({
  mutation: (newUser) => api.createUser(newUser),
  onSuccess: (createdUser) => {
    // 方法1: キャッシュを無効化して再フェッチ
    queryCache.invalidateQueries(["users"]);

    // 方法2: キャッシュを直接更新（楽観的更新）
    const currentUsers = queryCache.getQueryData<User[]>(["users"]);
    if (currentUsers) {
      queryCache.setQueryData(["users"], [...currentUsers, createdUser]);
    }
  },
});
```

### エラーハンドリングとリトライ

```ts
const { data, error, refresh } = useQuery({
  key: ["users"],
  query: fetchUsers,
  retry: 3,        // 3回までリトライ
  retryDelay: 1000, // 1秒後にリトライ
});

// コンポーネント内で
if (error.value) {
  // エラー表示とリトライボタン
}
```

### AbortController による中断

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

クエリが中断されると（新しいリクエストが開始された場合など），`signal` が abort されます．

## まとめ

chibivue-fetch の実装は以下の要素で構成されています：

1. **QueryCache**: キャッシュの一元管理と依存関係追跡
2. **Data State パターン**: `pending | error | success` の 3 状態モデル
3. **useQuery**: 宣言的なデータ取得 API
4. **useMutation**: データ変更の管理とライフサイクルコールバック
5. **キャッシュ戦略**: staleTime / gcTime による柔軟な制御
6. **SSR 対応**: `serializeQueryCache()` / `hydrateQueryCache()` によるステートの転送
7. **リアクティブキー**: 動的なクエリキーのサポート
8. **エラーハンドリング**: 自動リトライと状態管理
9. **AbortController**: リクエストの中断サポート

Pinia Colada の主要な機能をミニマルに実装することで，データフェッチの仕組みを理解できます．
