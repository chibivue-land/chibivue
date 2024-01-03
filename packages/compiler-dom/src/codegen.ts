import type { RootNode } from '@chibivue/compiler-core'

export interface CodegenResult {
  code: string
  preamble: string
  ast: RootNode
}
