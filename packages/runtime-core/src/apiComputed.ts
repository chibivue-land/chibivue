import { computed as _computed } from '@chibivue/reactivity'

export const computed = ((getter: any) => {
  return _computed(getter)
}) as typeof _computed
