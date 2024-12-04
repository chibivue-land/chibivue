import type { DirectiveTransform, NodeTransform } from './transform'

export type CompilerOptions = {
  isBrowser?: boolean
}

export interface TransformOptions {
  nodeTransforms?: NodeTransform[]
  directiveTransforms?: Record<string, DirectiveTransform | undefined>
}
