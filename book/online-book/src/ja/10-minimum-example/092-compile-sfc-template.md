# SFC の template block のコンパイル

## コンパイラの切り替え

パース結果の `descriptor.script.content` と `descriptor.template.content` にはそれぞれのソースコードが入っています．  
これらを使って上手くコンパイルしたいです．template の方からやっていきましょう．  
テンプレートのコンパイラはすでに持っています．  
しかし，以下のコードを見てもらえればわかるのですが，

```ts
export const generate = ({
  children,
}: {
  children: TemplateChildNode[]
}): string => {
  return `return function render(_ctx) {
  with (_ctx) {
    const { h } = ChibiVue;
    return ${genNode(children[0])};
  }
}`
}
```

これは Function コンストラクタで new する前提の物になってしまっているので先頭に return がついてしまっています．
SFC のコンパイラでは render 関数だけを生成したいので，コンパイラのオプションで分岐できるようにしましょう．
コンパイラの第 2 引数としてオプションを受け取れるようにし，'isBrowser'というフラグを指定可能にします．
この変数が true の時はランタイム上で new される前提のコードを出力し，false の場合は単にコードを生成します．

```sh
pwd # ~
touch packages/compiler-core/options.ts
```

`packages/compiler-core/options.ts`

```ts
export type CompilerOptions = {
  isBrowser?: boolean
}
```

`~/packages/compiler-dom/index.ts`

```ts
export function compile(template: string, option?: CompilerOptions) {
  const defaultOption: Required<CompilerOptions> = { isBrowser: true }
  if (option) Object.assign(defaultOption, option)
  return baseCompile(template, defaultOption)
}
```

`~/packages/compiler-core/compile.ts`

```ts
export function baseCompile(
  template: string,
  option: Required<CompilerOptions>,
) {
  const parseResult = baseParse(template.trim())
  const code = generate(parseResult, option)
  return code
}
```

`~/packages/compiler-core/codegen.ts`

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
  const { h } = ChibiVue;
  return ${genNode(children[0])};
}`
}
```

ついでに import 文を足しておきました．output という配列にソースコードを詰めていく感じにも変更してます．

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'\n")

      const { descriptor } = parse(code, { filename: id })
      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { render }`)

      return { code: outputs.join('\n') }
    },
  }
}
```

## 問題点

これで render 関数をコンパイルできるようになっていると思います．ブラウザの source で確認してみましょう．

と，言いたいところなのですが，実は少し問題があります．

データをテンプレートにバインドする際に，with 文を使用していると思うのですが，Vite は ESM を扱う都合上，非厳格モード (sloppy モード) でのみ動作するコードを処理できず，  
with 文を扱うことができません．  
これまでは vite 上ではなく，単に with 文を含むコード(文字列)を Function コンストラクタに渡してブラウザ上で関数化していたので特に問題にはなっていませんでしたが，
今回はエラーになってしいます．以下のようなエラーが出るはずです．

> Strict mode code may not include a with statement

これについては Vite の公式ドキュメントの方にもトラブルシューティングとして記載されています．

[Syntax Error / Type Error が発生する (Vite)](https://ja.vitejs.dev/guide/troubleshooting.html#syntax-error-type-error-%E3%81%8B%E3%82%99%E7%99%BA%E7%94%9F%E3%81%99%E3%82%8B)

今回は，一時的な対応策として，ブラウザモードでない場合には with 文を含まないコードを生成するようにしてみます．

具体的には，バインド対象のデータに関しては with 文を使用せずに prefix として `_cxt.`　を付与する形で制御してみます．  
一時的な対応なのであまり厳格ではないのですが，概ね動作するようになると思います．  
(ちゃんとした対応は後のチャプターで行います．)

```ts
export const generate = (
  {
    children,
  }: {
    children: TemplateChildNode[]
  },
  option: Required<CompilerOptions>,
): string => {
  // isBrowser が false の場合は with 文を含まないコードを生成する
  return `${option.isBrowser ? 'return ' : ''}function render(_ctx) {
    ${option.isBrowser ? 'with (_ctx) {' : ''}
      const { h } = ChibiVue;
      return ${genNode(children[0], option)};
    ${option.isBrowser ? '}' : ''}
}`
}

// .
// .
// .

const genNode = (
  node: TemplateChildNode,
  option: Required<CompilerOptions>,
): string => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return genElement(node, option)
    case NodeTypes.TEXT:
      return genText(node)
    case NodeTypes.INTERPOLATION:
      return genInterpolation(node, option)
    default:
      return ''
  }
}

const genElement = (
  el: ElementNode,
  option: Required<CompilerOptions>,
): string => {
  return `h("${el.tag}", {${el.props
    .map(prop => genProp(prop, option))
    .join(', ')}}, [${el.children.map(it => genNode(it, option)).join(', ')}])`
}

const genProp = (
  prop: AttributeNode | DirectiveNode,
  option: Required<CompilerOptions>,
): string => {
  switch (prop.type) {
    case NodeTypes.ATTRIBUTE:
      return `${prop.name}: "${prop.value?.content}"`
    case NodeTypes.DIRECTIVE: {
      switch (prop.name) {
        case 'on':
          return `${toHandlerKey(prop.arg)}: ${
            option.isBrowser ? '' : '_ctx.' // -------------------- ここ
          }${prop.exp}`
        default:
          // TODO: other directives
          throw new Error(`unexpected directive name. got "${prop.name}"`)
      }
    }
    default:
      throw new Error(`unexpected prop type.`)
  }
}

// .
// .
// .

const genInterpolation = (
  node: InterpolationNode,
  option: Required<CompilerOptions>,
): string => {
  return `${option.isBrowser ? '' : '_ctx.'}${node.content}` // ------------ ここ
}
```

![compile_sfc_render](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/compile_sfc_render.png)

上手くコンパイルできているようです．あとは同じ要領で，どうにかして script を引っこ抜いて default exports に突っ込めば OK です．

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler3)
