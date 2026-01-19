# Static Hoisting（靜態提升）

## 什麼是 Static Hoisting

Static Hoisting 是模板編譯時的最佳化技術之一．它偵測模板中的靜態節點（沒有響應式依賴的節點），並將它們「提升」（hoist）到渲染函數外部，從而提高重新渲染時的效能．

<KawaikoNote variant="question" title="為什麼叫提升（hoist）？">

這與 JavaScript 的「變數提升（hoisting）」是相同的概念．
透過將渲染函數內的靜態程式碼「提升」到函數外部，
每次呼叫函數時就不需要重新生成了！

</KawaikoNote>

### 最佳化效果

1. **跳過 VNode 生成**：靜態節點只生成一次，之後重複使用
2. **減少記憶體使用**：重複使用相同的 VNode 物件
3. **跳過 patch 處理**：靜態節點可以從比較對象中排除

## 最佳化前後對比

### 模板

```vue
<template>
  <div>
    <h1>Hello World</h1>
    <p>{{ message }}</p>
  </div>
</template>
```

### 無最佳化的編譯結果

```js
function render() {
  return h('div', null, [
    h('h1', null, 'Hello World'),  // 每次都生成
    h('p', null, message.value)
  ])
}
```

### 套用 Static Hoisting 後

```js
const _hoisted_1 = h('h1', null, 'Hello World')  // 在外部只生成一次

function render() {
  return h('div', null, [
    _hoisted_1,  // 重複使用參照
    h('p', null, message.value)
  ])
}
```

<KawaikoNote variant="funny" title="戲劇性的前後對比！">

從每次都生成 VNode 變成只重複使用一次生成的 VNode．
像頁首頁尾這樣不變的部分越多，效果就越顯著！

</KawaikoNote>

## 實作概要

### ConstantTypes

表示節點靜態性的列舉型別．

```ts
export const enum ConstantTypes {
  NOT_CONSTANT = 0,    // 動態（不可提升）
  CAN_SKIP_PATCH = 1,  // 可跳過 patch 處理
  CAN_HOIST = 2,       // 可提升
  CAN_STRINGIFY = 3,   // 可字串化（可進一步最佳化）
}
```

### hoistStatic 函數

在轉換階段之後呼叫，偵測並提升靜態節點．

```ts
export function hoistStatic(root: RootNode, context: TransformContext): void {
  walk(root, context, new Map());
}
```

### walk 函數

遞迴遍歷 AST，偵測可提升的節點．

```ts
function walk(
  node: RootNode | TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): void {
  const { children } = node as RootNode | ElementNode;
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === 0 // 僅針對普通元素
    ) {
      const constantType = getConstantType(child, context, resultCache);
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          // 可提升
          const codegenNode = child.codegenNode as VNodeCall | undefined;
          if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.isStatic = true;
            context.hoists.push(codegenNode);
            // 將 codegenNode 替換為提升參照
            child.codegenNode = context.hoist(codegenNode) as VNodeCall;
          }
        }
      } else {
        // 如果是動態的，遞迴檢查子節點
        walk(child, context, resultCache);
      }
    }
  }
}
```

要點：
1. 僅針對普通元素（非元件）
2. 靜態節點新增到 `context.hoists`
3. 將原始 `codegenNode` 替換為 `_hoisted_N` 的參照
4. 動態節點遞迴檢查子節點

### getConstantType 函數

判斷節點是否為靜態．

```ts
export function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): ConstantTypes {
  // 檢查快取
  const cached = resultCache.get(node);
  if (cached !== undefined) {
    return cached;
  }

  if (node.type === NodeTypes.ELEMENT) {
    // 元件不可提升
    if (node.tagType !== 0) {
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    const element = node as PlainElementNode;
    const codegenNode = element.codegenNode;

    if (!codegenNode || codegenNode.type !== NodeTypes.VNODE_CALL) {
      resultCache.set(node, ConstantTypes.NOT_CONSTANT);
      return ConstantTypes.NOT_CONSTANT;
    }

    // 檢查是否有動態 props
    if (codegenNode.props) {
      const propsType = codegenNode.props.type;
      if (propsType !== NodeTypes.JS_OBJECT_EXPRESSION) {
        resultCache.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }

      const properties = codegenNode.props.properties;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        // 如果鍵和值都不是靜態的則不可
        if (key.type !== NodeTypes.SIMPLE_EXPRESSION || !key.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
        if (value.type !== NodeTypes.SIMPLE_EXPRESSION || !value.isStatic) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // 遞迴檢查子元素
    if (element.children) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const childType = getConstantType(child, context, resultCache);
        if (childType === ConstantTypes.NOT_CONSTANT) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    // 如果有指令則不可
    if (element.props && element.props.length > 0) {
      for (const prop of element.props) {
        if (prop.type === NodeTypes.DIRECTIVE) {
          resultCache.set(node, ConstantTypes.NOT_CONSTANT);
          return ConstantTypes.NOT_CONSTANT;
        }
      }
    }

    resultCache.set(node, ConstantTypes.CAN_HOIST);
    return ConstantTypes.CAN_HOIST;
  }

  // 文字節點可提升
  if (node.type === NodeTypes.TEXT) {
    resultCache.set(node, ConstantTypes.CAN_STRINGIFY);
    return ConstantTypes.CAN_STRINGIFY;
  }

  // 插值（{{ }}）是動態的
  if (node.type === NodeTypes.INTERPOLATION) {
    resultCache.set(node, ConstantTypes.NOT_CONSTANT);
    return ConstantTypes.NOT_CONSTANT;
  }

  resultCache.set(node, ConstantTypes.NOT_CONSTANT);
  return ConstantTypes.NOT_CONSTANT;
}
```

判斷邏輯：
1. **元件**：始終是動態的（props 和 slots 可能會變化）
2. **動態 props**：如果有綁定（`:class`，`:style` 等）則是動態的
3. **指令**：如果有 `v-if`，`v-for` 等則是動態的
4. **插值表達式**：`{{ message }}` 是動態的
5. **子元素**：只要有一個子元素是動態的，父元素也是動態的
6. **靜態文字/屬性**：可提升

### 程式碼生成

```ts
function genHoists(
  hoists: (TemplateChildNode | ExpressionNode)[],
  context: CodegenContext
) {
  const { push, newline } = context;
  for (let i = 0; i < hoists.length; i++) {
    const exp = hoists[i];
    if (exp) {
      push(`const _hoisted_${i + 1} = `);
      genNode(exp, context);
      newline();
    }
  }
}
```

將累積在 `hoists` 陣列中的節點作為常數生成在渲染函數之前．

### TransformContext 的 hoist 方法

```ts
hoist(exp) {
  context.hoists.push(exp);
  const identifier = createSimpleExpression(
    `_hoisted_${context.hoists.length}`,
    false,
  );
  return identifier;
}
```

將原始節點新增到 `hoists` 陣列，並回傳 `_hoisted_N` 識別符．這在渲染函數內被參照．

## 可提升的範例

```vue
<template>
  <!-- 可提升 -->
  <div class="static">Static content</div>
  <img src="/logo.png" alt="Logo">
  <p>Fixed text</p>

  <!-- 不可提升 -->
  <div :class="dynamicClass">Dynamic</div>
  <p>{{ message }}</p>
  <div v-if="show">Conditional</div>
  <MyComponent />
</template>
```

## 在 transform 階段的呼叫

```ts
export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options);
  traverseNode(root, context);

  // 如果啟用了 hoistStatic 選項則執行
  if (options.hoistStatic) {
    hoistStatic(root, context);
  }

  createRootCodegen(root, context);
  root.components = [...context.components];
  root.helpers = new Set([...context.helpers.keys()]);
  root.hoists = context.hoists;
}
```

## 選項

```ts
export interface TransformOptions {
  hoistStatic?: boolean;  // 啟用靜態提升
  // ...
}
```

## 生成程式碼範例

輸入模板：
```vue
<template>
  <div>
    <header>
      <h1>My App</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <p>{{ content }}</p>
    </main>
  </div>
</template>
```

生成的程式碼：
```js
import { createVNode as _createVNode, toDisplayString as _toDisplayString } from 'vue'

// 靜態節點提升到外部
const _hoisted_1 = _createVNode("header", null, [
  _createVNode("h1", null, "My App"),
  _createVNode("nav", null, [
    _createVNode("a", { href: "/home" }, "Home"),
    _createVNode("a", { href: "/about" }, "About")
  ])
])

function render(_ctx) {
  return _createVNode("div", null, [
    _hoisted_1,  // 重複使用參照
    _createVNode("main", null, [
      _createVNode("p", null, _toDisplayString(_ctx.content))  // 動態部分
    ])
  ])
}
```

## 總結

Static Hoisting 的實作由以下元素組成：

1. **ConstantTypes**：表示節點靜態級別的列舉型別
2. **getConstantType**：判斷節點是否為靜態
3. **walk**：遍歷 AST 偵測可提升的節點
4. **hoist**：將節點新增到提升陣列並回傳參照
5. **genHoists**：為提升的節點生成程式碼

這種最佳化在具有大量靜態內容的大型模板中顯著提高重新渲染效能．特別是對於頁首，頁尾，側邊欄等不變的 UI 部分效果顯著．

<KawaikoNote variant="surprise" title="Static Hoisting 完成！">

編譯器自動判斷「這部分不會變化」並進行最佳化．
這是基於模板的框架獨有的優勢！

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/040_static_hoisting)
