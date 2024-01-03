import { registerRuntimeHelpers } from '@chibivue/compiler-core'

export const V_ON_WITH_MODIFIERS = Symbol()
export const V_ON_WITH_KEYS = Symbol()

registerRuntimeHelpers({
  [V_ON_WITH_MODIFIERS]: `withModifiers`,
  [V_ON_WITH_KEYS]: `withKeys`,
})
