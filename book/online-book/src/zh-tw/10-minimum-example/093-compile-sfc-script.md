# 編譯腳本區塊

## 我們想要做什麼

現在，SFC 的原始腳本部分看起來像這樣：

```ts
export default {
  setup() {},
}
```

我想只提取以下部分：

```ts
  {
  setup() {},
}
```

有什麼方法可以做到這一點嗎？

如果我可以提取這部分，我可以將其與之前生成的渲染函式很好地混合，並按如下方式匯出：

```ts
const _sfc_main = {
  setup() {},
}

export default { ..._sfc_main, render }
```

## 使用外部函式庫

為了實現上述目標，我將使用以下兩個函式庫：

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

如果你熟悉 JavaScript，你可能聽說過 Babel。\
Babel 是一個用於將 JavaScript 轉換為向後相容版本的工具鏈。\
簡單來說，它是一個從 JS 到 JS 的編譯器（轉譯器）。

在這種情況下，我將使用 Babel 不僅作為編譯器，還作為解析器。\
Babel 有一個內部解析器用於轉換為 AST，因為它扮演編譯器的角色。

AST 代表抽象語法樹，它是 JavaScript 程式碼的表示。\
你可以在這裡找到 AST 規範 (https://github.com/estree/estree)。\
雖然你可以參考 GitHub md 檔案，但我將簡要解釋 JavaScript 中的 AST。\
整個程式由一個 Program AST 節點表示，它包含一個語句陣列（為了清晰起見，使用 TS 介面表示）。

```ts
interface Program {
  body: Statement[]
}
```

Statement 表示 JavaScript 中的「語句」，它是語句的集合。\
範例包括「變數宣告語句」、「if 語句」、「for 語句」和「區塊語句」。

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
// 還有更多
```

語句通常在大多數情況下都有一個「表達式」。\
表達式是可以分配給變數的東西。\
範例包括「物件」、「二元運算」和「函式呼叫」。

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: '+' | '-' | '*' | '/' // 還有更多，但省略了
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

// 還有更多
```

如果我們考慮一個 if 語句，它具有以下結構：

```ts
interface IfStatement extends Statement {
  test: Expression // 條件
  consequent: Statement // 如果條件為真要執行的語句
  alternate: Statement | null // 如果條件為假要執行的語句
}
```

通過這種方式，JavaScript 語法被解析為上述 AST。\
我認為對於那些已經為 chibivue 實現了模板編譯器的人來說，這個解釋很容易理解。（這是同樣的事情）

我使用 Babel 的原因有兩個。\
首先，這只是因為它很麻煩。\
如果你之前實現過解析器，在參考 estree 的同時實現 JS 解析器在技術上可能是可能的。\
但是，這非常麻煩，對於「加深對 Vue 的理解」這一目的來說並不是很重要。\
另一個原因是官方 Vue 也在這部分使用 Babel。

### magic-string

https://github.com/rich-harris/magic-string

還有另一個我想使用的函式庫。\
這個函式庫也被官方 Vue 使用。\
它是一個使字串操作更容易的函式庫。

```ts
const input = 'Hello'
const s = new MagicString(input)
```

你可以像這樣生成一個實例，並使用實例提供的便利方法來操作字串。\
以下是一些範例：

```ts
s.append('!!!') // 追加到末尾
s.prepend('message: ') // 前置到開頭
s.overwrite(9, 13, 'こんにちは') // 在範圍內覆寫
```

沒有必要強制使用它，但我將使用它來與官方 Vue 保持一致。

無論是 Babel 還是 magic-string，你現在都不需要理解實際用法。\
我稍後會解釋並對齊實現，所以現在有一個粗略的理解就可以了。

## 重寫腳本的預設匯出

回顧當前目標：

```ts
export default {
  setup() {},
  // 其他選項
}
```

我想將上面的程式碼重寫為：

```ts
const _sfc_main = {
  setup() {},
  // 其他選項
}

export default { ..._sfc_main, render }
```

換句話說，如果我可以從原始程式碼的匯出語句中提取匯出目標並將其分配給名為 `_sfc_main` 的變數，我將實現目標。

首先，讓我們安裝必要的函式庫。

```sh
pwd # ~
ni @babel/parser magic-string
```

創建一個名為 "rewriteDefault.ts" 的檔案。

```sh
pwd # ~
touch packages/compiler-sfc/rewriteDefault.ts
```

確保函式 "rewriteDefault" 可以接收目標原始碼作為 "input" 和要綁定的變數名作為 "as"。\
將轉換後的原始碼作為返回值返回。

`~/packages/compiler-sfc/rewriteDefault.ts`

```ts
export function rewriteDefault(input: string, as: string): string {
  // TODO:
  return ''
}
```

首先，讓我們處理匯出宣告不存在的情況。\
由於沒有匯出，綁定一個空物件並完成。

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

這裡出現了 Babel 解析器和 magic-string。

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

從這裡開始，我們將基於 Babel 解析器獲得的 JavaScript AST（抽象語法樹）來操作字串 `s`。\
雖然有點長，但我將在原始碼的註解中提供額外的解釋。\
基本上，我們遍歷 AST 並基於 `type` 屬性編寫條件語句，並使用 `magic-string` 的方法操作字串 `s`。

```ts
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  ast.forEach(node => {
    // 在預設匯出的情況下
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration') {
        // 如果是 `export default class Hoge {}`，將其替換為 `class Hoge {}`
        s.overwrite(node.start!, node.declaration.id.start!, `class `)
        // 然後，在末尾添加像 `const ${as} = Hoge;` 這樣的程式碼。
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        // 對於其他預設匯出，將宣告部分替換為變數宣告。
        // 例如 1) `export default { setup() {}, }`  ->  `const ${as} = { setup() {}, }`
        // 例如 2) `export default Hoge`  ->  `const ${as} = Hoge`
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    }

    // 即使在命名匯出的情況下，宣告中也可能有預設匯出。
    // 主要有 3 種模式
    //   1. 在像 `export { default } from "source";` 這樣的宣告情況下
    //   2. 在像 `export { hoge as default }` from 'source' 這樣的宣告情況下
    //   3. 在像 `export { hoge as default }` 這樣的宣告情況下
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          // 如果有關鍵字 `from`
          if (node.source) {
            if (specifier.local.name === 'default') {
              // 1. 在像 `export { default } from "source";` 這樣的宣告情況下
              // 在這種情況下，將其提取到匯入語句中並給它一個名稱，然後將其綁定到最終變數。
              // 例如) `export { default } from "source";`  ->  `import { default as __VUE_DEFAULT__ } from 'source'; const ${as} = __VUE_DEFAULT__`
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              // 2. 在像 `export { hoge as default }` from 'source' 這樣的宣告情況下
              // 在這種情況下，將所有說明符按原樣重寫為匯入語句，並將作為預設值的變數綁定到最終變數。
              // 例如) `export { hoge as default } from "source";`  ->  `import { hoge } from 'source'; const ${as} = hoge
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

              // 3. 在像 `export { hoge as default }` 這樣的宣告情況下
              // 在這種情況下，簡單地將其綁定到最終變數。
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

// 計算宣告語句的結束
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

現在你可以重寫預設匯出了。\
讓我們嘗試在外掛程式中使用它。

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

      // --------------------------- 從這裡
      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN,
      )
      outputs.push(scriptCode)
      // --------------------------- 到這裡

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`) // 這裡

      return { code: outputs.join('\n') }
    },
  }
}
```

在此之前，讓我們做一個小修改。

`~/packages/runtime-core/component.ts`

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .
  // 將組件的渲染選項添加到實例
  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}
```

現在你應該能夠渲染了！！！

![render_sfc](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_sfc.png)

樣式沒有應用，因為不支援，但現在你可以渲染組件了。
