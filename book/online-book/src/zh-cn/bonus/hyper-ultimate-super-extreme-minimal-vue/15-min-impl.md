# Hyper Ultimate Super Extreme Minimal Vue

## 项目设置（0.5 分钟）

```sh
# 克隆此仓库并导航到它。
git clone https://github.com/chibivue-land/chibivue
cd chibivue

# 使用设置命令创建项目。
# 将项目的根路径指定为参数。
pnpm setup ../my-chibivue-project
```

项目设置现在完成了．

让我们现在实现 packages/index.ts．

## createApp（1 分钟）

对于 create app 函数，让我们考虑一个允许指定 setup 和 render 函数的签名．从用户的角度来看，它将这样使用：

```ts
const app = createApp({
  setup() {
    // TODO:
  },
  render() {
    // TODO:
  },
})

app.mount('#app')
```

让我们实现它：

```ts
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
```

然后我们可以返回一个实现 mount 函数的对象：

```ts
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    // TODO: patch rendering
  },
})
```

这部分就是这样．

## h 函数和虚拟 DOM（0.5 分钟）

要执行补丁渲染，我们需要虚拟 DOM 和生成它的函数．

虚拟 DOM 使用 JavaScript 对象表示标签名称，属性和子元素．Vue 渲染器处理虚拟 DOM 并将更新应用到实际 DOM．

让我们考虑一个 VNode，它表示一个名称，一个点击事件处理程序和子元素（文本）：

```ts
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })
```

这部分就是这样．

## 补丁渲染（2 分钟）

现在让我们实现渲染器．

这个渲染过程通常被称为补丁，因为它比较旧的和新的虚拟 DOM 并将差异应用到实际 DOM．

函数签名将是：

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  // TODO:
}
```

n1 表示旧的 VNode，n2 表示新的 VNode，container 是实际 DOM 的根．在这个例子中，`#app` 将是容器（使用 createApp 挂载的元素）．

我们需要考虑两种类型的操作：

- 挂载  
  这是初始渲染．如果 n1 为 null，意味着这是第一次渲染，所以我们需要实现挂载过程．
- 补丁  
  这比较 VNode 并将差异应用到实际 DOM．  
  但是这次，我们只更新子元素而不检测差异．

让我们实现它：

```ts
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
```

这部分就是这样．

## 响应式系统（2 分钟）

现在让我们实现逻辑来跟踪在 setup 选项中定义的状态变化并触发 render 函数．这个跟踪状态变化并执行特定操作的过程称为"响应式系统"．

让我们考虑使用 `reactive` 函数来定义状态：

```ts
const app = createApp({
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
  // ..
  // ..
})
```

在这种情况下，当使用 `reactive` 函数定义的状态被修改时，我们希望触发补丁过程．

它可以使用 Proxy 对象来实现这一点．代理允许我们为 get/set 操作实现功能．在这种情况下，我们可以使用 set 操作在发生 set 操作时执行补丁过程．

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      // ??? 这里我们想要执行补丁过程
      return res
    },
  })
```

问题是，我们应该在 set 操作中触发什么？通常，我们会使用 get 操作来跟踪变化，但在这种情况下，我们将在全局范围内定义一个 `update` 函数并引用它．

让我们使用之前实现的 render 函数来创建 update 函数：

```ts
let update: (() => void) | null = null // 我们想要用 Proxy 引用这个，所以它需要在全局范围内
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup() // 只在第一次渲染时运行 setup
    update = () => {
      // 生成一个闭包来比较 prevVNode 和 VNode
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})
```

现在我们只需要在 Proxy 的 set 操作中调用它：

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.() // 执行更新
      return res
    },
  })
```

就是这样！

## 模板编译器（5 分钟）

到目前为止，我们已经能够通过允许用户使用 render 选项和 h 函数来实现声明式 UI．但是，实际上，我们希望以类似 HTML 的方式编写它．

因此，让我们实现一个模板编译器，将 HTML 转换为 h 函数．

目标是将这样的字符串：

```
<button @click="increment">state: {{ state.count }}</button>
```

转换为这样的函数：

```
h("button", increment, "state: " + state.count)
```

让我们稍微分解一下．

- parse  
  解析 HTML 字符串并将其转换为称为 AST（抽象语法树）的对象．
- codegen  
  基于 AST 生成所需的代码（字符串）．

现在，让我们实现 AST 和 parse．

```ts
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
```

我们这次处理的 AST 如上所示．它类似于 VNode，但完全不同，用于生成代码．Interpolation 表示胡须语法．像 <span v-pre>`{{ state.count }}`</span> 这样的字符串被解析为像 <span v-pre>`{ content: "state.count" }`</span> 这样的对象（AST）．

接下来，让我们实现从给定字符串生成 AST 的 parse 函数．现在，让我们使用正则表达式和一些字符串操作快速实现它．

```ts
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
```

接下来是 codegen．基于 AST 生成 h 函数的调用．

```ts
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
```

状态从参数 `_ctx` 中引用．

通过组合这些，我们可以完成 compile 函数．

```ts
const compile = (template: string): string => codegen(parse(template))
```

好吧，实际上，就目前而言，它只是生成 h 函数调用的字符串，所以它还不能工作．

我们将与 sfc 编译器一起实现它．

有了这个，模板编译器就完成了．

## sfc 编译器（vite-plugin）（4 分钟）

最后！让我们实现一个 vite 插件来支持 sfc．

在 vite 插件中，有一个名为 transform 的选项，它允许您转换文件的内容．

transform 函数返回类似 `{ code: string }` 的东西，字符串被视为源代码．换句话说，例如，

```ts
export const VitePluginChibivue = () => ({
  name: "vite-plugin-chibivue",
  transform: (code: string, id: string) => ({
    code: "";
  }),
});
```

将使所有文件的内容成为空字符串．原始代码可以作为第一个参数接收，所以通过正确转换这个值并在最后返回它，您可以转换它．

有 5 件事要做．

- 从脚本中提取作为默认导出的内容．
- 将其转换为将其分配给变量的代码．（为了方便，让我们称变量为 A．）
- 从模板中提取 HTML 字符串，并使用我们之前创建的 compile 函数将其转换为对 h 函数的调用．（为了方便，让我们称结果为 B．）
- 生成类似 `Object.assign(A, { render: B })` 的代码．
- 生成将 A 作为默认导出的代码．

现在让我们实现它．

```ts
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
```

之后，在插件中实现它．

```ts
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : code, // 仅适用于 .vue 扩展名的文件
})
```

## 结束

是的．有了这个，我们已经成功实现到 SFC．
让我们再看一下源代码．

```ts
// create app api
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

// template compiler
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

// sfc compiler (vite transformer)
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
```

令人惊讶的是，我们能够在大约 110 行中实现它．（现在没有人会抱怨了，呼...）

请确保也尝试主要部分的主要部分！！（虽然这只是一个附录）
