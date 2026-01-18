# Vapor 编译器

在上一节中，我们了解了构成 Vapor 模式基础的运行时函数（`template`，`setText`，`on`）．
在本节中，让我们实现一个编译器，它可以从模板自动生成使用这些函数的代码．

## Vapor 编译器的目标

Vapor 编译器的目标是将这样的模板：

```html
<button @click="count++">{{ count }}</button>
```

转换成这样的代码：

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

关键点是：

1. **静态部分变成模板字符串**：HTML 结构被预先创建为字符串
2. **动态部分通过 renderEffect 处理**：响应式值的变化触发直接的 DOM 更新
3. **事件处理器直接附加**：没有虚拟 DOM 事件委托

## 编译器架构

Vapor 编译器遵循与常规模板编译器类似的流程，但采用了更精细的中间表示（IR）方法：

```
模板 (string)
  ↓ [Parse]
AST (抽象语法树)
  ↓ [Transform]
IR (中间表示)
  ↓ [Codegen]
Vapor 代码 (string)
```

## 什么是 IR（中间表示）？

IR（中间表示）是位于 AST 和最终代码之间的数据结构．
使用 IR 的好处包括：

1. **关注点分离**：清晰地分离解析和代码生成
2. **易于优化**：在 IR 层面更容易进行静态分析和优化
3. **可扩展性**：添加新功能更加简单

### IR 结构

```ts
// IR 节点类型
enum IRNodeTypes {
  ROOT = "root",
  BLOCK = "block",
  SET_TEXT = "setText",
  SET_EVENT = "setEvent",
  SET_PROP = "setProp",
  IF = "if",
  FOR = "for",
}

// Block IR 节点 - 操作和效果的容器
interface BlockIRNode {
  type: IRNodeTypes.BLOCK;
  node: RootNode | TemplateChildNode;
  dynamic: IRDynamicInfo;
  effect: IREffect[];      // 响应式操作
  operation: OperationNode[]; // 非响应式操作
  returns: number[];       // 要返回的元素 ID
}

// Effect - 响应式依赖和操作的集合
interface IREffect {
  expressions: SimpleExpressionNode[]; // 依赖的表达式
  operations: OperationNode[];         // 要执行的操作
}
```

### 操作节点示例

```ts
// 文本更新
interface SetTextIRNode {
  type: IRNodeTypes.SET_TEXT;
  element: number;  // 元素 ID
  values: SimpleExpressionNode[];
}

// 事件绑定
interface SetEventIRNode {
  type: IRNodeTypes.SET_EVENT;
  element: number;
  key: string;      // 事件名
  value: SimpleExpressionNode;
  modifiers?: string[];
}

// 属性绑定
interface SetPropIRNode {
  type: IRNodeTypes.SET_PROP;
  element: number;
  key: string;
  value: SimpleExpressionNode;
}
```

## Transformer 的作用

Transformer 将 AST 转换为 IR．
它遍历每个 AST 节点并生成适当的 IR 节点．

### TransformContext

```ts
interface TransformContext {
  root: RootIRNode;
  block: BlockIRNode;
  template: string;        // 静态模板字符串
  elementCount: number;

  // 分配元素 ID
  reference(): number;

  // 注册响应式效果
  registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void;

  // 注册非响应式操作
  registerOperation(...operations: OperationNode[]): void;

  // 进入新块（用于 v-if, v-for）
  enterBlock(block: BlockIRNode): () => void;
}
```

### 转换流程

```ts
export function transform(ast: RootNode, source: string): RootIRNode {
  const ir = createRootIR(ast, source);
  const context = createTransformContext(ir);

  // 递归转换子元素
  transformChildren(ast.children, context);

  // 保存模板字符串
  ir.template.push(context.template);

  return ir;
}
```

### 指令转换

每个指令由专用的转换函数处理：

```ts
// v-on 转换
function transformVOn(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const eventName = (dir.arg as SimpleExpressionNode).content;

  // 事件注册为操作（非响应式）
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    element: elementId,
    key: eventName,
    value: dir.exp as SimpleExpressionNode,
    modifiers: dir.modifiers,
  });
}

// v-bind 转换
function transformVBind(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const propName = (dir.arg as SimpleExpressionNode).content;

  // 注册为效果（响应式）
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

### 常量表达式优化

`registerEffect` 检查表达式是否为常量，如果是，则将其注册为普通 `operation` 而不是 `effect`：

```ts
registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void {
  // 过滤掉常量表达式
  const reactiveExpressions = expressions.filter((exp) => !isConstantExpression(exp));

  // 如果没有响应式依赖，注册为操作
  if (reactiveExpressions.length === 0) {
    context.registerOperation(...operations);
    return;
  }

  // 注册为效果
  currentBlock.effect.push({
    expressions: reactiveExpressions,
    operations,
  });
}
```

## 什么是 renderEffect？

`renderEffect` 是 Vapor 模式的核心函数．
与虚拟 DOM 基于差异的方法不同，它直接跟踪响应式依赖并在变化时更新 DOM．

### 工作原理

```ts
/**
 * renderEffect - Vapor 模式中响应式 DOM 更新的核心机制
 *
 * 1. 将 DOM 更新函数包装在响应式效果中
 * 2. 自动跟踪访问了哪些响应式值
 * 3. 当跟踪的值发生变化时重新运行更新函数
 * 4. 只更新需要更改的特定 DOM 节点
 *
 * 重要：renderEffect 还处理生命周期钩子：
 * - 在每次更新前调用 onBeforeUpdate 钩子（初始挂载后）
 * - 在每次更新后调用 onUpdated 钩子（初始挂载后）
 */
export const renderEffect = (fn: () => void): void => {
  const instance = currentInstance;

  effect(() => {
    // 更新前：调用 onBeforeUpdate 钩子（仅在挂载后）
    if (instance?.isMounted) {
      const { bu } = instance;
      if (bu) invokeArrayFns(bu);
    }

    // 执行更新
    fn();

    // 更新后：调用 onUpdated 钩子（仅在挂载后）
    if (instance?.isMounted) {
      const { u } = instance;
      if (u) {
        queueMicrotask(() => invokeArrayFns(u));
      }
    }
  });
};
```

### 生成的代码示例

```ts
// 模板: <span>{{ count }}</span>

renderEffect(() => {
  setText(_el0, "", count.value)
})

// 当 count.value 变化时：
// 1. 调用 onBeforeUpdate 钩子
// 2. 更新文本内容
// 3. 调用 onUpdated 钩子（在微任务中）
```

### 与虚拟 DOM 的比较

| 方面 | 虚拟 DOM | Vapor (renderEffect) |
|------|----------|---------------------|
| 更新粒度 | 重新渲染整个组件 | 只更新变化的部分 |
| 跟踪方法 | 差异算法 | 响应式依赖跟踪 |
| 开销 | VNode 创建和比较 | 无（直接 DOM 操作） |

## Codegen 实现

Codegen 从 IR 生成代码：

```ts
export function generateVaporFromIR(ir: RootIRNode, options = {}): VaporCodegenResult {
  const context = createVaporCodegenContext();

  // 生成前导（导入等）
  genVaporPreamble(context, options.isBrowser);

  // 生成组件函数
  push(`((_self) => {`);
  indent();

  // 生成 template() 调用
  push(`const _root = _template(\`${ir.template[0]}\`);`);

  // 生成元素引用
  for (let i = 0; i < elementCount; i++) {
    push(`const _el${i} = _root${generateElementPath(i)};`);
  }

  // 生成非响应式操作
  for (const op of block.operation) {
    genOperation(op, context);
  }

  // 生成响应式效果
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

// 基于 IR 的编译
const result = compile(`
  <button @click="count++" :class="btnClass">Count: {{ count }}</button>
`, { useIR: true });

console.log(result.code);
```

输出：

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

## 总结

Vapor 编译器通过以下流程将模板转换为代码：

1. **Parse**：将模板转换为 AST
2. **Transform**：将 AST 转换为 IR（包括优化）
3. **Codegen**：从 IR 生成代码

使用 IR 可以：
- 更容易进行静态分析和优化
- 提高代码可维护性
- 简化新功能的添加

使用 `renderEffect`：
- 可以进行细粒度的响应式更新
- 消除虚拟 DOM 开销
- 只有更改的部分才会被有效更新
- 自动处理生命周期钩子（onBeforeUpdate，onUpdated）

在下一节中，我们将了解如何使用 SSR 支持在服务器上渲染 Vapor 组件．
