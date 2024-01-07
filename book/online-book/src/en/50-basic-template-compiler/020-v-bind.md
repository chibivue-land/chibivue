# Let's implement the directive (v-bind).

## Approach

Now let's implement the directive, which is the essence of Vue.js.  
As usual, we will apply the directive to the transformer, and the interface that appears there is called DirectiveTransform.  
DirectiveTransform takes DirectiveNode and ElementNode as arguments and returns the transformed Property.

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
) => DirectiveTransformResult

export interface DirectiveTransformResult {
  props: Property[]
}
```

First, let's check the developer interface we are aiming for this time.

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  setup() {
    const bind = { id: 'some-id', class: 'some-class', style: 'color: red' }
    return { count: 1, bind }
  },

  template: `<div>
  <p v-bind:id="count"> v-bind:id="count" </p>
  <p :id="count * 2"> :id="count * 2" </p>

  <p v-bind:["style"]="bind.style"> v-bind:["style"]="bind.style" </p>
  <p :["style"]="bind.style"> :["style"]="bind.style" </p>

  <p v-bind="bind"> v-bind="bind" </p>

  <p :style="{ 'font-weight': 'bold' }"> :style="{ font-weight: 'bold' }" </p>
  <p :style="'font-weight: bold;'"> :style="'font-weight: bold;'" </p>

  <p :class="'my-class my-class2'"> :class="'my-class my-class2'" </p>
  <p :class="['my-class']"> :class="['my-class']" </p>
  <p :class="{ 'my-class': true }"> :class="{ 'my-class': true }" </p>
  <p :class="{ 'my-class': false }"> :class="{ 'my-class': false }" </p>
</div>`,
})

const app = createApp(App)

app.mount('#app')
```

There are various notations for v-bind. Please refer to the official documentation for details.  
We will also handle class and style.

https://vuejs.org/api/built-in-directives.html#v-bind

## AST Modification

First, let's modify the AST. Currently, both exp and arg are simple strings, so we need to change them to accept ExpressionNode.

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined // here
  arg: ExpressionNode | undefined // here
}
```

Let me explain name, arg, and exp again.  
name is the directive name such as v-bind or v-on. It can be on or bind.  
Since we are implementing v-bind this time, it will be bind.

arg is the argument specified by :. For v-bind, it includes id and style.  
(In the case of v-on, it includes click and input.)

exp is the right side. In the case of v-bind:id="count", count is included.  
Both exp and arg can embed variables dynamically, so their types are ExpressionNode.  
(Since arg can also be dynamic like v-bind:[key]="count")

![dir_ast](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/dir_ast.drawio.png)

## Parser Modification

We will update the parser implementation to follow this AST modification. We will parse exp and arg as SimpleExpressionNode.

We will also parse @ used in v-on and # used in slots.  
(Since it's troublesome to consider regular expressions (and it's troublesome to add them gradually while explaining), we will borrow the original code for now.)  
Reference: https://github.com/vuejs/core/blob/623ba514ec0f5adc897db90c0f986b1b6905e014/packages/compiler-core/src/parse.ts#L802

Since the code is a bit long, I will explain it while writing comments in the code.

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  // .
  // directive
  const loc = getSelection(context, start)
  // The regular expression here is borrowed from the original source
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      // The regular expression here is borrowed from the original source
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name,
      )!

    // Check the match of the name part and treat it as "bind" if it starts with ":"
    let dirName =
      match[1] ||
      (startsWith(name, ':') ? 'bind' : startsWith(name, '@') ? 'on' : '')

    let arg: ExpressionNode | undefined

    if (match[2]) {
      const startOffset = name.lastIndexOf(match[2])
      const loc = getSelection(
        context,
        getNewPosition(context, start, startOffset),
        getNewPosition(context, start, startOffset + match[2].length),
      )

      let content = match[2]
      let isStatic = true

      // If it is a dynamic argument like "[arg]", set isStatic to false and extract the content as the content
      if (content.startsWith('[')) {
        isStatic = false
        if (!content.endsWith(']')) {
          console.error(`Invalid dynamic argument expression: ${content}`)
          content = content.slice(1)
        } else {
          content = content.slice(1, content.length - 1)
        }
      }

      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content,
        isStatic,
        loc,
      }
    }

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        loc: value.loc,
      },
      loc,
      arg,
    }
  }
}
```

With this, we were able to parse the AST Node we wanted to handle this time.

## Implementation of Transformer

Next, let's write the implementation to transform this AST into a Codegen AST.  
Since it is a bit complicated, I summarized the flow in the following diagram. Please take a look at it first.  
In general, the necessary items are whether there are arguments for v-bind, whether it is class or style.  
※ Parts other than the processing involved this time are omitted. (Please note that this diagram is not very strict.)

![dir_ast](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/transform_vbind.drawio.png)

First of all, as a premise, since a directive is basically declared for an element,  
the transformer related to the directive is called from transformElement.

Since we want to implement v-bind this time, we will implement a function called transformVBind,  
but one point to note is that this function only converts declarations that have args.

transformVBind has the role of converting

```
v-bind:id="count"
```

into an object (actually a Codegen Node representing this object) like

```ts
{
  id: count
}
```

In the original implementation as well, the following explanation is given.

> codegen for the entire props object. This transform here is only for v-bind _with_ args.

Quoted from: https://github.com/vuejs/core/blob/623ba514ec0f5adc897db90c0f986b1b6905e014/packages/compiler-core/src/transforms/vBind.ts#L13C1-L14C16

As you can see from the flow, transformElement checks the arg of the directive and if it does not exist, it does not execute transformVBind but converts it to a function call to mergeProps.

```vue
<p v-bind="bindingObject" class="my-class">hello</p>
```

↓

```ts
h('p', mergeProps(bindingObject, { class: 'my-class' }), 'hello')
```

Also, for class and style, they have various developer interfaces, so they need to be normalized.  
https://vuejs.org/api/built-in-directives.html#v-bind

Implement functions called normalizeClass and normalizeStyle, and apply them respectively.

If the arg is dynamic, it is impossible to determine the specific one, so implement a function called normalizeProps and call it. (It calls normalizeClass and normalizeStyle internally)

Now that we have implemented this far, let's see how it works!

![vbind_test](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/vbind_test.png)

Looks great!

Next time, we will implement v-on.

Source code up to this point:  
[GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/020_v_bind)
