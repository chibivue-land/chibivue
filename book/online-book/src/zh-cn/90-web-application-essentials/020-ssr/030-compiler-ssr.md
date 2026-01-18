# Compiler SSR

## 什么是 SSR 编译器？

SSR 编译器（`@chibivue/compiler-ssr`）是一个将模板编译为 SSR 优化代码的包．

普通的客户端编译会输出生成 VNode 的代码，而 SSR 编译器直接输出生成 HTML 字符串的代码．这提高了服务器端的渲染效率．

<KawaikoNote variant="base" title="客户端与 SSR 的区别">

在客户端：
```js
// 返回 VNode
return _createElementVNode("div", { class: "hello" }, "Hello")
```

在 SSR 中：
```js
// 直接 push HTML 字符串
_push(`<div class="hello">Hello</div>`)
```

SSR 不经过 VNode 直接生成字符串，所以效率更高！

</KawaikoNote>

## 包结构

```
packages/compiler-ssr/src/
├── index.ts                    # 主入口点
├── runtimeHelpers.ts           # SSR 辅助函数定义
├── ssrCodegenTransform.ts      # SSR 代码生成转换
└── transforms/
    ├── ssrTransformElement.ts   # 元素转换
    ├── ssrTransformComponent.ts # 组件转换
    ├── ssrVIf.ts               # v-if 转换
    └── ssrVFor.ts              # v-for 转换
```

## 编译流程

SSR 编译按以下步骤进行：

1. **解析**：将模板转换为 AST（使用 `@chibivue/compiler-dom` 的 `parse`）
2. **转换**：应用 SSR NodeTransform
3. **SSR Codegen Transform**：将 AST 转换为 SSR 代码生成节点
4. **代码生成**：生成最终的 JavaScript 代码

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

  // 将模板 AST 转换为 SSR codegen AST
  ssrCodegenTransform(ast, options);

  return generate(ast, options);
}
```

## SSR Transform Context

SSR 转换中使用的上下文．

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

将字符串部分添加到缓冲区．连续的字符串会自动合并．

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
    // 合并连续的字符串
    bufferedElements[bufferedElements.length - 1] += part;
  } else {
    bufferedElements.push(part);
  }
}
```

### pushStatement

将控制流语句（if/for）添加到缓冲区．

```ts
pushStatement(statement) {
  // 关闭当前字符串缓冲区
  currentString = null;
  body.push(statement);
}
```

## 元素转换

### ssrTransformElement

将 HTML 元素转换为 SSR 代码．

```ts
// packages/compiler-ssr/src/transforms/ssrTransformElement.ts
export const ssrTransformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT) {
    return;
  }

  return function ssrPostTransformElement() {
    const openTag: TemplateLiteral["elements"] = [`<${node.tag}`];

    // 处理属性
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        openTag.push(` ${prop.name}="${escapeHtml(prop.value.content)}"`);
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        // 处理 v-bind
        if (prop.name === "bind" && prop.arg && prop.exp) {
          // 处理 class、style 和其他属性
        }
      }
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag);
  };
};
```

#### 属性绑定

- **静态属性**：直接作为字符串输出
- **v-bind:class**：使用 `ssrRenderClass` 辅助函数
- **v-bind:style**：使用 `ssrRenderStyle` 辅助函数
- **其他动态属性**：使用 `ssrRenderAttr` 或 `ssrRenderDynamicAttr`

## v-if 转换

v-if 被转换为 JavaScript if 语句．

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

  // 如果没有 else，输出空注释
  if (!currentIf.alternate) {
    currentIf.alternate = createBlockStatement([createCallExpression(`_push`, ["`<!---->`"])]);
  }
}
```

输入：
```html
<div v-if="show">Visible</div>
<div v-else>Hidden</div>
```

输出：
```js
if (show) {
  _push(`<div>Visible</div>`)
} else {
  _push(`<div>Hidden</div>`)
}
```

## v-for 转换

v-for 使用 `ssrRenderList` 辅助函数进行转换．

```ts
// packages/compiler-ssr/src/transforms/ssrVFor.ts
export function ssrProcessFor(node: ForNode, context: SSRTransformContext): void {
  const renderLoop = createFunctionExpression(createForLoopParams(node.parseResult));
  renderLoop.body = processChildrenAsStatement(node, context);

  // Fragment 标记
  context.pushStringPart(`<!--[-->`);
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [node.source, renderLoop]),
  );
  context.pushStringPart(`<!--]-->`);
}
```

输入：
```html
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

输出：
```js
_push(`<!--[-->`)
_ssrRenderList(items, (item) => {
  _push(`<div>${_ssrInterpolate(item.name)}</div>`)
})
_push(`<!--]-->`)
```

## SSR 辅助函数

SSR 编译器使用以下运行时辅助函数，由 `@chibivue/server-renderer` 提供．

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

### 辅助函数的作用

| 辅助函数 | 作用 |
|---------|------|
| `ssrInterpolate` | 转义文本插值 |
| `ssrRenderAttrs` | 渲染对象格式的属性 |
| `ssrRenderClass` | 渲染 class |
| `ssrRenderStyle` | 渲染 style |
| `ssrRenderList` | v-for 迭代 |
| `ssrRenderComponent` | 创建组件 VNode |
| `ssrRenderVNode` | 将 VNode 转换为 HTML 字符串 |

## SFC 集成

compiler-sfc 支持 SSR 模式的编译．

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

指定 `ssr: true` 会自动使用 SSR 编译器．

## 生成的代码示例

输入模板：
```html
<div class="container">
  <h1>{{ title }}</h1>
  <ul>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>
  </ul>
</div>
```

生成的代码：
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

<KawaikoNote variant="surprise" title="SSR 编译器的优点">

使用 SSR 编译器可以：
- 没有 VNode 开销
- 使用模板字面量高效生成字符串
- 静态部分直接作为字符串输出

这些提高了服务器端渲染的性能！

</KawaikoNote>
