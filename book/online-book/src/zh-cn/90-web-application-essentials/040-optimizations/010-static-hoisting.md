# Static Hoisting（静态提升）

## 什么是 Static Hoisting

Static Hoisting 是模板编译时的优化技术之一．它检测模板中的静态节点（没有响应式依赖的节点），并将它们"提升"（hoist）到渲染函数外部，从而提高重新渲染时的性能．

<KawaikoNote variant="question" title="为什么叫提升（hoist）？">

这与 JavaScript 的"变量提升（hoisting）"是相同的概念．
通过将渲染函数内的静态代码"提升"到函数外部，
每次调用函数时就不需要重新生成了！

</KawaikoNote>

### 优化效果

1. **跳过 VNode 生成**：静态节点只生成一次，之后重复使用
2. **减少内存使用**：重复使用相同的 VNode 对象
3. **跳过 patch 处理**：静态节点可以从比较对象中排除

## 优化前后对比

### 模板

```vue
<template>
  <div>
    <h1>Hello World</h1>
    <p>{{ message }}</p>
  </div>
</template>
```

### 无优化的编译结果

```js
function render() {
  return h('div', null, [
    h('h1', null, 'Hello World'),  // 每次都生成
    h('p', null, message.value)
  ])
}
```

### 应用 Static Hoisting 后

```js
const _hoisted_1 = h('h1', null, 'Hello World')  // 在外部只生成一次

function render() {
  return h('div', null, [
    _hoisted_1,  // 重复使用引用
    h('p', null, message.value)
  ])
}
```

<KawaikoNote variant="funny" title="戏剧性的前后对比！">

从每次都生成 VNode 变成只重复使用一次生成的 VNode．
像页眉页脚这样不变的部分越多，效果就越显著！

</KawaikoNote>

## 实现概要

### ConstantTypes

表示节点静态性的枚举类型．

```ts
export const enum ConstantTypes {
  NOT_CONSTANT = 0,    // 动态（不可提升）
  CAN_SKIP_PATCH = 1,  // 可跳过 patch 处理
  CAN_HOIST = 2,       // 可提升
  CAN_STRINGIFY = 3,   // 可字符串化（可进一步优化）
}
```

### hoistStatic 函数

在变换阶段之后调用，检测并提升静态节点．

```ts
export function hoistStatic(root: RootNode, context: TransformContext): void {
  walk(root, context, new Map());
}
```

### walk 函数

递归遍历 AST，检测可提升的节点．

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
      child.tagType === 0 // 仅针对普通元素
    ) {
      const constantType = getConstantType(child, context, resultCache);
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          // 可提升
          const codegenNode = child.codegenNode as VNodeCall | undefined;
          if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.isStatic = true;
            context.hoists.push(codegenNode);
            // 将 codegenNode 替换为提升引用
            child.codegenNode = context.hoist(codegenNode) as VNodeCall;
          }
        }
      } else {
        // 如果是动态的，递归检查子节点
        walk(child, context, resultCache);
      }
    }
  }
}
```

要点：
1. 仅针对普通元素（非组件）
2. 静态节点添加到 `context.hoists`
3. 将原始 `codegenNode` 替换为 `_hoisted_N` 的引用
4. 动态节点递归检查子节点

### getConstantType 函数

判断节点是否为静态．

```ts
export function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): ConstantTypes {
  // 检查缓存
  const cached = resultCache.get(node);
  if (cached !== undefined) {
    return cached;
  }

  if (node.type === NodeTypes.ELEMENT) {
    // 组件不可提升
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

    // 检查是否有动态 props
    if (codegenNode.props) {
      const propsType = codegenNode.props.type;
      if (propsType !== NodeTypes.JS_OBJECT_EXPRESSION) {
        resultCache.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }

      const properties = codegenNode.props.properties;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        // 如果键和值都不是静态的则不可
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

    // 递归检查子元素
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

    // 如果有指令则不可
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

  // 文本节点可提升
  if (node.type === NodeTypes.TEXT) {
    resultCache.set(node, ConstantTypes.CAN_STRINGIFY);
    return ConstantTypes.CAN_STRINGIFY;
  }

  // 插值（{{ }}）是动态的
  if (node.type === NodeTypes.INTERPOLATION) {
    resultCache.set(node, ConstantTypes.NOT_CONSTANT);
    return ConstantTypes.NOT_CONSTANT;
  }

  resultCache.set(node, ConstantTypes.NOT_CONSTANT);
  return ConstantTypes.NOT_CONSTANT;
}
```

判断逻辑：
1. **组件**：始终是动态的（props 和 slots 可能会变化）
2. **动态 props**：如果有绑定（`:class`，`:style` 等）则是动态的
3. **指令**：如果有 `v-if`，`v-for` 等则是动态的
4. **插值表达式**：`{{ message }}` 是动态的
5. **子元素**：只要有一个子元素是动态的，父元素也是动态的
6. **静态文本/属性**：可提升

### 代码生成

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

将累积在 `hoists` 数组中的节点作为常量生成在渲染函数之前．

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

将原始节点添加到 `hoists` 数组，并返回 `_hoisted_N` 标识符．这在渲染函数内被引用．

## 可提升的示例

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

## 在 transform 阶段的调用

```ts
export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options);
  traverseNode(root, context);

  // 如果启用了 hoistStatic 选项则执行
  if (options.hoistStatic) {
    hoistStatic(root, context);
  }

  createRootCodegen(root, context);
  root.components = [...context.components];
  root.helpers = new Set([...context.helpers.keys()]);
  root.hoists = context.hoists;
}
```

## 选项

```ts
export interface TransformOptions {
  hoistStatic?: boolean;  // 启用静态提升
  // ...
}
```

## 生成代码示例

输入模板：
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

生成的代码：
```js
import { createVNode as _createVNode, toDisplayString as _toDisplayString } from 'vue'

// 静态节点提升到外部
const _hoisted_1 = _createVNode("header", null, [
  _createVNode("h1", null, "My App"),
  _createVNode("nav", null, [
    _createVNode("a", { href: "/home" }, "Home"),
    _createVNode("a", { href: "/about" }, "About")
  ])
])

function render(_ctx) {
  return _createVNode("div", null, [
    _hoisted_1,  // 重复使用引用
    _createVNode("main", null, [
      _createVNode("p", null, _toDisplayString(_ctx.content))  // 动态部分
    ])
  ])
}
```

## 总结

Static Hoisting 的实现由以下元素组成：

1. **ConstantTypes**：表示节点静态级别的枚举类型
2. **getConstantType**：判断节点是否为静态
3. **walk**：遍历 AST 检测可提升的节点
4. **hoist**：将节点添加到提升数组并返回引用
5. **genHoists**：为提升的节点生成代码

这种优化在具有大量静态内容的大型模板中显著提高重新渲染性能．特别是对于页眉，页脚，侧边栏等不变的 UI 部分效果显著．

<KawaikoNote variant="surprise" title="Static Hoisting 完成！">

编译器自动判断"这部分不会变化"并进行优化．
这是基于模板的框架独有的优势！

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/040_static_hoisting)
