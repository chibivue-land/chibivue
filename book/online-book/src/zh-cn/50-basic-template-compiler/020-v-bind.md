# 让我们实现指令（v-bind）

## 方法

现在让我们实现指令，这是 Vue.js 的精髓。  
像往常一样，我们将指令应用到转换器，出现在那里的接口称为 DirectiveTransform。  
DirectiveTransform 接受 DirectiveNode 和 ElementNode 作为参数，并返回转换后的 Property。

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

首先，让我们检查这次我们要实现的开发者接口。

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

v-bind 有各种表示法。详情请参考官方文档。  
我们还将处理 class 和 style。

https://vuejs.org/api/built-in-directives.html#v-bind

## AST 修改

首先，让我们修改 AST。目前，exp 和 arg 都是简单的字符串，所以我们需要将它们更改为接受 ExpressionNode。

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined // 这里
  arg: ExpressionNode | undefined // 这里
}
```

让我再次解释 name、arg 和 exp。  
name 是指令名称，如 v-bind 或 v-on。它可以是 on 或 bind。  
由于我们这次实现 v-bind，它将是 bind。

arg 是由 : 指定的参数。对于 v-bind，它包括 id 和 style。  
（在 v-on 的情况下，它包括 click 和 input。）

exp 是右侧。在 v-bind:id="count" 的情况下，包含 count。  
exp 和 arg 都可以动态嵌入变量，所以它们的类型是 ExpressionNode。  
（因为 arg 也可以像 v-bind:[key]="count" 一样是动态的）

![dir_ast](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/dir_ast.drawio.png)

## 解析器修改

我们将更新解析器实现以遵循这个 AST 修改。我们将 exp 和 arg 解析为 SimpleExpressionNode。

我们还将解析 v-on 中使用的 @ 和插槽中使用的 #。  
（由于考虑正则表达式很麻烦（而且在解释时逐渐添加它们很麻烦），我们现在将借用原始代码。）  
参考：https://github.com/vuejs/core/blob/623ba514ec0f5adc897db90c0f986b1b6905e014/packages/compiler-core/src/parse.ts#L802

由于代码有点长，我将在代码中写注释来解释。

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
  // 这里的正则表达式是从原始源代码借用的
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      // 这里的正则表达式是从原始源代码借用的
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name,
      )!

    // 检查名称部分的匹配，如果以 ":" 开头则将其视为 "bind"
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

      // 如果是像 "[arg]" 这样的动态参数，将 isStatic 设置为 false 并提取内容作为内容
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

通过这样，我们能够解析这次想要处理的 AST Node。

## 转换器的实现

接下来，让我们编写将此 AST 转换为 Codegen AST 的实现。  
由于它有点复杂，我在下图中总结了流程。请先看一下。  
一般来说，必要的项目是 v-bind 是否有参数，是否是 class 或 style。  
※ 省略了这次不涉及的处理部分。（请注意这个图不是很严格。）

![dir_ast](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/transform_vbind.drawio.png)

首先，作为前提，由于指令基本上是为元素声明的，  
与指令相关的转换器从 transformElement 调用。

由于我们这次想要实现 v-bind，我们将实现一个名为 transformVBind 的函数，  
但需要注意的一点是，这个函数只转换具有 args 的声明。

transformVBind 的作用是将

```
v-bind:id="count"
```

转换为像这样的对象（实际上是表示此对象的 Codegen Node）

```ts
{
  id: count
}
```

在原始实现中也给出了以下解释。

> codegen for the entire props object. This transform here is only for v-bind _with_ args.

引用自：https://github.com/vuejs/core/blob/623ba514ec0f5adc897db90c0f986b1b6905e014/packages/compiler-core/src/transforms/vBind.ts#L13C1-L14C16

正如你从流程中可以看到的，transformElement 检查指令的 arg，如果它不存在，它不执行 transformVBind，而是将其转换为对 mergeProps 的函数调用。

```vue
<p v-bind="bindingObject" class="my-class">hello</p>
```

↓

```ts
h('p', mergeProps(bindingObject, { class: 'my-class' }), 'hello')
```

另外，对于 class 和 style，它们有各种开发者接口，所以需要进行规范化。  
https://vuejs.org/api/built-in-directives.html#v-bind

实现名为 normalizeClass 和 normalizeStyle 的函数，并分别应用它们。

如果 arg 是动态的，无法确定具体的，所以实现一个名为 normalizeProps 的函数并调用它。（它在内部调用 normalizeClass 和 normalizeStyle）

现在我们已经实现到这里，让我们看看它是如何工作的！

![vbind_test](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/vbind_test.png)

看起来很棒！

下次，我们将实现 v-on。

到此为止的源代码：  
[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/020_v_bind)
