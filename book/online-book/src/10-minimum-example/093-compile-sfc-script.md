# Compiling the script block

## What we want to do

Now, the original script section of SFC looks like this:

```ts
export default {
  setup() {},
}
```

I want to extract only the following part:

```ts
  {
  setup() {},
}
```

Is there any way to do this?

If I can extract this part, I can mix it nicely with the previously generated render function and export it as follows:

```ts
const _sfc_main = {
  setup() {},
}

export default { ..._sfc_main, render }
```

## Using external libraries

To achieve the above, I will use the following two libraries:

- @babel/parser
- magic-string

### Babel

https://babeljs.io

[What is Babel](https://babeljs.io/docs)

You may have heard of Babel if you are familiar with JavaScript. \
Babel is a toolchain used to convert JavaScript into backward-compatible versions. \
In simple terms, it is a compiler (transpiler) from JS to JS. 

In this case, I will use Babel not only as a compiler but also as a parser. \
Babel has an internal parser for converting to AST, as it plays the role of a compiler. 

AST stands for Abstract Syntax Tree, which is a representation of JavaScript code. \
You can find the AST specification here (https://github.com/estree/estree). \
Although you can refer to the GitHub md file, I will briefly explain AST in JavaScript. \
The entire program is represented by a Program AST node, which contains an array of statements (represented using TS interfaces for clarity).

```ts
interface Program {
  body: Statement[]
}
```

Statement represents a "statement" in JavaScript, which is a collection of statements. \
Examples include "variable declaration statement," "if statement," "for statement," and "block statement."

```ts
interface Statement {}

interface VariableDeclaration extends Statement {
  /* omitted */
}

interface IfStatement extends Statement {
  /* omitted */
}

interface ForStatement extends Statement {
  /* omitted */
}

interface BlockStatement extends Statement {
  body: Statement[]
}
// There are many more
```

Statements usually have an "expression" in most cases. \
An expression is something that can be assigned to a variable. \
Examples include "object," "binary operation," and "function call."

```ts
interface Expression {}

interface BinaryExpression extends Expression {
  operator: '+' | '-' | '*' | '/' // There are many more, but omitted
  left: Expression
  right: Expression
}

interface ObjectExpression extends Expression {
  properties: Property[] // omitted
}

interface CallExpression extends Expression {
  callee: Expression
  arguments: Expression[]
}

// There are many more
```

If we consider an if statement, it has the following structure:

```ts
interface IfStatement extends Statement {
  test: Expression // condition
  consequent: Statement // statements to be executed if the condition is true
  alternate: Statement | null // statements to be executed if the condition is false
}
```

In this way, JavaScript syntax is parsed into the AST mentioned above. \
I think this explanation is easy to understand for those who have already implemented the template compiler for chibivue. (It's the same thing)

The reason why I use Babel is twofold.\
First, it's simply because it's cumbersome. \
If you have implemented a parser before, it may be technically possible to implement a JS parser while referring to estree. \
However, it is very cumbersome, and it is not very important for the purpose of "deepening understanding of Vue" in this case. \
The other reason is that the official Vue also uses Babel for this part.

### magic-string

https://github.com/rich-harris/magic-string

There is another library I want to use. \
This library is also used by the official Vue. \
It is a library that makes string manipulation easier.

```ts
const input = 'Hello'
const s = new MagicString(input)
```

You can generate an instance like this and use the convenient methods provided by the instance to manipulate strings. \
Here are some examples:

```ts
s.append('!!!') // Append to the end
s.prepend('message: ') // Prepend to the beginning
s.overwrite(9, 13, 'こんにちは') // Overwrite within a range
```

There is no need to use it forcefully, but I will use it to align with the official Vue.

Whether it's Babel or magic-string, you don't need to understand the actual usage at this point. \
I will explain and align the implementation later, so it's okay to have a rough understanding for now.

## Rewriting the default export of the script

To recap the current goal:

```ts
export default {
  setup() {},
  // Other options
}
```

I want to rewrite the code above to:

```ts
const _sfc_main = {
  setup() {},
  // Other options
}

export default { ..._sfc_main, render }
```

In other words, if I can extract the export target from the original code's export statement and assign it to a variable called `_sfc_main`, I will achieve the goal.

First, let's install the necessary libraries.

```sh
pwd # ~
ni @babel/parser magic-string
```

Create a file called "rewriteDefault.ts".

```sh
pwd # ~
touch packages/compiler-sfc/rewriteDefault.ts
```

Make sure that the function "rewriteDefault" can receive the target source code as "input" and the variable name to be bound as "as".  \
Return the converted source code as the return value.

`~/packages/compiler-sfc/rewriteDefault.ts`

```ts
export function rewriteDefault(input: string, as: string): string {
  // TODO:
  return ''
}
```

First, let's handle the case where the export declaration does not exist. \
Since there is no export, bind an empty object and finish.

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

Here comes the Babel parser and magic-string.

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

From here, we will manipulate the string `s` based on the JavaScript AST (Abstract Syntax Tree) obtained by the Babel parser. \
Although it is a bit long, I will provide additional explanations in the comments in the source code.\
Basically, we traverse the AST and write conditional statements based on the `type` property, and manipulate the string `s` using the methods of `magic-string`.

```ts
export function rewriteDefault(input: string, as: string): string {
  // .
  // .
  ast.forEach(node => {
    // In case of default export
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration') {
        // If it is `export default class Hoge {}`, replace it with `class Hoge {}`
        s.overwrite(node.start!, node.declaration.id.start!, `class `)
        // Then, add code like `const ${as} = Hoge;` at the end.
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        // For other default exports, replace the declaration part with a variable declaration.
        // eg 1) `export default { setup() {}, }`  ->  `const ${as} = { setup() {}, }`
        // eg 2) `export default Hoge`  ->  `const ${as} = Hoge`
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
      }
    }

    // There may be a default export in the declaration even in the case of named export.
    // Mainly 3 patterns
    //   1. In the case of declaration like `export { default } from "source";`
    //   2. In the case of declaration like `export { hoge as default }` from 'source'
    //   3. In the case of declaration like `export { hoge as default }`
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          // If there is a keyword `from`
          if (node.source) {
            if (specifier.local.name === 'default') {
              // 1. In the case of declaration like `export { default } from "source";`
              // In this case, extract it into an import statement and give it a name, then bind it to the final variable.
              // eg) `export { default } from "source";`  ->  `import { default as __VUE_DEFAULT__ } from 'source'; const ${as} = __VUE_DEFAULT__`
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              s.overwrite(specifier.start!, end, ``)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              // 2. In the case of declaration like `export { hoge as default }` from 'source'
              // In this case, rewrite all specifiers as they are in the import statement, and bind the variable that is as default to the final variable.
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

              // 3. In the case of declaration like `export { hoge as default }`
              // In this case, simply bind it to the final variable.
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

// Calculate the end of the declaration statement
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

Now you can rewrite the default export. \
Let's try using it in a plugin.

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

      // --------------------------- From here
      const SFC_MAIN = '_sfc_main'
      const scriptCode = rewriteDefault(
        descriptor.script?.content ?? '',
        SFC_MAIN,
      )
      outputs.push(scriptCode)
      // --------------------------- To here

      const templateCode = compile(descriptor.template?.content ?? '', {
        isBrowser: false,
      })
      outputs.push(templateCode)

      outputs.push('\n')
      outputs.push(`export default { ...${SFC_MAIN}, render }`) // Here

      return { code: outputs.join('\n') }
    },
  }
}
```

Before that, let's make a small modification.

`~/packages/runtime-core/component.ts`

```ts
export const setupComponent = (instance: ComponentInternalInstance) => {
  // .
  // .
  // .
  // Add the component's render option to the instance
  const { render } = component
  if (render) {
    instance.render = render as InternalRenderFunction
  }
}
```

Now you should be able to render!!!

![render_sfc](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/render_sfc.png)

The styles are not applied because they are not supported, but now you can render the component.