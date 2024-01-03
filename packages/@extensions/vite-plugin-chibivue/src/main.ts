import type { SFCDescriptor } from '@chibivue/compiler-sfc'
import { ResolvedOptions } from '.'
import { createDescriptor } from './utils/descriptorCache'
import { isUseInlineTemplate, resolveScript } from './script'
import { transformTemplateInMain } from './template'

export async function transformMain(
  code: string,
  filename: string,
  options: ResolvedOptions,
) {
  const { descriptor } = createDescriptor(filename, code, options)

  // script
  const { code: scriptCode } = genScriptCode(descriptor, options)

  // template
  const hasTemplateImport =
    descriptor.template && !isUseInlineTemplate(descriptor)

  let templateCode = ''

  if (hasTemplateImport) {
    const { code } = genTemplateCode(descriptor, options)
    templateCode = code
  }

  const attachedProps: [string, string][] = []
  if (templateCode) {
    attachedProps.push(['render', '_sfc_render'])
  }

  // styles
  const stylesCode = await genStyleCode(descriptor)

  const output: string[] = [scriptCode, templateCode, stylesCode]
  output.push('\n')

  if (attachedProps.length) {
    output.push(
      `export default { ..._sfc_main, ${attachedProps
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')} }`,
    )
  } else {
    output.push(`export default _sfc_main`)
  }

  const resolvedCode = output.join('\n')

  return { code: resolvedCode }
}

function genScriptCode(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
): {
  code: string
} {
  let scriptCode = `const _sfc_main = {}`
  const script = resolveScript(descriptor, options)
  if (script) {
    scriptCode = options.compiler.rewriteDefault(script.content, '_sfc_main')
  }

  return { code: scriptCode }
}

async function genStyleCode(descriptor: SFCDescriptor): Promise<string> {
  let stylesCode = ``

  for (let i = 0; i < descriptor.styles.length; i++) {
    const src = descriptor.filename
    const query = `?chibivue&type=style&index=${i}&lang.css`
    const styleRequest = src + query
    stylesCode += `\nimport ${JSON.stringify(styleRequest)}`
  }

  return stylesCode
}

function genTemplateCode(descriptor: SFCDescriptor, options: ResolvedOptions) {
  const template = descriptor.template!
  return transformTemplateInMain(template.content.trim(), options)
}
