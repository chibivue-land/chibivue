# Compiler SSR

## What is the SSR Compiler?

The SSR compiler (`@chibivue/compiler-ssr`) is a package that compiles templates into SSR-optimized code.

While normal client-side compilation outputs code that generates VNodes, the SSR compiler outputs code that directly generates HTML strings. This improves rendering efficiency on the server side.

<KawaikoNote variant="base" title="Client vs SSR Difference">

On the client side:
```js
// Returns VNode
return _createElementVNode("div", { class: "hello" }, "Hello")
```

In SSR:
```js
// Directly push HTML string
_push(`<div class="hello">Hello</div>`)
```

SSR is efficient because it generates strings directly without going through VNodes!

</KawaikoNote>

## Package Structure

```
packages/compiler-ssr/src/
├── index.ts                    # Main entry point
├── runtimeHelpers.ts           # SSR helper function definitions
├── ssrCodegenTransform.ts      # SSR code generation transform
└── transforms/
    ├── ssrTransformElement.ts   # Element transformation
    ├── ssrTransformComponent.ts # Component transformation
    ├── ssrVIf.ts               # v-if transformation
    └── ssrVFor.ts              # v-for transformation
```

## Compilation Flow

SSR compilation follows these steps:

1. **Parse**: Convert template to AST (using `parse` from `@chibivue/compiler-dom`)
2. **Transform**: Apply SSR NodeTransforms
3. **SSR Codegen Transform**: Convert AST to SSR code generation nodes
4. **Code Generation**: Generate final JavaScript code

```ts
// packages/compiler-ssr/src/index.ts
export function compile(source: string | RootNode, options: CompilerOptions = {}): CodegenResult {
  const ast = typeof source === "string" ? baseParse(source, options) : source;

  transform(ast, {
    ...options,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      transformExpression,
      ssrTransformElement,
      ssrTransformComponent,
      ...(options.nodeTransforms || []),
    ],
  });

  // Convert template AST to SSR codegen AST
  ssrCodegenTransform(ast, options);

  return generate(ast, options);
}
```

## SSR Transform Context

The context used in SSR transformation.

```ts
// packages/compiler-ssr/src/ssrCodegenTransform.ts
export interface SSRTransformContext {
  root: RootNode;
  options: CompilerOptions;
  body: (JSChildNode | IfStatement)[];
  helpers: Set<symbol>;
  onError: (error: Error) => void;
  helper<T extends symbol>(name: T): T;
  pushStringPart(part: TemplateLiteral["elements"][0]): void;
  pushStatement(statement: IfStatement | CallExpression): void;
}
```

### pushStringPart

Adds a string part to the buffer. Consecutive strings are automatically concatenated.

```ts
pushStringPart(part) {
  if (!currentString) {
    const currentCall = createCallExpression(`_push`);
    body.push(currentCall);
    currentString = createTemplateLiteral([]);
    currentCall.arguments.push(currentString);
  }
  const bufferedElements = currentString.elements;
  const lastItem = bufferedElements[bufferedElements.length - 1];
  if (isString(part) && isString(lastItem)) {
    // Concatenate consecutive strings
    bufferedElements[bufferedElements.length - 1] += part;
  } else {
    bufferedElements.push(part);
  }
}
```

### pushStatement

Adds control flow statements (if/for) to the buffer.

```ts
pushStatement(statement) {
  // Close current string buffer
  currentString = null;
  body.push(statement);
}
```

## Element Transformation

### ssrTransformElement

Transforms HTML elements into SSR code.

```ts
// packages/compiler-ssr/src/transforms/ssrTransformElement.ts
export const ssrTransformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT) {
    return;
  }

  return function ssrPostTransformElement() {
    const openTag: TemplateLiteral["elements"] = [`<${node.tag}`];

    // Process attributes
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        openTag.push(` ${prop.name}="${escapeHtml(prop.value.content)}"`);
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        // Handle v-bind
        if (prop.name === "bind" && prop.arg && prop.exp) {
          // Process class, style, and other attributes
        }
      }
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag);
  };
};
```

#### Attribute Binding

- **Static attributes**: Output directly as strings
- **v-bind:class**: Use `ssrRenderClass` helper
- **v-bind:style**: Use `ssrRenderStyle` helper
- **Other dynamic attributes**: Use `ssrRenderAttr` or `ssrRenderDynamicAttr`

### ssrProcessElement

Processes transformed elements to generate code.

```ts
export function ssrProcessElement(node: PlainElementNode, context: SSRTransformContext): void {
  // Output opening tag
  for (const element of node.ssrCodegenNode!.elements) {
    context.pushStringPart(element);
  }
  context.pushStringPart(`>`);

  // Handle v-html
  const vHtml = node.props.find(p => p.type === NodeTypes.DIRECTIVE && p.name === "html");
  if (vHtml && vHtml.exp) {
    context.pushStringPart(vHtml.exp);
  } else if (node.children.length) {
    processChildren(node, context);
  }

  // Closing tag (except void elements)
  if (!isVoidTag(node.tag)) {
    context.pushStringPart(`</${node.tag}>`);
  }
}
```

## Component Transformation

Components are rendered at runtime through `ssrRenderComponent`.

```ts
// packages/compiler-ssr/src/transforms/ssrTransformComponent.ts
export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext,
  parent: { children: any[] },
): void {
  const vnodeCall = createCallExpression(context.helper(SSR_RENDER_VNODE), [
    `_push`,
    createCallExpression(context.helper(SSR_RENDER_COMPONENT), [
      createSimpleExpression(`_component_${node.tag}`, false),
      // props
      node.props.length ? /* props object */ : createSimpleExpression(`null`, false),
      // slots
      createSimpleExpression(`null`, false),
      // parent component
      `_parent`,
    ]),
    `_parent`,
  ]);

  context.pushStatement(vnodeCall);
}
```

## v-if Transformation

v-if is transformed into JavaScript if statements.

```ts
// packages/compiler-ssr/src/transforms/ssrVIf.ts
export function ssrProcessIf(node: IfNode, context: SSRTransformContext): void {
  const [rootBranch] = node.branches;
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context),
  );
  context.pushStatement(ifStatement);

  let currentIf = ifStatement;
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i];
    const branchBlockStatement = processIfBranch(branch, context);
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(branch.condition, branchBlockStatement);
    } else {
      // else
      currentIf.alternate = branchBlockStatement;
    }
  }

  // Output empty comment if no else
  if (!currentIf.alternate) {
    currentIf.alternate = createBlockStatement([createCallExpression(`_push`, ["`<!---->`"])]);
  }
}
```

Input:
```html
<div v-if="show">Visible</div>
<div v-else>Hidden</div>
```

Output:
```js
if (show) {
  _push(`<div>Visible</div>`)
} else {
  _push(`<div>Hidden</div>`)
}
```

## v-for Transformation

v-for is transformed using the `ssrRenderList` helper.

```ts
// packages/compiler-ssr/src/transforms/ssrVFor.ts
export function ssrProcessFor(node: ForNode, context: SSRTransformContext): void {
  const renderLoop = createFunctionExpression(createForLoopParams(node.parseResult));
  renderLoop.body = processChildrenAsStatement(node, context);

  // Fragment markers
  context.pushStringPart(`<!--[-->`);
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [node.source, renderLoop]),
  );
  context.pushStringPart(`<!--]-->`);
}
```

Input:
```html
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

Output:
```js
_push(`<!--[-->`)
_ssrRenderList(items, (item) => {
  _push(`<div>${_ssrInterpolate(item.name)}</div>`)
})
_push(`<!--]-->`)
```

## SSR Helpers

The SSR compiler uses the following runtime helpers, provided by `@chibivue/server-renderer`.

```ts
// packages/compiler-ssr/src/runtimeHelpers.ts
export const SSR_INTERPOLATE: unique symbol = Symbol(`ssrInterpolate`);
export const SSR_RENDER_ATTRS: unique symbol = Symbol(`ssrRenderAttrs`);
export const SSR_RENDER_ATTR: unique symbol = Symbol(`ssrRenderAttr`);
export const SSR_RENDER_CLASS: unique symbol = Symbol(`ssrRenderClass`);
export const SSR_RENDER_STYLE: unique symbol = Symbol(`ssrRenderStyle`);
export const SSR_RENDER_DYNAMIC_ATTR: unique symbol = Symbol(`ssrRenderDynamicAttr`);
export const SSR_RENDER_LIST: unique symbol = Symbol(`ssrRenderList`);
export const SSR_INCLUDE_BOOLEAN_ATTR: unique symbol = Symbol(`ssrIncludeBooleanAttr`);
export const SSR_RENDER_COMPONENT: unique symbol = Symbol(`ssrRenderComponent`);
export const SSR_RENDER_VNODE: unique symbol = Symbol(`ssrRenderVNode`);
```

### Helper Roles

| Helper | Role |
|--------|------|
| `ssrInterpolate` | Escape text interpolation |
| `ssrRenderAttrs` | Render object-format attributes |
| `ssrRenderClass` | Render class |
| `ssrRenderStyle` | Render style |
| `ssrRenderList` | v-for iteration |
| `ssrRenderComponent` | Create component VNode |
| `ssrRenderVNode` | Convert VNode to HTML string |

## SFC Integration

compiler-sfc supports compilation in SSR mode.

```ts
// packages/compiler-sfc/src/compileTemplate.ts
export function compileTemplate({
  source,
  compiler,
  compilerOptions,
  id,
  scoped,
  ssr = false,
}: SFCTemplateCompileOptions): SFCTemplateCompileResults {
  const defaultCompiler = ssr
    ? (CompilerSSR as TemplateCompiler)
    : CompilerDOM;

  let { code, ast, preamble } = (compiler || defaultCompiler).compile(source, {
    ...compilerOptions,
    ssr,
  });
  return { code, ast, source, preamble };
}
```

Specifying `ssr: true` automatically uses the SSR compiler.

## Generated Code Example

Input template:
```html
<div class="container">
  <h1>{{ title }}</h1>
  <ul>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>
  </ul>
</div>
```

Generated code:
```js
import { ssrInterpolate as _ssrInterpolate, ssrRenderList as _ssrRenderList } from 'chibivue/server-renderer'

function ssrRender(_ctx, _push, _parent, _attrs) {
  _push(`<div class="container"><h1>${_ssrInterpolate(_ctx.title)}</h1><ul><!--[-->`)
  _ssrRenderList(_ctx.items, (item) => {
    _push(`<li>${_ssrInterpolate(item.name)}</li>`)
  })
  _push(`<!--]--></ul></div>`)
}
```

<KawaikoNote variant="surprise" title="SSR Compiler Benefits">

Using the SSR compiler provides:
- No VNode overhead
- Efficient string generation with template literals
- Static parts are output directly as strings

These improve server-side rendering performance!

</KawaikoNote>
