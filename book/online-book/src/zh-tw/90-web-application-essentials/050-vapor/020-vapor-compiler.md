# Vapor 編譯器

在上一節中，我們了解了構成 Vapor 模式基礎的執行期函式（`template`，`setText`，`on`）。
在本節中，讓我們實作一個編譯器，它可以從模板自動產生使用這些函式的程式碼。

## Vapor 編譯器的目標

Vapor 編譯器的目標是將這樣的模板：

```html
<button @click="count++">{{ count }}</button>
```

轉換成這樣的程式碼：

```ts
import { template as _template, setText as _setText, on as _on, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"

((_self) => {
  const _root = _template(`<button><!----></button>`);
  const _el0 = _root.firstChild;
  _renderEffect(() => {
    _setText(_el0, "", count.value);
  });
  _on(_root, "click", () => count++);
  return _root;
})
```

關鍵點是：

1. **靜態部分變成模板字串**：HTML 結構被預先建立為字串
2. **動態部分透過 renderEffect 處理**：響應式值的變化觸發直接的 DOM 更新
3. **事件處理器直接附加**：沒有虛擬 DOM 事件委託

## 編譯器架構

Vapor 編譯器遵循與常規模板編譯器類似的流程，但採用了更精細的中間表示（IR）方法：

```
模板 (string)
  ↓ [Parse]
AST (抽象語法樹)
  ↓ [Transform]
IR (中間表示)
  ↓ [Codegen]
Vapor 程式碼 (string)
```

## 什麼是 IR（中間表示）？

IR（中間表示）是位於 AST 和最終程式碼之間的資料結構。
使用 IR 的好處包括：

1. **關注點分離**：清晰地分離解析和程式碼產生
2. **易於最佳化**：在 IR 層面更容易進行靜態分析和最佳化
3. **可擴充性**：加入新功能更加簡單

### IR 結構

```ts
// IR 節點型別
enum IRNodeTypes {
  ROOT = "root",
  BLOCK = "block",
  SET_TEXT = "setText",
  SET_EVENT = "setEvent",
  SET_PROP = "setProp",
  IF = "if",
  FOR = "for",
}

// Block IR 節點 - 操作和效果的容器
interface BlockIRNode {
  type: IRNodeTypes.BLOCK;
  node: RootNode | TemplateChildNode;
  dynamic: IRDynamicInfo;
  effect: IREffect[];      // 響應式操作
  operation: OperationNode[]; // 非響應式操作
  returns: number[];       // 要回傳的元素 ID
}

// Effect - 響應式相依和操作的集合
interface IREffect {
  expressions: SimpleExpressionNode[]; // 相依的運算式
  operations: OperationNode[];         // 要執行的操作
}
```

### 操作節點示例

```ts
// 文本更新
interface SetTextIRNode {
  type: IRNodeTypes.SET_TEXT;
  element: number;  // 元素 ID
  values: SimpleExpressionNode[];
}

// 事件綁定
interface SetEventIRNode {
  type: IRNodeTypes.SET_EVENT;
  element: number;
  key: string;      // 事件名
  value: SimpleExpressionNode;
  modifiers?: string[];
}

// 屬性綁定
interface SetPropIRNode {
  type: IRNodeTypes.SET_PROP;
  element: number;
  key: string;
  value: SimpleExpressionNode;
}
```

## Transformer 的作用

Transformer 將 AST 轉換為 IR。
它遍歷每個 AST 節點並產生適當的 IR 節點。

### TransformContext

```ts
interface TransformContext {
  root: RootIRNode;
  block: BlockIRNode;
  template: string;        // 靜態模板字串
  elementCount: number;

  // 分配元素 ID
  reference(): number;

  // 註冊響應式效果
  registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void;

  // 註冊非響應式操作
  registerOperation(...operations: OperationNode[]): void;

  // 進入新區塊（用於 v-if, v-for）
  enterBlock(block: BlockIRNode): () => void;
}
```

### 轉換流程

```ts
export function transform(ast: RootNode, source: string): RootIRNode {
  const ir = createRootIR(ast, source);
  const context = createTransformContext(ir);

  // 遞迴轉換子元素
  transformChildren(ast.children, context);

  // 儲存模板字串
  ir.template.push(context.template);

  return ir;
}
```

### 指令轉換

每個指令由專用的轉換函式處理：

```ts
// v-on 轉換
function transformVOn(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const eventName = (dir.arg as SimpleExpressionNode).content;

  // 事件註冊為操作（非響應式）
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    element: elementId,
    key: eventName,
    value: dir.exp as SimpleExpressionNode,
    modifiers: dir.modifiers,
  });
}

// v-bind 轉換
function transformVBind(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const propName = (dir.arg as SimpleExpressionNode).content;

  // 註冊為效果（響應式）
  context.registerEffect([dir.exp as SimpleExpressionNode], [
    {
      type: IRNodeTypes.SET_PROP,
      element: elementId,
      key: propName,
      value: dir.exp as SimpleExpressionNode,
    },
  ]);
}
```

### 常量運算式最佳化

`registerEffect` 檢查運算式是否為常量，如果是，則將其註冊為普通 `operation` 而不是 `effect`：

```ts
registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void {
  // 過濾掉常量運算式
  const reactiveExpressions = expressions.filter((exp) => !isConstantExpression(exp));

  // 如果沒有響應式相依，註冊為操作
  if (reactiveExpressions.length === 0) {
    context.registerOperation(...operations);
    return;
  }

  // 註冊為效果
  currentBlock.effect.push({
    expressions: reactiveExpressions,
    operations,
  });
}
```

## 什麼是 renderEffect？

`renderEffect` 是 Vapor 模式的核心函式。
與虛擬 DOM 基於差異的方法不同，它直接追蹤響應式相依並在變化時更新 DOM。

### 工作原理

```ts
/**
 * renderEffect - Vapor 模式中響應式 DOM 更新的核心機制
 *
 * 1. 將 DOM 更新函式包裝在響應式效果中
 * 2. 自動追蹤存取了哪些響應式值
 * 3. 當追蹤的值發生變化時重新執行更新函式
 * 4. 只更新需要更改的特定 DOM 節點
 *
 * 重要：renderEffect 還處理生命週期鉤子：
 * - 在每次更新前呼叫 onBeforeUpdate 鉤子（初始掛載後）
 * - 在每次更新後呼叫 onUpdated 鉤子（初始掛載後）
 */
export const renderEffect = (fn: () => void): void => {
  const instance = currentInstance;

  effect(() => {
    // 更新前：呼叫 onBeforeUpdate 鉤子（僅在掛載後）
    if (instance?.isMounted) {
      const { bu } = instance;
      if (bu) invokeArrayFns(bu);
    }

    // 執行更新
    fn();

    // 更新後：呼叫 onUpdated 鉤子（僅在掛載後）
    if (instance?.isMounted) {
      const { u } = instance;
      if (u) {
        queueMicrotask(() => invokeArrayFns(u));
      }
    }
  });
};
```

### 產生的程式碼示例

```ts
// 模板: <span>{{ count }}</span>

renderEffect(() => {
  setText(_el0, "", count.value)
})

// 當 count.value 變化時：
// 1. 呼叫 onBeforeUpdate 鉤子
// 2. 更新文本內容
// 3. 呼叫 onUpdated 鉤子（在微任務中）
```

### 與虛擬 DOM 的比較

| 方面 | 虛擬 DOM | Vapor (renderEffect) |
|------|----------|---------------------|
| 更新粒度 | 重新渲染整個元件 | 只更新變化的部分 |
| 追蹤方法 | 差異算法 | 響應式相依追蹤 |
| 開銷 | VNode 建立和比較 | 無（直接 DOM 操作） |

## Codegen 實作

Codegen 從 IR 產生程式碼：

```ts
export function generateVaporFromIR(ir: RootIRNode, options = {}): VaporCodegenResult {
  const context = createVaporCodegenContext();

  // 產生前導（匯入等）
  genVaporPreamble(context, options.isBrowser);

  // 產生元件函式
  push(`((_self) => {`);
  indent();

  // 產生 template() 呼叫
  push(`const _root = _template(\`${ir.template[0]}\`);`);

  // 產生元素引用
  for (let i = 0; i < elementCount; i++) {
    push(`const _el${i} = _root${generateElementPath(i)};`);
  }

  // 產生非響應式操作
  for (const op of block.operation) {
    genOperation(op, context);
  }

  // 產生響應式效果
  for (const effect of block.effect) {
    push(`_renderEffect(() => {`);
    indent();
    for (const op of effect.operations) {
      genOperation(op, context);
    }
    deindent();
    push(`});`);
  }

  push(`return _root;`);
  deindent();
  push(`})`);

  return { code: context.code, preamble, ast: ir.node };
}
```

## 使用示例

```ts
import { compile } from "@chibivue/compiler-vapor";

// 基於 IR 的編譯
const result = compile(`
  <button @click="count++" :class="btnClass">Count: {{ count }}</button>
`, { useIR: true });

console.log(result.code);
```

輸出：

```ts
import { template as _template, setText as _setText, on as _on, setClass as _setClass, renderEffect as _renderEffect } from "@chibivue/runtime-vapor"

((_self) => {
  const _root = _template(`<button><!----></button>`);
  const _el0 = _root.firstChild;
  const _el1 = _root;
  _on(_el1, "click", count++);
  _renderEffect(() => {
    _setClass(_el1, btnClass);
  });
  _renderEffect(() => {
    _setText(_el0, "", count);
  });
  return _root;
})
```

## 總結

Vapor 編譯器透過以下流程將模板轉換為程式碼：

1. **Parse**：將模板轉換為 AST
2. **Transform**：將 AST 轉換為 IR（包括最佳化）
3. **Codegen**：從 IR 產生程式碼

使用 IR 可以：
- 更容易進行靜態分析和最佳化
- 提高程式碼可維護性
- 簡化新功能的加入

使用 `renderEffect`：
- 可以進行細粒度的響應式更新
- 消除虛擬 DOM 開銷
- 只有更改的部分才會被有效更新
- 自動處理生命週期鉤子（onBeforeUpdate，onUpdated）

在下一節中，我們將了解如何使用 SSR 支援在伺服器上渲染 Vapor 元件。
