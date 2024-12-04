import type {
  CompilerOptions,
  DirectiveTransform,
  ParserOptions,
  RootNode,
} from '@chibivue/compiler-core'
import { baseCompile, baseParse } from '@chibivue/compiler-core'

import type { CodegenResult } from './codegen'
import { parserOptions } from './parserOptions'
import { transformModel } from './transforms/vModel'
import { transformOn } from './transforms/vOn'

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  on: transformOn,
  model: transformModel, // override compiler-core
}

export function compile(
  template: string,
  options: CompilerOptions,
): CodegenResult {
  return baseCompile(template, {
    ...options,
    ...parserOptions,
    directiveTransforms: {
      ...options.directiveTransforms,
      ...DOMDirectiveTransforms,
    },
  }) as any
}

export function parse(template: string, options: ParserOptions = {}): RootNode {
  return baseParse(template, { ...options, ...parserOptions })
}
