import { generate } from './codegen'
import { baseParse } from './parse'

export function baseCompile(template: string) {
  const parseResult = baseParse(template.trim())
  console.log(
    '🚀 ~ file: compile.ts:6 ~ baseCompile ~ parseResult:',
    parseResult,
  )

  // TODO: codegen
  // const code = generate(parseResult);
  // return code;
  return ''
}
