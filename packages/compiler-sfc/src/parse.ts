import type {
  BindingMetadata,
  ElementNode,
  SourceLocation,
} from '@chibivue/compiler-core'
import { NodeTypes } from '@chibivue/compiler-core'
import * as CompilerDOM from '@chibivue/compiler-dom'

import { ImportBinding } from './compileScript'
import { TemplateCompiler } from './compileTemplate'

export const DEFAULT_FILENAME = 'anonymous.vue'

export interface SFCParseOptions {
  filename?: string
  sourceRoot?: string
  compiler?: TemplateCompiler
}

export interface SFCBlock {
  type: string
  content: string
  loc: SourceLocation
  attrs: Record<string, string | true>
}

export interface SFCTemplateBlock extends SFCBlock {
  type: 'template'
}

export interface SFCScriptBlock extends SFCBlock {
  type: 'script'
  setup?: string | boolean
  bindings?: BindingMetadata
  imports?: Record<string, ImportBinding>
  scriptAst?: import('@babel/types').Statement[]
  scriptSetupAst?: import('@babel/types').Statement[]
}

export declare interface SFCStyleBlock extends SFCBlock {
  type: 'style'
}

export interface SFCDescriptor {
  id: string
  filename: string
  source: string
  template: SFCTemplateBlock | null
  script: SFCScriptBlock | null
  scriptSetup: SFCScriptBlock | null
  styles: SFCStyleBlock[]
}

export interface SFCParseResult {
  descriptor: SFCDescriptor
}

export function parse(
  source: string,
  { filename = DEFAULT_FILENAME, compiler = CompilerDOM }: SFCParseOptions = {},
): SFCParseResult {
  const descriptor: SFCDescriptor = {
    id: undefined!,
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
  }

  const ast = compiler.parse(source, {})
  ast.children.forEach(node => {
    if (node.type !== NodeTypes.ELEMENT) return

    switch (node.tag) {
      case 'template': {
        descriptor.template = createBlock(node, source) as SFCTemplateBlock
        break
      }
      case 'script': {
        const scriptBlock = createBlock(node, source) as SFCScriptBlock
        const isSetup = !!scriptBlock.attrs.setup
        if (isSetup && !descriptor.scriptSetup) {
          descriptor.scriptSetup = scriptBlock
        }
        if (!isSetup && !descriptor.script) {
          descriptor.script = scriptBlock
        }
        break
      }
      case 'style': {
        descriptor.styles.push(createBlock(node, source) as SFCStyleBlock)
        break
      }
      default: {
        break
      }
    }
  })

  return { descriptor }
}

function createBlock(node: ElementNode, source: string): SFCBlock {
  const type = node.tag
  let { start, end } = node.loc
  let content = ''
  if (node.children.length) {
    start = node.children[0].loc.start
    end = node.children[node.children.length - 1].loc.end
    content = source.slice(start.offset, end.offset)
  } else {
    const offset = node.loc.source.indexOf(`</`)
    if (offset > -1) {
      start = {
        line: start.line,
        column: start.column + offset,
        offset: start.offset + offset,
      }
    }
    end = { ...start }
  }

  const attrs: Record<string, string | true> = {}

  const loc = {
    source: content,
    start,
    end,
  }
  const block: SFCBlock = {
    type,
    content,
    attrs,
    loc,
  }

  node.props.forEach(p => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      attrs[p.name] = p.value ? p.value.content || true : true
      if (p.name === 'lang') {
        // TODO: parse lang
      } else if (type === 'style') {
        // TODO: parse style block
      } else if (type === 'script' && p.name === 'setup') {
        ;(block as SFCScriptBlock).setup = attrs.setup
      }
    }
  })

  return block
}
