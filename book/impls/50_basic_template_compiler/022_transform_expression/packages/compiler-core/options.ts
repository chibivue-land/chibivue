import type { DirectiveTransform, NodeTransform } from './transform'

export type CompilerOptions = TransformOptions

export interface TransformOptions {
  isBrowser?: boolean
  nodeTransforms?: NodeTransform[]
  directiveTransforms?: Record<string, DirectiveTransform | undefined>
}
