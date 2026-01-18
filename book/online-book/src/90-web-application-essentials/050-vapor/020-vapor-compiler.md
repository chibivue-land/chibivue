# Vapor Compiler

In the previous section, we looked at the runtime functions that power Vapor Mode (`template`, `setText`, `on`).
In this section, let's implement a compiler that automatically generates code using these functions from templates.

## Goal of the Vapor Compiler

The goal of the Vapor compiler is to transform a template like this:

```html
<button @click="count++">{{ count }}</button>
```

Into code like this:

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

The key points are:

1. **Static parts become template strings**: The HTML structure is created upfront as a string
2. **Dynamic parts are handled by renderEffect**: Reactive value changes directly trigger DOM updates
3. **Event handlers are directly attached**: No virtual DOM event delegation

## Compiler Architecture

The Vapor compiler follows a pipeline similar to the regular template compiler, but uses a more sophisticated approach with an Intermediate Representation (IR):

```
Template (string)
  ↓ [Parse]
AST (Abstract Syntax Tree)
  ↓ [Transform]
IR (Intermediate Representation)
  ↓ [Codegen]
Vapor Code (string)
```

## What is IR (Intermediate Representation)?

IR (Intermediate Representation) is a data structure that sits between the AST and the final code.
The benefits of using IR include:

1. **Separation of Concerns**: Clearly separates parsing from code generation
2. **Ease of Optimization**: Static analysis and optimization are easier at the IR level
3. **Extensibility**: Adding new features is straightforward

### IR Structure

```ts
// Types of IR nodes
enum IRNodeTypes {
  ROOT = "root",
  BLOCK = "block",
  SET_TEXT = "setText",
  SET_EVENT = "setEvent",
  SET_PROP = "setProp",
  IF = "if",
  FOR = "for",
}

// Block IR Node - container for operations and effects
interface BlockIRNode {
  type: IRNodeTypes.BLOCK;
  node: RootNode | TemplateChildNode;
  dynamic: IRDynamicInfo;
  effect: IREffect[];      // Reactive operations
  operation: OperationNode[]; // Non-reactive operations
  returns: number[];       // Element IDs to return
}

// Effect - A set of reactive dependencies and operations
interface IREffect {
  expressions: SimpleExpressionNode[]; // Dependent expressions
  operations: OperationNode[];         // Operations to execute
}
```

### Operation Node Examples

```ts
// Text update
interface SetTextIRNode {
  type: IRNodeTypes.SET_TEXT;
  element: number;  // Element ID
  values: SimpleExpressionNode[];
}

// Event binding
interface SetEventIRNode {
  type: IRNodeTypes.SET_EVENT;
  element: number;
  key: string;      // Event name
  value: SimpleExpressionNode;
  modifiers?: string[];
}

// Property binding
interface SetPropIRNode {
  type: IRNodeTypes.SET_PROP;
  element: number;
  key: string;
  value: SimpleExpressionNode;
}
```

## The Role of the Transformer

The Transformer converts AST to IR.
It traverses each AST node and generates appropriate IR nodes.

### TransformContext

```ts
interface TransformContext {
  root: RootIRNode;
  block: BlockIRNode;
  template: string;        // Static template string
  elementCount: number;

  // Assign element ID
  reference(): number;

  // Register reactive effects
  registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void;

  // Register non-reactive operations
  registerOperation(...operations: OperationNode[]): void;

  // Enter a new block (for v-if, v-for)
  enterBlock(block: BlockIRNode): () => void;
}
```

### Transform Flow

```ts
export function transform(ast: RootNode, source: string): RootIRNode {
  const ir = createRootIR(ast, source);
  const context = createTransformContext(ir);

  // Recursively transform children
  transformChildren(ast.children, context);

  // Store template string
  ir.template.push(context.template);

  return ir;
}
```

### Directive Transformation

Each directive is processed by a dedicated transform function:

```ts
// v-on transformation
function transformVOn(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const eventName = (dir.arg as SimpleExpressionNode).content;

  // Events are registered as operations (not reactive)
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    element: elementId,
    key: eventName,
    value: dir.exp as SimpleExpressionNode,
    modifiers: dir.modifiers,
  });
}

// v-bind transformation
function transformVBind(dir: DirectiveNode, elementId: number, context: TransformContext): void {
  if (!dir.arg || !dir.exp) return;

  const propName = (dir.arg as SimpleExpressionNode).content;

  // Register as effect (reactive)
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

### Constant Expression Optimization

`registerEffect` checks whether expressions are constant, and if so, registers them as regular `operation` instead of `effect`:

```ts
registerEffect(expressions: SimpleExpressionNode[], operations: OperationNode[]): void {
  // Filter out constant expressions
  const reactiveExpressions = expressions.filter((exp) => !isConstantExpression(exp));

  // If no reactive dependencies, register as operation
  if (reactiveExpressions.length === 0) {
    context.registerOperation(...operations);
    return;
  }

  // Register as effect
  currentBlock.effect.push({
    expressions: reactiveExpressions,
    operations,
  });
}
```

## What is renderEffect?

`renderEffect` is the core function of Vapor Mode.
Unlike the Virtual DOM's diff-based approach, it directly tracks reactive dependencies and updates the DOM when they change.

### How It Works

```ts
/**
 * renderEffect - Core mechanism for reactive DOM updates in Vapor Mode
 *
 * 1. Wraps a DOM update function in a reactive effect
 * 2. Automatically tracks which reactive values are accessed
 * 3. Re-runs the update function when tracked values change
 * 4. Updates only the specific DOM nodes that need changes
 *
 * Important: renderEffect also handles lifecycle hooks:
 * - Calls onBeforeUpdate hooks before each update (after initial mount)
 * - Calls onUpdated hooks after each update (after initial mount)
 */
export const renderEffect = (fn: () => void): void => {
  const instance = currentInstance;

  effect(() => {
    // Before update: call onBeforeUpdate hooks (only after mount)
    if (instance?.isMounted) {
      const { bu } = instance;
      if (bu) invokeArrayFns(bu);
    }

    // Execute the update
    fn();

    // After update: call onUpdated hooks (only after mount)
    if (instance?.isMounted) {
      const { u } = instance;
      if (u) {
        queueMicrotask(() => invokeArrayFns(u));
      }
    }
  });
};
```

### Generated Code Example

```ts
// Template: <span>{{ count }}</span>

renderEffect(() => {
  setText(_el0, "", count.value)
})

// When count.value changes:
// 1. onBeforeUpdate hooks are called
// 2. The text content is updated
// 3. onUpdated hooks are called (in a microtask)
```

### Comparison with Virtual DOM

| Aspect | Virtual DOM | Vapor (renderEffect) |
|--------|-------------|---------------------|
| Update Granularity | Re-render entire component | Update only changed parts |
| Tracking Method | Diff algorithm | Reactive dependency tracking |
| Overhead | VNode creation and comparison | None (direct DOM operations) |

## Codegen Implementation

Codegen generates code from IR:

```ts
export function generateVaporFromIR(ir: RootIRNode, options = {}): VaporCodegenResult {
  const context = createVaporCodegenContext();

  // Generate preamble (imports, etc.)
  genVaporPreamble(context, options.isBrowser);

  // Generate component function
  push(`((_self) => {`);
  indent();

  // Generate template() call
  push(`const _root = _template(\`${ir.template[0]}\`);`);

  // Generate element references
  for (let i = 0; i < elementCount; i++) {
    push(`const _el${i} = _root${generateElementPath(i)};`);
  }

  // Generate non-reactive operations
  for (const op of block.operation) {
    genOperation(op, context);
  }

  // Generate reactive effects
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

## Usage Example

```ts
import { compile } from "@chibivue/compiler-vapor";

// IR-based compilation
const result = compile(`
  <button @click="count++" :class="btnClass">Count: {{ count }}</button>
`, { useIR: true });

console.log(result.code);
```

Output:

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

## Summary

The Vapor compiler transforms templates to code through this pipeline:

1. **Parse**: Transform template to AST
2. **Transform**: Transform AST to IR (including optimizations)
3. **Codegen**: Generate code from IR

Using IR enables:
- Easier static analysis and optimization
- Improved code maintainability
- Simpler addition of new features

With `renderEffect`:
- Fine-grained reactive updates are possible
- Virtual DOM overhead is eliminated
- Only changed parts are efficiently updated
- Lifecycle hooks (onBeforeUpdate, onUpdated) are automatically handled

In the next section, we'll look at how SSR support allows us to render Vapor components on the server.
