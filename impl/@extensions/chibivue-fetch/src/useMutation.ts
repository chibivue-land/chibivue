import { computed, shallowRef } from "chibivue";
import type { UseMutationOptions, UseMutationReturn, DataState, AsyncStatus } from "./types";

// ============================================================================
// useMutation
// ============================================================================

export function useMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationReturn<TData, TError, TVariables> {
  const { mutation, onMutate, onSuccess, onError, onSettled } = options;

  // State
  const state = shallowRef<DataState<TData, TError>>({
    status: "pending",
    data: undefined,
    error: null,
  });
  const asyncStatus = shallowRef<AsyncStatus>("idle");
  const variables = shallowRef<TVariables | undefined>(undefined);

  function reset(): void {
    state.value = {
      status: "pending",
      data: undefined,
      error: null,
    };
    asyncStatus.value = "idle";
    variables.value = undefined;
  }

  async function mutateAsync(vars: TVariables): Promise<TData> {
    variables.value = vars;
    asyncStatus.value = "loading";

    let context: TContext | undefined;

    // Call onMutate before executing mutation
    if (onMutate) {
      try {
        context = await onMutate(vars);
      } catch {
        // Ignore onMutate errors
      }
    }

    try {
      const result = await mutation(vars);

      state.value = {
        status: "success",
        data: result,
        error: null,
      };
      asyncStatus.value = "idle";

      // Call onSuccess
      if (onSuccess) {
        await onSuccess(result, vars, context);
      }

      // Call onSettled
      if (onSettled) {
        await onSettled(result, null, vars, context);
      }

      return result;
    } catch (err) {
      const typedError = err as TError;

      state.value = {
        status: "error",
        data: state.value.data, // Keep previous data
        error: typedError,
      };
      asyncStatus.value = "idle";

      // Call onError
      if (onError) {
        await onError(typedError, vars, context);
      }

      // Call onSettled
      if (onSettled) {
        await onSettled(undefined, typedError, vars, context);
      }

      throw err;
    }
  }

  function mutate(vars: TVariables): void {
    mutateAsync(vars).catch(() => {
      // Error is already handled in mutateAsync
    });
  }

  // Return computed refs
  const stateComputed = computed(() => state.value);
  const asyncStatusComputed = computed(() => asyncStatus.value);

  return {
    state: stateComputed,
    asyncStatus: asyncStatusComputed,
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    status: computed(() => state.value.status),
    isPending: computed(() => state.value.status === "pending"),
    isLoading: computed(() => asyncStatus.value === "loading"),
    isSuccess: computed(() => state.value.status === "success"),
    isError: computed(() => state.value.status === "error"),
    variables,
    mutate,
    mutateAsync,
    reset,
  };
}
