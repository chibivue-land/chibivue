import { type CompilerOptions, baseCompile, baseParse } from '../compiler-core'

export function compile(template: string, option?: CompilerOptions) {
  const defaultOption: Required<CompilerOptions> = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(template, defaultOption)
}

export function parse(template: string) {
  return baseParse(template)
}
