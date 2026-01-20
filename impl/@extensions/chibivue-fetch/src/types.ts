import type { Ref, ShallowRef, ComputedRef, EffectScope } from "chibivue";

// ============================================================================
// Entry Key Types (like Pinia Colada)
// ============================================================================

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };
export type EntryKey = readonly JSONValue[];
export type EntryKeyFn = () => EntryKey;

// ============================================================================
// Data State Types (Pinia Colada pattern: pending | error | success)
// ============================================================================

export type DataStateStatus = "pending" | "error" | "success";
export type AsyncStatus = "idle" | "loading";

export interface DataState_Pending {
  status: "pending";
  data: undefined;
  error: null;
}

export interface DataState_Error<TData = unknown, TError = Error> {
  status: "error";
  data: TData | undefined;
  error: TError;
}

export interface DataState_Success<TData = unknown> {
  status: "success";
  data: TData;
  error: null;
}

export type DataState<TData = unknown, TError = Error> =
  | DataState_Pending
  | DataState_Error<TData, TError>
  | DataState_Success<TData>;

// ============================================================================
// Query Entry Types
// ============================================================================

export interface QueryMeta {
  [key: string]: unknown;
}

export interface UseQueryEntry<TData = unknown, TError = Error> {
  /** Current data state */
  state: ShallowRef<DataState<TData, TError>>;
  /** Async status: idle or loading */
  asyncStatus: ShallowRef<AsyncStatus>;
  /** Query key */
  key: EntryKey;
  /** Serialized key hash */
  keyHash: string;
  /** Last update timestamp */
  when: number;
  /** Custom metadata */
  meta?: QueryMeta;
  /** Active dependencies (components/scopes using this entry) */
  deps: Set<EffectScope | object>;
  /** Pending request info */
  pending: null | {
    abortController: AbortController;
    refreshCall: Promise<DataState<TData, TError>>;
    when: number;
  };
  /** Query options */
  options: UseQueryOptionsWithDefaults<TData, TError> | null;
  /** GC timeout ID */
  gcTimeout?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Query Options Types
// ============================================================================

export interface UseQueryOptions<TData = unknown, TError = Error> {
  /** Unique key for the query */
  key: EntryKey | EntryKeyFn;
  /** Function to fetch data */
  query: (context: QueryContext) => Promise<TData>;
  /** Time in ms before data is considered stale (default: 5000) */
  staleTime?: number;
  /** Time in ms to keep unused data in cache (default: 300000 / 5 minutes) */
  gcTime?: number;
  /** Whether to refetch on mount if data is stale (default: true) */
  refetchOnMount?: boolean | "always";
  /** Initial data to use before fetch completes */
  initialData?: TData | (() => TData);
  /** Whether the query is enabled (default: true) */
  enabled?: boolean | Ref<boolean> | ComputedRef<boolean>;
  /** Retry count on failure (default: 3) */
  retry?: number | boolean;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Custom metadata */
  meta?: QueryMeta;
}

export interface UseQueryOptionsWithDefaults<TData = unknown, TError = Error> extends Required<
  Pick<
    UseQueryOptions<TData, TError>,
    "staleTime" | "gcTime" | "refetchOnMount" | "retry" | "retryDelay"
  >
> {
  key: EntryKey | EntryKeyFn;
  query: (context: QueryContext) => Promise<TData>;
  initialData?: TData | (() => TData);
  enabled?: boolean | Ref<boolean> | ComputedRef<boolean>;
  meta?: QueryMeta;
}

export interface QueryContext {
  /** Abort signal for cancellation */
  signal: AbortSignal;
}

// ============================================================================
// Query Result Types
// ============================================================================

export interface UseQueryReturn<TData = unknown, TError = Error> {
  /** Current data state */
  state: ComputedRef<DataState<TData, TError>>;
  /** Async status */
  asyncStatus: ComputedRef<AsyncStatus>;
  /** The fetched data */
  data: ComputedRef<TData | undefined>;
  /** Error if the query failed */
  error: ComputedRef<TError | null>;
  /** Current status */
  status: ComputedRef<DataStateStatus>;
  /** Whether initial data is being loaded (no data yet) */
  isPending: ComputedRef<boolean>;
  /** Whether currently loading (pending + fetching) */
  isLoading: ComputedRef<boolean>;
  /** Whether the query has successfully fetched */
  isSuccess: ComputedRef<boolean>;
  /** Whether the query failed */
  isError: ComputedRef<boolean>;
  /** Refresh the query (only if stale or error) */
  refresh: () => Promise<DataState<TData, TError>>;
  /** Refetch the query (always fetch) */
  refetch: () => Promise<DataState<TData, TError>>;
}

// ============================================================================
// Mutation Types
// ============================================================================

export interface UseMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
> {
  /** Function to perform the mutation */
  mutation: (variables: TVariables) => Promise<TData>;
  /** Called before mutation executes */
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  /** Callback on successful mutation */
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
  /** Callback on failed mutation */
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
  /** Callback when mutation is settled (success or error) */
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
}

export interface UseMutationReturn<TData = unknown, TError = Error, TVariables = void> {
  /** Current data state */
  state: ComputedRef<DataState<TData, TError>>;
  /** Async status */
  asyncStatus: ComputedRef<AsyncStatus>;
  /** The mutation result data */
  data: ComputedRef<TData | undefined>;
  /** Error if the mutation failed */
  error: ComputedRef<TError | null>;
  /** Current status */
  status: ComputedRef<DataStateStatus>;
  /** Whether initial state (no mutation yet) */
  isPending: ComputedRef<boolean>;
  /** Whether the mutation is in progress */
  isLoading: ComputedRef<boolean>;
  /** Whether the mutation was successful */
  isSuccess: ComputedRef<boolean>;
  /** Whether the mutation failed */
  isError: ComputedRef<boolean>;
  /** Current variables */
  variables: ShallowRef<TVariables | undefined>;
  /** Execute the mutation (fire and forget) */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Reset the mutation state */
  reset: () => void;
}

// ============================================================================
// Query Cache Types
// ============================================================================

export interface QueryCacheOptions {
  /** Default stale time for all queries (default: 5000ms) */
  staleTime?: number;
  /** Default GC time for all queries (default: 300000ms / 5 minutes) */
  gcTime?: number;
}

// ============================================================================
// SSR Serialization Types
// ============================================================================

/**
 * Serialized format for query entry:
 * [data, error, when (relative), meta]
 */
export type UseQueryEntryNodeSerialized<TData = unknown, TError = Error> = [
  data: TData | undefined,
  error: TError | null,
  when?: number,
  meta?: QueryMeta,
];

export type SerializedQueryCache = Record<string, UseQueryEntryNodeSerialized>;
