import { generate } from './codegen'
import type { CompilerOptions } from './options'
import { baseParse } from './parse'

export function baseCompile(
  template: string,
  option: Required<CompilerOptions>,
) {
  const parseResult = baseParse(template.trim())
  const code = generate(parseResult, option)
  return code
}
