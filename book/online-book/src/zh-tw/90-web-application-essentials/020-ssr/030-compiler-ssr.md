# Compiler SSR

## 什麼是 SSR 編譯器？

SSR 編譯器（`@chibivue/compiler-ssr`）是一個將模板編譯為 SSR 優化代碼的套件．

普通的客戶端編譯會輸出生成 VNode 的代碼，而 SSR 編譯器直接輸出生成 HTML 字串的代碼．這提高了伺服器端的渲染效率．

<KawaikoNote variant="base" title="客戶端與 SSR 的區別">

在客戶端：
```js
// 返回 VNode
return _createElementVNode("div", { class: "hello" }, "Hello")
```

在 SSR 中：
```js
// 直接 push HTML 字串
_push(`<div class="hello">Hello</div>`)
```

SSR 不經過 VNode 直接生成字串，所以效率更高！

</KawaikoNote>

## 套件結構

```
packages/compiler-ssr/src/
├── index.ts                    # 主入口點
├── runtimeHelpers.ts           # SSR 輔助函數定義
├── ssrCodegenTransform.ts      # SSR 代碼生成轉換
└── transforms/
    ├── ssrTransformElement.ts   # 元素轉換
    ├── ssrTransformComponent.ts # 組件轉換
    ├── ssrVIf.ts               # v-if 轉換
    └── ssrVFor.ts              # v-for 轉換
```

## 編譯流程

SSR 編譯按以下步驟進行：

1. **解析**：將模板轉換為 AST（使用 `@chibivue/compiler-dom` 的 `parse`）
2. **轉換**：應用 SSR NodeTransform
3. **SSR Codegen Transform**：將 AST 轉換為 SSR 代碼生成節點
4. **代碼生成**：生成最終的 JavaScript 代碼

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

  // 將模板 AST 轉換為 SSR codegen AST
  ssrCodegenTransform(ast, options);

  return generate(ast, options);
}
```

## SSR Transform Context

SSR 轉換中使用的上下文．

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

將字串部分添加到緩衝區．連續的字串會自動合併．

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
    // 合併連續的字串
    bufferedElements[bufferedElements.length - 1] += part;
  } else {
    bufferedElements.push(part);
  }
}
```

### pushStatement

將控制流語句（if/for）添加到緩衝區．

```ts
pushStatement(statement) {
  // 關閉當前字串緩衝區
  currentString = null;
  body.push(statement);
}
```

## 元素轉換

### ssrTransformElement

將 HTML 元素轉換為 SSR 代碼．

```ts
// packages/compiler-ssr/src/transforms/ssrTransformElement.ts
export const ssrTransformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.ELEMENT) {
    return;
  }

  return function ssrPostTransformElement() {
    const openTag: TemplateLiteral["elements"] = [`<${node.tag}`];

    // 處理屬性
    for (const prop of node.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        openTag.push(` ${prop.name}="${escapeHtml(prop.value.content)}"`);
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        // 處理 v-bind
        if (prop.name === "bind" && prop.arg && prop.exp) {
          // 處理 class、style 和其他屬性
        }
      }
    }

    node.ssrCodegenNode = createTemplateLiteral(openTag);
  };
};
```

#### 屬性綁定

- **靜態屬性**：直接作為字串輸出
- **v-bind:class**：使用 `ssrRenderClass` 輔助函數
- **v-bind:style**：使用 `ssrRenderStyle` 輔助函數
- **其他動態屬性**：使用 `ssrRenderAttr` 或 `ssrRenderDynamicAttr`

### ssrProcessElement

處理轉換後的元素以生成代碼．

```ts
export function ssrProcessElement(node: PlainElementNode, context: SSRTransformContext): void {
  // 輸出開始標籤
  for (const element of node.ssrCodegenNode!.elements) {
    context.pushStringPart(element);
  }
  context.pushStringPart(`>`);

  // 處理 v-html
  const vHtml = node.props.find(p => p.type === NodeTypes.DIRECTIVE && p.name === "html");
  if (vHtml && vHtml.exp) {
    context.pushStringPart(vHtml.exp);
  } else if (node.children.length) {
    processChildren(node, context);
  }

  // 結束標籤（void 元素除外）
  if (!isVoidTag(node.tag)) {
    context.pushStringPart(`</${node.tag}>`);
  }
}
```

## 組件轉換

組件通過 `ssrRenderComponent` 在運行時渲染．

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

## v-if 轉換

v-if 被轉換為 JavaScript if 語句．

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

  // 如果沒有 else，輸出空註釋
  if (!currentIf.alternate) {
    currentIf.alternate = createBlockStatement([createCallExpression(`_push`, ["`<!---->`"])]);
  }
}
```

輸入：
```html
<div v-if="show">Visible</div>
<div v-else>Hidden</div>
```

輸出：
```js
if (show) {
  _push(`<div>Visible</div>`)
} else {
  _push(`<div>Hidden</div>`)
}
```

## v-for 轉換

v-for 使用 `ssrRenderList` 輔助函數進行轉換．

```ts
// packages/compiler-ssr/src/transforms/ssrVFor.ts
export function ssrProcessFor(node: ForNode, context: SSRTransformContext): void {
  const renderLoop = createFunctionExpression(createForLoopParams(node.parseResult));
  renderLoop.body = processChildrenAsStatement(node, context);

  // Fragment 標記
  context.pushStringPart(`<!--[-->`);
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [node.source, renderLoop]),
  );
  context.pushStringPart(`<!--]-->`);
}
```

輸入：
```html
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

輸出：
```js
_push(`<!--[-->`)
_ssrRenderList(items, (item) => {
  _push(`<div>${_ssrInterpolate(item.name)}</div>`)
})
_push(`<!--]-->`)
```

## SSR 輔助函數

SSR 編譯器使用以下運行時輔助函數，由 `@chibivue/server-renderer` 提供．

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

### 輔助函數的作用

| 輔助函數 | 作用 |
|---------|------|
| `ssrInterpolate` | 轉義文本插值 |
| `ssrRenderAttrs` | 渲染物件格式的屬性 |
| `ssrRenderClass` | 渲染 class |
| `ssrRenderStyle` | 渲染 style |
| `ssrRenderList` | v-for 迭代 |
| `ssrRenderComponent` | 創建組件 VNode |
| `ssrRenderVNode` | 將 VNode 轉換為 HTML 字串 |

## SFC 整合

compiler-sfc 支援 SSR 模式的編譯．

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

指定 `ssr: true` 會自動使用 SSR 編譯器．

## 生成的代碼示例

輸入模板：
```html
<div class="container">
  <h1>{{ title }}</h1>
  <ul>
    <li v-for="item in items" :key="item.id">{{ item.name }}</li>
  </ul>
</div>
```

生成的代碼：
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

<KawaikoNote variant="surprise" title="SSR 編譯器的優點">

使用 SSR 編譯器可以：
- 沒有 VNode 開銷
- 使用模板字面量高效生成字串
- 靜態部分直接作為字串輸出

這些提高了伺服器端渲染的效能！

</KawaikoNote>
