# Hyper Ultimate Super Extreme Minimal Vue

## プロジェクトのセットアップ (0.5 min)

```sh
# 本リポジトリをクローンして移動しましょう。
git clone https://github.com/chibivue-land/chibivue
cd chibivue

# setup コマンドでプロジェクトを作成します。
# 引数にはプロジェクトのルートパスを指定します。
pnpm setup ../my-chibivue-project
```

これでプロジェクトの設定はおしまいです．

ここからは packages/index.ts を実装していきましょう．

## createApp (1 min)

create app には setup 関数と render 関数を指定できるようなシグネチャを考えます．
ユーザーからすると，

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

のように使うイメージですね．

実装していきます．

```ts
type CreateAppOption = {
  setup: () => Record<string, unknown>
  render: (ctx: Record<string, unknown>) => VNode
}
```

これを受け取って，とりあえず mount 関数を実装したオブジェクトを return するようなものにすれば OK です．

```ts
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    // TODO: patch rendering
  },
})
```

はい．これでおしまいです．

## h 関数と仮想 DOM (0.5 min)

patch レンダリングを行いたいですが，そのためには仮想 DOM とそれを生成するための関数が必要です．

仮想 DOM というのは タグ名や属性，子要素などの情報を JS のオブジェクトで表現したもので，  
Vue の renderer は基本的にはこの仮想 DOM を扱いながら実 DOM への反映を行っていきます．
今回は名前と click イベントのハンドラと 子要素( text )を扱うような VNode を考えてみます．

```ts
type VNode = { tag: string; onClick: (e: Event) => void; children: string }
export const h = (
  tag: string,
  onClick: (e: Event) => void,
  children: string,
): VNode => ({ tag, onClick, children })
```

はい．お終いです．

## patch rendering (2 min)

それでは renderer を実装していきます．

このレンダリング処理はたちまち patch 処理と呼ばれたりしますが， patch という名の通り，

新旧の仮想 DOM を比較して差分を実 DOM に反映します．

つまり，関数のシグネチャ的には

```ts
export const render = (n1: VNode | null, n2: VNode, container: Element) => {
  // TODO:
}
```

のようになります．  
n1 が古い VNode, n2 が新しい VNode, container というのは実 DOM の root です．  
今回の例で言うと `#app` が container になります．(createApp で mount した要素)

中身の実装について，考慮するべきは 2 種類の処理です．

- mount  
  初回です． n1 が null の場合に初回レンダリングという判断を行ってマウント処理を書きます．
- patch  
  VNode 同士で比較して差分を実 DOM に反映します．  
  とはいっても，今回は children を更新するだけで，差分の検知は行いません．

それでは実装してみます．

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

以上になります．

## Reactivity System (2 min)

これからは実際に setup オプションでセットアップされたステートの変更を追跡して，

render 関数を発火させる処理を実装していきます．ステートの更新を追跡して特定の作用を実行することから「Reactivity System」というふうな名前がついています．

今回は `reactive` という関数でユーザーにステートを定義することを考えてみます．

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

このようなイメージです．
実際に，この reactive 関数で定義されたステートが変更された際に patch 処理を実行したいです．

これは Proxy というオブジェクトを用いて実現されます．
Proxy は get / set に対して機能を実装することができます．今回はこの set に対する拡張を利用して， set 時に patch 処理を実行するように実装してみます．

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      // ??? ここで patch 処理を実行したい
      return res
    },
  })
```

問題としては，set で何を発火するかです．
本来は get によって作用を track したりしなければならないのですが，今回はグローバルなスコープに update 関数を定義してそれを参照します．

先ほど実装した render 関数を使って update 関数を実装してみます．

```ts
let update: (() => void) | null = null // Proxy で参照したいのでグローバルに
export const createApp = (option: CreateAppOption) => ({
  mount(selector: string) {
    const container = document.querySelector(selector)!
    let prevVNode: VNode | null = null
    const setupState = option.setup() // 初回のみ setup
    update = () => {
      // prevVNode と VNode を比較できるようにいい感じにクロージャを生成している。
      const vnode = option.render(setupState)
      render(prevVNode, vnode, container)
      prevVNode = vnode
    }
    update()
  },
})
```

はい．あとは Proxy の set で呼んであげましょう．

```ts
export const reactive = <T extends Record<string, unknown>>(obj: T): T =>
  new Proxy(obj, {
    get: (target, key, receiver) => Reflect.get(target, key, receiver),
    set: (target, key, value, receiver) => {
      const res = Reflect.set(target, key, value, receiver)
      update?.() // 実行
      return res
    },
  })
```

## template compiler (5 min)

ここまでで，ユーザーに render オプションと h 関数を使わせて 宣言的な UI を実装できるようにはなったのですが，
実際には HTML ライクに記述したいです．

そこで，HTML から h 関数に変換するような template compiler を実装してみます．

目標的には，

```
<button @click="increment">state: {{ state.count }}</button>
```

のような文字列を，

```
h("button", increment, "state: " + state.count)
```

のような関数に変換したいです．

少し段階分けをします．

- parse  
  HTML の文字列を解析し，AST と呼ばれるオブジェクトに変換します．
- codegen  
  AST を元に目標のコード (文字列) を生成します．

それでは，AST と parse を実装してみます．

```ts
type AST = {
  tag: string
  onClick: string
  children: (string | Interpolation)[]
}
type Interpolation = { content: string }
```

今回扱う AST は上記の通りです． VNode と似ていますが全くの別物で，これはコードを生成するためのものです．
Interpolation というのがマスタッシュ構文です． <span v-pre>`{{ state.count }}`</span> のような文字列は， <span v-pre>`{ content: "state.count" }`</span> というオブジェクト(AST)に解析されます．

あとは与えられた文字列から AST を生成する parse 関数を実装してしまえば OK です．
こちらは取り急ぎ，正規表現といくつかの文字列操作で実装してみます．

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

次に codegen です． AST を元に h 関数の呼び出しを生成します．

```ts
const codegen = (node: AST) =>
  `(_ctx) => h('${node.tag}', _ctx.${node.onClick}, \`${node.children
    .map(child =>
      typeof child === 'object' ? `\$\{_ctx.${child.content}\}` : child,
    )
    .join('')}\`)`
```

state には \_ctx という引数から参照するようにしています．

これらを組み合わせれば compile 関数の完成です．

```ts
const compile = (template: string): string => codegen(parse(template))
```

まあ，実はこのままではただ h 関数の呼び出しを文字列として生成するだけなので，まだ動かないのですが，

それは次の sfc compiler で一緒に実装してしまいます．

これで template compiler は完成です．

## sfc compiler (vite-plugin) (4 min)

ラスト！ vite のプラグインを実装して sfc に対応していきます．

vite のプラグインには，transform というオプションがあり，これを使うとファイルの内容を変換することができます．

transform 関数は `{ code: string }` のようなものを return することで，その文字列がソースコードとして扱われます．
つまり，例えば，

```ts
export const VitePluginChibivue = () => ({
  name: "vite-plugin-chibivue",
  transform: (code: string, id: string) => ({
    code: "";
  }),
});
```

のようにすれば，全てのファイルの内容が空文字列になります．
元々のコードは第一引数で受け取れるようになっているので，この値をうまく変換して最後に return すれば変換することができます．

やることは， 5 つです．

- script から default export されているものを抜き出す．
- それを変数に入れるようなコードに変換する．(便宜上その変数名を A とします．)
- template から HTML 文字列を抜き出して，さっき作った compile 関数で h 関数の呼び出しに変換する． (便宜上その結果を B とします．)
- `Object.assign(A, { render: B })` というようなコードを生成する．
- A を default export するようなコードを生成する．

それでは実装してみましょう．

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

あとはこれを Plugin に実装してあげれば Ok です．

```ts
export const VitePluginChibivue = () => ({
  name: 'vite-plugin-chibivue',
  transform: (code: string, id: string) =>
    id.endsWith('.vue') ? compileSFC(code) : code, // 拡張子が .vue の場合のみ
})
```

## おしまい

はい．なんとこれで SFC まで実装することができました．
改めてソースコードを眺めてみましょう．

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

なんと 110 行くらいで実装できてしまいました．(これで誰からも文句言われないでしょう．ふぅ...)

## ぜひ本編の本編の方もやってくださいね！！！！！！！！

ぜひ本編の本編の方もやってくださいね！！！！！！！！ (これはあくまで付録ですから)
