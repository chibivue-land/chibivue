# SFC の script block のコンパイル

## やりたいこと

さて，元々の SFC の script 部分は以下のようになっています．

```ts
export default {
  setup() {},
}
```

これらを先ほど生成した render 関数といい感じに mix して export したいのですが，どうにか

```ts
{
  setup() {},
}
```

の部分だけ取り出せないでしょうか？

もしこの部分を取り出すことができたら，
以下のようにしてあげれば良いことになります．

```ts
const _sfc_main = {
  setup() {},
}

export default { ..._sfc_main, render }
```

## 外部ライブラリを使う

上記のようなことをしたいのですが結論から言うと以下の 2 つのライブラリを使って楽に実装します．

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

こちらは普段 JavaScript を使っている方はよく聞くかも知れません．  
Babel は JavaScript の後方互換バージョンに変換するために使用されるツールチェインです．  
簡単に言うと，JS から JS へのコンパイラ(トランスパイラ)です．  

今回は Babel をコンパイラとしてだけではなく，パーサとして利用します．  
Babel はコンパイラとしての役割を持つので，もちろん内部では AST に変換するためのパーサを実装しています．  
そのパーサをライブラリとして利用ます．  

さらっと AST という言葉を出しましたが，JavaScript ももちろん AST としての表現を持っています．  
こちらに AST の仕様があります．(https://github.com/estree/estree)  
上記の GitHub の md ファイルを見てもらっても良いのですが，簡単に JavaScript の AST について説明しておくと，  
まずプログラム全体は Program という AST ノードで表現されていて，Statement を配列で持ちます．(わかりやすいように TS の interface で表現しています．)

```ts
interface Program {
  body: Statement[]
}
```

Statement というのは日本で言うと「文」です．JavaScript は文の集まりです．具体的には「変数宣言文」や「if 文」「for 文」「ブロック」などが挙げられます．

```ts
interface Statement {}

interface VariableDeclaration extends Statement {
  /* 省略 */
}

interface IfStatement extends Statement {
  /* 省略 */
}

interface ForStatement extends Statement {
  /* 省略 */
}

interface BlockStatement extends Statement {
  body: Statement[]
}
// 他にもたくさんある
```

そして，文というのは多くの場合「Expression(式)」を持ちます．式というのは変数に代入できる物だと考えてもらえれば良いです．具体的には「オブジェクト」や「2 項演算」「関数呼び出し」などが挙げられます．

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: '+' | '-' | '*' | '/' // 他にもたくさんあるが省略
  left: Expression
  right: Expression
}

interface ObjectExpression extends Expression {
  properties: Property[] // 省略
}

interface CallExpression extends Expression {
  callee: Expression
  arguments: Expression[]
}

// 他にもたくさんある
```

if 文について考えると，このような構造をとることがわかります．

```ts
interface IfStatement extends Statement {
  test: Expression // 条件値
  consequent: Statement // 条件値がtrueの場合に実行される文
  alternate: Statement | null // 条件値がfalseの場合に実行される文
}
```

このように，JavaScript の構文は上記のような AST にパースされるのです．既に chibivue のテンプレートのコンパイラを実装したみなさんにとっては分かりやすい話だと思います．(同じこと)

なぜ Babel を使うのかというと，理由は２つあって，1 つは単純にめんどくさいからです．パーサを実装したことあるみなさんなら estree を見ながら JS のパーサを実装することも技術的には可能かも知れません．
けど，とてもめんどくさいし，今回の「Vue の理解を深める」という点においてはあまり重要ではありません．もう一つの理由は本家 Vue もこの部分は Babel を使っているという点です．

### magic-string

https://github.com/rich-harris/magic-string

もう一つ使いたいライブラリがあります．こちらも本家の Vue が使っているライブラリです．  
こちらは文字列操作を便利にするライブラリです．

```ts
const input = 'Hello'
const s = new MagicString(input)
```

のようにインスタンスを生成し，そのインスタンスに生えている便利なメソッドを利用して文字列操作をしていきます．
いくつか例をあげます．

```ts
s.append('!!!') // 末尾に追加する
s.prepend('message: ') // 先頭に追加する
s.overwrite(9, 13, 'こんにちは') // 範囲を指定して上書き
```

特に無理して使う必要はないのですが，本家の Vue に合わせて使うことにします．

Babel にしろ magic-string にしろ，実際の使い方等は実装の段階で合わせて説明するのでなんとなくの理解で問題ないです．

## script の default export を書き換える

今一度現在の目標を確認しておくと，

```ts
export default {
  setup() {},
  // その他のオプション
}
```

というコードを，

```ts
const _sfc_main = {
  setup() {},
  // その他のオプション
}

export default { ..._sfc_main, render }
```

というふうに書き換えたいわけです．

つまりは，元々のコードの export 文から良い感じに export 対象を抜き出し，\_sfc_main という変数に代入できるようになればゴールということです．

まずは必要なライブラリをインストールします．

```sh
pwd # ~
ni @babel/parser magic-string
```

rewriteDefault.ts というファイルを作成します．

```sh
pwd # ~
touch packages/compiler-sfc/rewriteDefault.ts
```

input に対象のソースコード，as に最終的にバインドしたい変数名を受け取れるようにしておきます．  
戻り値として変換されたソースコードを返します．

`~/packages/compiler-sfc/rewriteDefault.ts`

```ts
export function rewriteDefault(input: string, as: string): string {
  // TODO:
  return ''
}
```

まず手始めとして，そもそも export の宣言が存在しない場合のハンドリングをしておきます．
export が存在しないわけなので，からのオブジェクトをバインドして終了です．

```ts
const defaultExportRE = /((?:^|\n|;)\s*)export(\s*)default/
const namedDefaultExportRE = /((?:^|\n|;)\s*)export(.+)(?:as)?(\s*)default/s

export function rewriteDefault(input: string, as: string): string {
  if (!hasDefaultExport(input)) {
    return input + `\nconst ${as} = {}`
  }

  // TODO:
  return ''
}

export function hasDefaultExport(input: string): boolean {
  return defaultExportRE.test(input) || namedDefaultExportRE.test(input)
}
```

ここで Babel パーサと magic-string の登場です．

```ts
import { parse } from '@babel/parser'
import MagicString from 'magic-string'
// .
// .
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  const s = new MagicString(input)
  const ast = parse(input, {
    sourceType: 'module',
  }).program.body
  // .
  // .
}
```

ここからは Babel パーサによって得られた JavaScript の AST(ast) を元に s を文字列操作していきます．
少し長いですが，ソースコード内のコメントで補足の説明も入れていきます．
基本的には AST を手繰っていって，type によって分岐処理を書いて magic-string のメソッドで s を操作していくだけです．

```ts
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  ast.forEach(node => {
    // default exportの場合
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration') {
        // `export default class Hoge {}` だった場合は、`class Hoge {}` に置き換える
        s.overwrite(node.start!, node.declaration.id.start!, `class `)
        // その上で、`const ${as} = Hoge;` というようなコードを末尾に追加してあげればOK.
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        // それ以外の default exportは宣言部分を変数宣言に置き換えてあげればOk.
        // eg 1) `export default { setup() {}, }`  ->  `const ${as} = { setup() {}, }`
        // eg 2) `export default Hoge`  ->  `const ${as} = Hoge`
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    }

    // named export の場合でも宣言中に default exportが発生する場合がある.
    // 主に3パターン
    //   1. `export { default } from "source";`のような宣言の場合
    //   2. `export { hoge as default }` from 'source' のような宣言の場合
    //   3. `export { hoge as default }` のような宣言の場合
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          // `from`というキーワードがある場合
          if (node.source) {
            if (specifier.local.name === 'default') {
              // 1. `export { default } from "source";`のような宣言の場合
              // この場合はimport文に抜き出して名前をつけてあげ、最終的な変数にバインドする
              // eg) `export { default } from "source";`  ->  `import { default as __VUE_DEFAULT__ } from 'source'; const ${as} = __VUE_DEFAULT__`
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              // 2. `export { hoge as default }` from 'source' のような宣言の場合
              // この場合は一度全てのspecifierをそのままimport文に書き換え、as defaultになっている変数を最終的な変数にバインドする
              // eg) `export { hoge as default } from "source";`  ->  `import { hoge } from 'source'; const ${as} = hoge
              const end = specifierEnd(
                input,
                specifier.exported.end!,
                node.end!,
              )
              s.prepend(
                `import { ${input.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} } from '${node.source.value}'\n`,
              )

              // 3. `export { hoge as default }`のような宣言の場合
              // この場合は単純に最終的な変数にバインドしてあげる
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = ${specifier.local.name}`)
              continue
            }
          }
          const end = specifierEnd(input, specifier.end!, node.end!)
          s.overwrite(specifier.start!, end, ``)
          s.append(`\nconst ${as} = ${specifier.local.name}`)
        }
      }
    }
  })
  return s.toString()
}

// 宣言文の終端を算出する
function specifierEnd(input: string, end: number, nodeEnd: number | null) {
  // export { default   , foo } ...
  let hasCommas = false
  let oldEnd = end
  while (end < nodeEnd!) {
    if (/\s/.test(input.charAt(end))) {
      end++
    } else if (input.charAt(end) === ',') {
      end++
      hasCommas = true
      break
    } else if (input.charAt(end) === '}') {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
```

これで default export の書き換えができるようになりました．実際に plugin で使ってみましょう．

```ts
import type { Plugin } from 'vite'
import { createFilter } from 'vite'
import { parse, rewriteDefault } from '../../compiler-sfc'
import { compile } from '../../compiler-dom'

export default function vitePluginChibivue(): Plugin {
  const filter = createFilter(/\.vue$/)

  return {
    name: 'vite:chibivue',

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")

      const { descriptor } = parse(code, { filename: id })

      // --------------------------- ここから
      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN,
      )
      outputs.push(scriptCode)
      // --------------------------- ここまで

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`) // ここ

      return { code: outputs.join('\n') }
    },
  }
}
```

その前にちょっとだけ修正します．

`~/packages/runtime-core/component.ts`

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .
  // componentのrenderオプションをインスタンスに
  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}
```

これでレンダリングができるようになっているはずです!!！

![render_sfc](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_sfc.png)

スタイルの対応をしていないのでスタイルが当たっていないですがこれでレンダリングはできるようになりました．
