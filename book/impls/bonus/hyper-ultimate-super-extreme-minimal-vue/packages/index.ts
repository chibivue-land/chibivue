// createApp API
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
let update: (() => void) | null = null
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup()
    update = () => {
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})

// Virtual DOM patch
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  const mountElement = (vnode: VNode, container: Element) => {
    const el = document.createElement(vnode.tag)
    el.textContent = vnode.children
    el.addEventListener('click', vnode.onClick)
    container.appendChild(el)
  }
  const patchElement = (_n1: VNode, n2: VNode) => {
    ;(container.firstElementChild as Element).textContent = n2.children
  }
  n1 == null ? mountElement(n2, container) : patchElement(n1, n2)
}

// Virtual DOM
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })

// Reactivity System
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.()
      return res
    },
  })

// Template Compiler
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
const parse = (template: string): AST => {
  const RE = /<([a-z]+)\s@click=\"([a-z]+)\">(.+)<\/[a-z]+>/
  const [_, tag, onClick, children] = template.match(RE) || []
  if (!tag || !onClick || !children) throw new Error('Invalid template!')
  const regex = /{{(.*?)}}/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  const parsedChildren: AST['children'] = []
  while ((match = regex.exec(children)) !== null) {
    lastIndex !== match.index &&
      parsedChildren.push(children.substring(lastIndex, match.index))
    parsedChildren.push({ content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  lastIndex < children.length && parsedChildren.push(children.substr(lastIndex))
  return { tag, onClick, children: parsedChildren }
}
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
const compile = (template: string): string => codegen(parse(template))

// SFC Compiler (Vite plugin)
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : null,
})
const compileSFC = (sfc: string): { code: string } => {
  const [_, scriptContent] =
    sfc.match(/<script>\s*([\s\S]*?)\s*<\/script>/) ?? []
  const [___, defaultExported] =
    scriptContent.match(/export default\s*([\s\S]*)/) ?? []
  const [__, templateContent] =
    sfc.match(/<template>\s*([\s\S]*?)\s*<\/template>/) ?? []
  if (!scriptContent || !defaultExported || !templateContent)
    throw new Error('Invalid SFC!')
  let code = ''
  code +=
    "import { h, reactive } from 'hyper-ultimate-super-extreme-minimal-vue';\n"
  code += `const options = ${defaultExported}\n`
  code += `Object.assign(options, { render: ${compile(templateContent)} });\n`
  code += 'export default options;\n'
  return { code }
}
