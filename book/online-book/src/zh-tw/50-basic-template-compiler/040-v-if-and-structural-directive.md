# v-if 和結構指令

現在讓我們繼續實現指令！

最後，我們將實現 v-if。

## v-if 指令與之前指令的區別

到目前為止，我們已經實現了 v-bind 和 v-on 等指令。

現在讓我們實現 v-if，但 v-if 與這些指令略有不同。

根據 Vue.js 官方文件關於編譯時優化的摘錄，

> 在這種情況下，整個模板有一個單一的塊，因為它不包含任何結構指令，如 v-if 和 v-for。

https://vuejs.org/guide/extras/rendering-mechanism.html#tree-flattening

如你所見，可以找到"結構指令"這個詞。（你不必擔心什麼是 Tree Flattening，因為它將單獨解釋。）

如前所述，v-if 和 v-for 被稱為"結構指令"，是涉及結構的指令。

在 Angular 的文件中，它們也被明確提及。

https://angular.jp/guide/structural-directives

v-if 和 v-for 是不僅改變元素的屬性（以及事件的行為），還透過切換元素的存在或根據列表中項目的數量生成/刪除元素來改變元素結構的指令。

## 期望的開發者介面

讓我們考慮如何結合 v-if / v-else-if / v-else 來實現 FizzBuzz。

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

首先，讓我們考慮我們想要生成的程式碼。

簡單地說，v-if 和 v-else 被轉換為如下的條件表達式：

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

如你所見，我們正在向到目前為止實現的程式碼添加結構。

要實現將 AST 轉換為此類程式碼的轉換器，我們需要進行一些修改。

::: warning

當前實現不處理空白和其他跳過，因此中間可能有不必要的文字節點。

但是，v-if 的實現沒有問題（你稍後會看到），所以現在請忽略它。

:::

## 結構指令的實現

### 實現與結構相關的方法

在實現 v-if 之前，讓我們做一些準備。

如前所述，v-if 和 v-for 是修改 AST 節點結構的結構指令。

為了實現這一點，我們需要在基礎轉換器中實現幾個方法。

具體來說，我們將在 TransformContext 中實現以下三個方法：

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

由於你已經在實現 traverseChildren，我認為你已經在跟蹤當前父級和子級的索引。你可以使用它們來實現上述方法。

<!-- NOTE: You may not need to implement this chapter yet. -->

::: details 以防萬一

這部分：

我認為你已經實現了它，但我會解釋一下，以防萬一，因為我在實現它的章節中沒有詳細解釋。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent // 這個
    context.childIndex = i // 這個
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

    // 用給定節點替換當前節點和相應父級的子級
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    },

    // 從當前節點的父級的子級中刪除給定節點
    removeNode(node) {
      const list = context.parent!.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
          ? context.childIndex
          : -1
      if (!node || node === context.currentNode) {
        // 當前節點被刪除
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        // 兄弟節點被刪除
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent!.children.splice(removalIndex, 1)
    },

    // 這在使用 replaceNode 等時註冊
    onNodeRemoved: () => {},
  }

  return context
}
```

現有實現也需要一些修改。調整 traverseChildren 以處理呼叫 removeNode 的情況。

由於刪除節點時索引會發生變化，因此在刪除節點時減少索引。

```ts
export function traverseChildren(
  parent: ParentNode,
  context: TransformContext,
) {
  let i = 0 // 這個
  const nodeRemoved = () => {
    i-- // 這個
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved // 這個
    traverseNode(child, context)
  }
}
```

### createStructuralDirectiveTransform 的實現

為了實現 v-if 和 v-for 等指令，我們將實現一個名為 createStructuralDirectiveTransform 的輔助函式。

這些轉換器只作用於 NodeTypes.ELEMENT，並將每個轉換器的實現應用於 Node 擁有的 DirectiveNode。

嗯，實現本身並不大，所以我認為如果你實際看到它會更容易理解。它看起來像這樣：

```ts
// 每個轉換器（v-if/v-for 等）都根據此介面實現。
export type StructuralDirectiveTransform = (
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
) => void | (() => void)

export function createStructuralDirectiveTransform(
  // 名稱也支援正規表達式。
  // 例如，在 v-if 的轉換器中，假設接收類似 /^(if|else|else-if)$/ 的東西。
  name: string | RegExp,
  fn: StructuralDirectiveTransform,
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      // 只作用於 NodeTypes.ELEMENT
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 為匹配名稱的 NodeTypes.DIRECTIVE 執行轉換器
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

## 實現 v-if

### AST 實現

準備工作到此為止已經完成。從這裡開始，讓我們實現 v-if。

像往常一樣，讓我們從 AST 的定義開始，實現解析器。

我想說，但這次似乎我們不需要解析器。

相反，這次我們將考慮我們希望轉換後的 AST 看起來如何，並實現轉換器來相應地轉換它。

讓我們看看開始時假設的編譯程式碼。

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

可以看出，它最終被轉換為條件表達式（三元運算符）。

由於我們以前從未處理過條件表達式，似乎我們需要在 Codegen 的 AST 端處理這個。
基本上，我們想要考慮三個資訊（因為它是"三元"運算符）。

- **條件**
  這是 A ? B : C 中對應於 A 的部分。
  用名稱"condition"表示。
- **條件匹配時的節點**
  這是 A ? B : C 中對應於 B 的部分。
  用名稱"consequent"表示。
- **條件不匹配時的節點**
  這是 A ? B : C 中對應於 C 的部分。
  用名稱"alternate"表示。

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

我們將使用這些實現一個 AST 來表示 VIf 節點。

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

### 轉換器的實現

現在我們有了 AST，讓我們實現生成此 AST 的轉換器。

想法是基於幾個 `ElementNode` 生成一個 `IfNode`。

所謂"幾個"，在這種情況下，意味著如果有多個 `ElementNode`，我們需要生成一個包含從 `v-if` 到 `v-else` 語句的單個 `IfNode`。

如果第一個 `v-if` 匹配，我們需要在檢查後續節點是否為 `v-else-if` 或 `v-else` 的同時生成 `IfNode`。

讓我們首先實現整體結構，使用我們之前實現的 `createStructuralDirectiveTransform`。

具體來說，由於我們最終想要用我們之前實現的 AST 填充 `codegenNode`，我們將在此轉換器的 `onExit` 中生成 Node。

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
/// 用於生成 codegenNode 的函式

// 為分支生成 codegenNode
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  context: TransformContext,
): IfConditionalExpression | VNodeCall {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, context),
      // alternate 暫時設置為生成註釋。
      // 當遇到 v-else-if 或 v-else 時，它將被替換為目標 Node。
      // 這是寫 `parentCondition.alternate = createCodegenNodeForBranch(branch, context);` 的部分。
      // 如果沒有遇到 v-else-if 或 v-else，它將保持為 CREATE_COMMENT Node。
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
  // 只是從分支中提取 vnode call
  const { children } = branch
  const firstChild = children[0]
  const vnodeCall = (firstChild as ElementNode).codegenNode as VNodeCall
  return vnodeCall
}

function getParentCondition(
  node: IfConditionalExpression,
): IfConditionalExpression {
  // 透過從節點追蹤獲取結束 Node
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

在 `processIf` 中，執行更具體的 AST 節點轉換。

有 if / else-if / else 的情況，但讓我們首先考慮 `if` 的情況。

這非常簡單。我們創建一個 IfNode 並執行 codegenNode 生成。
此時，我們將當前 Node 生成為 IfBranch 並將其分配給 IfNode，然後用 IfNode 替換它。

```
- parent
  - currentNode

↓

- parent
  - IfNode
    - IfBranch (currentNode)
```

這是改變結構的圖像。

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
  // 我們將提前在 exp 上執行 processExpression。
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

讓我們考慮除 v-if 之外的情況。

我們將透過上下文從父級的子級遍歷以獲取兄弟節點。
我們將循環遍歷節點（從當前節點本身開始）並基於自身生成 IfBranch，將它們推入分支。
在此過程中，註釋和空文字將被刪除。

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

如你所見，實際上 else-if 和 else 沒有區別。

即使在 AST 中，如果沒有條件，它被定義為 else，所以沒有什麼特別需要考慮的。
（在 `createIfBranch` 的 `dir.name === "else" ? undefined : dir.exp` 部分被吸收）

重要的是在 `if` 時生成 `IfNode`，對於其他情況，只需將它們推入該 Node 的分支。

透過這樣，transformIf 的實現就完成了。我們只需要在周圍進行一些調整。

在 traverseNode 中，我們將為 IfNode 擁有的分支執行 traverseNode。

我們還將 IfBranch 包含為 traverseChildren 的目標。

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

最後，我們只需要在編譯器中將 transformIf 註冊為選項。

```ts
export function getBaseTransformPreset(): TransformPreset {
  return [
    [transformIf, transformElement],
    { bind: transformBind, on: transformOn },
  ]
}
```

透過這樣，轉換器就實現了！

剩下的就是實現 codegen，v-if 就完成了。我們快到了，讓我們加油！

### codegen 的實現

剩下的很容易。只需基於 ConditionalExpression 的 Node 生成程式碼。

```ts
const genNode = (
  node: CodegenNode,
  context: CodegenContext,
  option: CompilerOptions,
) => {
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.IF: // 不要忘記添加這個！
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

像往常一樣，我們只是基於 AST 生成條件表達式，所以沒有什麼特別困難的。

## 完成！！

嗯，自從我們有一個稍微胖的章節以來已經有一段時間了，但透過這樣，v-if 的實現就完成了！（幹得好！）

讓我們嘗試真正執行它！！

它工作正常！

![vif_fizzbuzz](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/vif_fizzbuzz.png)

到此為止的原始碼：[GitHub](https://github.com/chibivue-land/chibivue/tree/main/book/impls/50_basic_template_compiler/040_v_if_and_structural_directive)
