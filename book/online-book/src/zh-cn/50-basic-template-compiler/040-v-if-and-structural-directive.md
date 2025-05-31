# v-if 和结构指令

现在让我们继续实现指令！

最后，我们将实现 v-if．

## v-if 指令与之前指令的区别

到目前为止，我们已经实现了 v-bind 和 v-on 等指令．

现在让我们实现 v-if，但 v-if 与这些指令略有不同．

根据 Vue.js 官方文档关于编译时优化的摘录，

> 在这种情况下，整个模板有一个单一的块，因为它不包含任何结构指令，如 v-if 和 v-for。

https://vuejs.org/guide/extras/rendering-mechanism.html#tree-flattening

如你所见，可以找到"结构指令"这个词．（你不必担心什么是 Tree Flattening，因为它将单独解释．）

如前所述，v-if 和 v-for 被称为"结构指令"，是涉及结构的指令．

在 Angular 的文档中，它们也被明确提及．

https://angular.jp/guide/structural-directives

v-if 和 v-for 是不仅改变元素的属性（以及事件的行为），还通过切换元素的存在或根据列表中项目的数量生成/删除元素来改变元素结构的指令．

## 期望的开发者接口

让我们考虑如何结合 v-if / v-else-if / v-else 来实现 FizzBuzz．

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const n = ref(1)
    const inc = () => {
      n.value++
    }

    return { n, inc }
  },

  template: `
    <button @click="inc">inc</button>
    <p v-if="n % 5 === 0 && n % 3 === 0">FizzBuzz</p>
    <p v-else-if="n % 5 === 0">Buzz</p>
    <p v-else-if="n % 3 === 0">Fizz</p>
    <p v-else>{{ n }}</p>
  `,
})

const app = createApp(App)

app.mount('#app')
```

首先，让我们考虑我们想要生成的代码．

简单地说，v-if 和 v-else 被转换为如下的条件表达式：

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

如你所见，我们正在向到目前为止实现的代码添加结构．

要实现将 AST 转换为此类代码的转换器，我们需要进行一些修改．

::: warning

当前实现不处理空白和其他跳过，因此中间可能有不必要的文本节点．

但是，v-if 的实现没有问题（你稍后会看到），所以现在请忽略它．

:::

## 结构指令的实现

### 实现与结构相关的方法

在实现 v-if 之前，让我们做一些准备．

如前所述，v-if 和 v-for 是修改 AST 节点结构的结构指令．

为了实现这一点，我们需要在基础转换器中实现几个方法．

具体来说，我们将在 TransformContext 中实现以下三个方法：

```ts
export interface TransformContext extends Required<TransformOptions> {
  // .
  // .
  // .
  replaceNode(node: TemplateChildNode): void // 添加
  removeNode(node?: TemplateChildNode): void // 添加
  onNodeRemoved(): void // 添加
}
```

由于你已经在实现 traverseChildren，我认为你已经在跟踪当前父级和子级的索引．你可以使用它们来实现上述方法．

<!-- NOTE: You may not need to implement this chapter yet. -->

::: details 以防万一

这部分：

我认为你已经实现了它，但我会解释一下，以防万一，因为我在实现它的章节中没有详细解释．

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent // 这个
    context.childIndex = i // 这个
    traverseNode(child, context)
  }
}
```

:::

```ts
export function createTransformContext(
  root: RootNode,
  { nodeTransforms = [], directiveTransforms = {} }: TransformOptions,
): TransformContext {
  const context: TransformContext = {
    // .
    // .
    // .

    // 用给定节点替换当前节点和相应父级的子级
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    },

    // 从当前节点的父级的子级中删除给定节点
    removeNode(node) {
      const list = context.parent!.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (!node || node === context.currentNode) {
        // 当前节点被删除
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // 兄弟节点被删除
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent!.children.splice(removalIndex, 1)
    },

    // 这在使用 replaceNode 等时注册
    onNodeRemoved: () => {},
  }

  return context
}
```

现有实现也需要一些修改．调整 traverseChildren 以处理调用 removeNode 的情况．

由于删除节点时索引会发生变化，因此在删除节点时减少索引．

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  let i = 0 // 这个
  const nodeRemoved = () => {
    i-- // 这个
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved // 这个
    traverseNode(child, context)
  }
}
```

### createStructuralDirectiveTransform 的实现

为了实现 v-if 和 v-for 等指令，我们将实现一个名为 createStructuralDirectiveTransform 的辅助函数．

这些转换器只作用于 NodeTypes.ELEMENT，并将每个转换器的实现应用于 Node 拥有的 DirectiveNode．

嗯，实现本身并不大，所以我认为如果你实际看到它会更容易理解．它看起来像这样：

```ts
// 每个转换器（v-if/v-for 等）都根据此接口实现。
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void)

export function createStructuralDirectiveTransform(
  // 名称也支持正则表达式。
  // 例如，在 v-if 的转换器中，假设接收类似 /^(if|else|else-if)$/ 的东西。
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      // 只作用于 NodeTypes.ELEMENT
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 为匹配名称的 NodeTypes.DIRECTIVE 执行转换器
          props.splice(i, 1)
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
```

## 实现 v-if

### AST 实现

准备工作到此为止已经完成．从这里开始，让我们实现 v-if．

像往常一样，让我们从 AST 的定义开始，实现解析器．

我想说，但这次似乎我们不需要解析器．

相反，这次我们将考虑我们希望转换后的 AST 看起来如何，并实现转换器来相应地转换它．

让我们看看开始时假设的编译代码．

```ts
function render(_ctx) {
  with (_ctx) {
    const {
      toHandlerKey: _toHandlerKey,
      normalizeProps: _normalizeProps,
      createVNode: _createVNode,
      createCommentVNode: _createCommentVNode,
      Fragment: _Fragment,
    } = ChibiVue

    return _createVNode(_Fragment, null, [
      _createVNode(
        'button',
        _normalizeProps({ [_toHandlerKey('click')]: inc }),
        'inc',
      ),
      n % 5 === 0 && n % 3 === 0
        ? _createVNode('p', null, 'FizzBuzz')
        : n % 5 === 0
          ? _createVNode('p', null, 'Buzz')
          : n % 3 === 0
            ? _createVNode('p', null, 'Fizz')
            : _createVNode('p', null, n),
    ])
  }
}
```

可以看出，它最终被转换为条件表达式（三元运算符）．

由于我们以前从未处理过条件表达式，似乎我们需要在 Codegen 的 AST 端处理这个．
基本上，我们想要考虑三个信息（因为它是"三元"运算符）．

- **条件**
  这是 A ? B : C 中对应于 A 的部分．
  用名称"condition"表示．
- **条件匹配时的节点**
  这是 A ? B : C 中对应于 B 的部分．
  用名称"consequent"表示．
- **条件不匹配时的节点**
  这是 A ? B : C 中对应于 C 的部分．
  用名称"alternate"表示．

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  JS_CONDITIONAL_EXPRESSION,
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION
  test: JSChildNode
  consequent: JSChildNode
  alternate: JSChildNode
  newline: boolean
}

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ConditionalExpression
  | ExpressionNode

export function createConditionalExpression(
  test: ConditionalExpression['test'],
  consequent: ConditionalExpression['consequent'],
  alternate: ConditionalExpression['alternate'],
  newline = true,
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  }
}
```

我们将使用这些实现一个 AST 来表示 VIf 节点．

```ts
export const enum NodeTypes {
  // .
  // .
  // .
  IF,
  IF_BRANCH,
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode?: IfConditionalExpression
}

export interface IfConditionalExpression extends ConditionalExpression {
  consequent: VNodeCall
  alternate: VNodeCall | IfConditionalExpression
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
}

export type ParentNode = RootNode | ElementNode | IfBranchNode
```

### 转换器的实现

现在我们有了 AST，让我们实现生成此 AST 的转换器．

想法是基于几个 `ElementNode` 生成一个 `IfNode`．

所谓"几个"，在这种情况下，意味着如果有多个 `ElementNode`，我们需要生成一个包含从 `v-if` 到 `v-else` 语句的单个 `IfNode`．

如果第一个 `v-if` 匹配，我们需要在检查后续节点是否为 `v-else-if` 或 `v-else` 的同时生成 `IfNode`．

让我们首先实现整体结构，使用我们之前实现的 `createStructuralDirectiveTransform`．

具体来说，由于我们最终想要用我们之前实现的 AST 填充 `codegenNode`，我们将在此转换器的 `onExit` 中生成 Node．

```ts
export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            context,
          ) as IfConditionalExpression
        } else {
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            context,
          )
        }
      }
    })
  },
)

export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // TODO:
}
```

```ts
/// 用于生成 codegenNode 的函数

// 为分支生成 codegenNode
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      // alternate 暂时设置为生成注释。
      // 当遇到 v-else-if 或 v-else 时，它将被替换为目标 Node。
      // 这是写 `parentCondition.alternate = createCodegenNodeForBranch(branch, context);` 的部分。
      // 如果没有遇到 v-else-if 或 v-else，它将保持为 CREATE_COMMENT Node。
      createCallExpression(context.helper(CREATE_COMMENT), ['""', 'true']),
    ) as IfConditionalExpression
  } else {
    return createChildrenCodegenNode(branch, context)
  }
}

function createChildrenCodegenNode(
  branch: IfBranchNode,
  context: TransformContext,
): VNodeCall {
  // 只是从分支中提取 vnode call
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  // 通过从节点追踪获取结束 Node
  while (true) {
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        node = node.alternate
      } else {
        return node
      }
    }
  }
}
```

在 `processIf` 中，执行更具体的 AST 节点转换．

有 if / else-if / else 的情况，但让我们首先考虑 `if` 的情况．

这非常简单．我们创建一个 IfNode 并执行 codegenNode 生成．
此时，我们将当前 Node 生成为 IfBranch 并将其分配给 IfNode，然后用 IfNode 替换它．

```
- parent
  - currentNode

↓

- parent
  - IfNode
    - IfBranch (currentNode)
```

这是改变结构的图像．

```ts
export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
) {
  // 我们将提前在 exp 上运行 processExpression。
  if (!context.isBrowser && dir.exp) {
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode: IfNode = {
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch],
    }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    // TODO:
  }
}

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: [node],
  }
}
```

让我们考虑除 v-if 之外的情况．

我们将通过上下文从父级的子级遍历以获取兄弟节点．
我们将循环遍历节点（从当前节点本身开始）并基于自身生成 IfBranch，将它们推入分支．
在此过程中，注释和空文本将被删除．

```ts
if (dir.name === 'if') {
  /** 省略 */
} else {
  const siblings = context.parent!.children
  let i = siblings.indexOf(node)
  while (i-- >= -1) {
    const sibling = siblings[i]
    if (sibling && sibling.type === NodeTypes.COMMENT) {
      context.removeNode(sibling)
      continue
    }

    if (
      sibling &&
      sibling.type === NodeTypes.TEXT &&
      !sibling.content.trim().length
    ) {
      context.removeNode(sibling)
      continue
    }

    if (sibling && sibling.type === NodeTypes.IF) {
      context.removeNode()
      const branch = createIfBranch(node, dir)
      sibling.branches.push(branch)
      const onExit = processCodegen && processCodegen(sibling, branch, false)
      traverseNode(branch, context)
      if (onExit) onExit()
      context.currentNode = null
    }
    break
  }
}
```

如你所见，实际上 else-if 和 else 没有区别．

即使在 AST 中，如果没有条件，它被定义为 else，所以没有什么特别需要考虑的．
（在 `createIfBranch` 的 `dir.name === "else" ? undefined : dir.exp` 部分被吸收）

重要的是在 `if` 时生成 `IfNode`，对于其他情况，只需将它们推入该 Node 的分支．

通过这样，transformIf 的实现就完成了．我们只需要在周围进行一些调整．

在 traverseNode 中，我们将为 IfNode 拥有的分支执行 traverseNode．

我们还将 IfBranch 包含为 traverseChildren 的目标．

```ts
export function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
) {
  // .
  // .
  // .
  switch (node.type) {
    // .
    // .
    // 添加
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break

    case NodeTypes.IF_BRANCH: // 添加
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
  }
}
```

最后，我们只需要在编译器中将 transformIf 注册为选项．

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformElement],
    { bind: transformBind, on: transformOn },
  ]
}
```

通过这样，转换器就实现了！

剩下的就是实现 codegen，v-if 就完成了．我们快到了，让我们加油！

### codegen 的实现

剩下的很容易．只需基于 ConditionalExpression 的 Node 生成代码．

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF: // 不要忘记添加这个！
      genNode(node.codegenNode!, context, option)
      break
    // .
    // .
    // .
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context, option)
      break
    /* istanbul ignore next */
    case NodeTypes.IF_BRANCH:
      // noop
      break
  }
}

function genConditionalExpression(
  node: ConditionalExpression,
  context: CodegenContext,
  option: CompilerOptions,
) {
  const { test, consequent, alternate, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context)
  } else {
    push(`(`)
    genNode(test, context, option)
    push(`)`)
  }
  needNewline && indent()
  context.indentLevel++
  needNewline || push(` `)
  push(`? `)
  genNode(consequent, context, option)
  context.indentLevel--
  needNewline && newline()
  needNewline || push(` `)
  push(`: `)
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  if (!isNested) {
    context.indentLevel++
  }
  genNode(alternate, context, option)
  if (!isNested) {
    context.indentLevel--
  }
  needNewline && deindent(true /* without newline */)
}
```

像往常一样，我们只是基于 AST 生成条件表达式，所以没有什么特别困难的．

## 完成！！

嗯，自从我们有一个稍微胖的章节以来已经有一段时间了，但通过这样，v-if 的实现就完成了！（干得好！）

让我们尝试真正运行它！！

它工作正常！

![vif_fizzbuzz](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/vif_fizzbuzz.png)

到此为止的源代码：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/040_v_if_and_structural_directive)
