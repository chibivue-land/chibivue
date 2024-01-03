import type { ParserOptions } from '@chibivue/compiler-core'
import { isHTMLTag } from '@chibivue/shared'

export const parserOptions: ParserOptions = {
  isNativeTag: tag => isHTMLTag(tag),
}
