import { generate } from './codegen'
import { CompilerOptions } from './options'
import { baseParse } from './parse'
import { DirectiveTransform, NodeTransform, transform } from './transform'
import { transformElement } from './transforms/transformElement'

export type TransformPreset = [
  NodeTransform[],
  Record<string, DirectiveTransform>,
]

export function getBaseTransformPreset(): TransformPreset {
  return [[transformElement], {}]
}

export function baseCompile(
  template: string,
  option: Required<CompilerOptions>,
) {
  const ast = baseParse(template.trim())

  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()

  transform(ast, {
    ...option,
    nodeTransforms: [...nodeTransforms],
    directiveTransforms: { ...directiveTransforms },
  })

  const code = generate(ast, option)
  return code
}
