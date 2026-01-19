# Hyper Ultimate Super Extreme Minimal Vue

## 專案設定（0.5 分鐘）

```sh
# 複製此儲存庫並導航到它。
git clone https://github.com/chibivue-land/chibivue
cd chibivue

# 使用設定指令建立專案。
# 將專案的根路徑指定為參數。
pnpm setup ../my-chibivue-project
```

專案設定現在完成了．

讓我們現在實現 packages/index.ts．

## createApp（1 分鐘）

對於 create app 函式，讓我們考慮一個允許指定 setup 和 render 函式的簽名．從使用者的角度來看，它將這樣使用：

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

讓我們實現它：

```ts
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
```

然後我們可以回傳一個實現 mount 函式的物件：

```ts
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    // TODO: patch rendering
  },
})
```

這部分就是這樣．

## h 函式和虛擬 DOM（0.5 分鐘）

要執行補丁渲染，我們需要虛擬 DOM 和產生它的函式．

虛擬 DOM 使用 JavaScript 物件表示標籤名稱，屬性和子元素．Vue 渲染器處理虛擬 DOM 並將更新應用到實際 DOM．

讓我們考慮一個 VNode，它表示一個名稱，一個點擊事件處理程式和子元素（文字）：

```ts
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })
```

這部分就是這樣．

## 補丁渲染（2 分鐘）

現在讓我們實現渲染器．

這個渲染過程通常被稱為補丁，因為它比較舊的和新的虛擬 DOM 並將差異應用到實際 DOM．

函式簽名將是：

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  // TODO:
}
```

n1 表示舊的 VNode，n2 表示新的 VNode，container 是實際 DOM 的根．在這個例子中，`#app` 將是容器（使用 createApp 掛載的元素）．

我們需要考慮兩種類型的操作：

- 掛載  
  這是初始渲染．如果 n1 為 null，意味著這是第一次渲染，所以我們需要實現掛載過程．
- 補丁  
  這比較 VNode 並將差異應用到實際 DOM．  
  但是這次，我們只更新子元素而不檢測差異．

讓我們實現它：

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

這部分就是這樣．

## 響應式系統（2 分鐘）

現在讓我們實現邏輯來追蹤在 setup 選項中定義的狀態變化並觸發 render 函式．這個追蹤狀態變化並執行特定操作的過程稱為"響應式系統"．

讓我們考慮使用 `reactive` 函式來定義狀態：

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

在這種情況下，當使用 `reactive` 函式定義的狀態被修改時，我們希望觸發補丁過程．

它可以使用 Proxy 物件來實現這一點．代理允許我們為 get/set 操作實現功能．在這種情況下，我們可以使用 set 操作在發生 set 操作時執行補丁過程．

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      // ??? 這裡我們想要執行補丁過程
      return res
    },
  })
```

問題是，我們應該在 set 操作中觸發什麼？通常，我們會使用 get 操作來追蹤變化，但在這種情況下，我們將在全域範圍內定義一個 `update` 函式並引用它．

讓我們使用之前實現的 render 函式來建立 update 函式：

```ts
let update: (() => void) | null = null // 我們想要用 Proxy 引用這個，所以它需要在全域範圍內
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup() // 只在第一次渲染時執行 setup
    update = () => {
      // 產生一個閉包來比較 prevVNode 和 VNode
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})
```

現在我們只需要在 Proxy 的 set 操作中呼叫它：

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.() // 執行更新
      return res
    },
  })
```

就是這樣！

## 模板編譯器（5 分鐘）

到目前為止，我們已經能夠透過允許使用者使用 render 選項和 h 函式來實現宣告式 UI．但是，實際上，我們希望以類似 HTML 的方式編寫它．

因此，讓我們實現一個模板編譯器，將 HTML 轉換為 h 函式．

目標是將這樣的字串：

```
<button @click="increment">state: {{ state.count }}</button>
```

轉換為這樣的函式：

```
h("button", increment, "state: " + state.count)
```

讓我們稍微分解一下．

- parse  
  解析 HTML 字串並將其轉換為稱為 AST（抽象語法樹）的物件．
- codegen  
  基於 AST 產生所需的程式碼（字串）．

現在，讓我們實現 AST 和 parse．

```ts
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
```

我們這次處理的 AST 如上所示．它類似於 VNode，但完全不同，用於產生程式碼．Interpolation 表示鬍鬚語法．像 <span v-pre>`{{ state.count }}`</span> 這樣的字串被解析為像 <span v-pre>`{ content: "state.count" }`</span> 這樣的物件（AST）．

接下來，讓我們實現從給定字串產生 AST 的 parse 函式．現在，讓我們使用正規表示式和一些字串操作快速實現它．

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

接下來是 codegen．基於 AST 產生 h 函式的呼叫．

```ts
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
```

狀態從參數 `_ctx` 中引用．

透過組合這些，我們可以完成 compile 函式．

```ts
const compile = (template: string): string => codegen(parse(template))
```

好吧，實際上，就目前而言，它只是產生 h 函式呼叫的字串，所以它還不能工作．

我們將與 sfc 編譯器一起實現它．

有了這個，模板編譯器就完成了．

## sfc 編譯器（vite-plugin）（4 分鐘）

最後！讓我們實現一個 vite 外掛來支援 sfc．

在 vite 外掛中，有一個名為 transform 的選項，它允許您轉換檔案的內容．

transform 函式回傳類似 `{ code: string }` 的東西，字串被視為原始碼．換句話說，例如，

```ts
export const VitePluginChibivue = () => ({
  name: "vite-plugin-chibivue",
  transform: (code: string, id: string) => ({
    code: "";
  }),
});
```

將使所有檔案的內容成為空字串．原始程式碼可以作為第一個參數接收，所以透過正確轉換這個值並在最後回傳它，您可以轉換它．

有 5 件事要做．

- 從腳本中提取作為預設匯出的內容．
- 將其轉換為將其分配給變數的程式碼．（為了方便，讓我們稱變數為 A．）
- 從模板中提取 HTML 字串，並使用我們之前建立的 compile 函式將其轉換為對 h 函式的呼叫．（為了方便，讓我們稱結果為 B．）
- 產生類似 `Object.assign(A, { render: B })` 的程式碼．
- 產生將 A 作為預設匯出的程式碼．

現在讓我們實現它．

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

之後，在外掛中實現它．

```ts
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : code, // 僅適用於 .vue 副檔名的檔案
})
```

## 結束

是的．有了這個，我們已經成功實現到 SFC．
讓我們再看一下原始碼．

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

令人驚訝的是，我們能夠在大約 110 行中實現它．（現在沒有人會抱怨了，呼...）

請確保也嘗試主要部分的主要部分！！（雖然這只是一個附錄）
