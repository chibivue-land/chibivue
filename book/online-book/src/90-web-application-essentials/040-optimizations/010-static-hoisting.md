# Static Hoisting

## What is Static Hoisting

Static Hoisting is one of the optimization techniques during template compilation. It detects static nodes (nodes without reactive dependencies) in the template and "hoists" them outside the render function, improving performance during re-rendering.

<KawaikoNote variant="question" title="Why is it called hoisting?">

It's the same concept as JavaScript's "variable hoisting".
By "lifting" static code from inside the render function to outside,
we no longer need to regenerate it every time the function is called!

</KawaikoNote>

### Effects of Optimization

1. **Skip VNode Generation**: Static nodes are generated only once and reused
2. **Reduced Memory Usage**: The same VNode objects are reused
3. **Skip Patch Processing**: Static nodes can be excluded from comparison

## Comparison Before and After Optimization

### Template

```vue
<template>
  <div>
    <h1>Hello World</h1>
    <p>{{ message }}</p>
  </div>
</template>
```

### Compilation Result Without Optimization

```js
function render() {
  return h('div', null, [
    h('h1', null, 'Hello World'),  // Generated every time
    h('p', null, message.value)
  ])
}
```

### After Applying Static Hoisting

```js
const _hoisted_1 = h('h1', null, 'Hello World')  // Generated once outside

function render() {
  return h('div', null, [
    _hoisted_1,  // Reference is reused
    h('p', null, message.value)
  ])
}
```

<KawaikoNote variant="funny" title="Dramatic Before and After!">

Instead of generating VNodes every time, we just reuse the VNode generated once.
The more unchanging parts like headers and footers there are, the greater the effect!

</KawaikoNote>

## Implementation Overview

### ConstantTypes

An enum representing the static nature of nodes.

```ts
export const enum ConstantTypes {
  NOT_CONSTANT = 0,    // Dynamic (cannot be hoisted)
  CAN_SKIP_PATCH = 1,  // Can skip patch processing
  CAN_HOIST = 2,       // Can be hoisted
  CAN_STRINGIFY = 3,   // Can be stringified (further optimization possible)
}
```

### hoistStatic Function

Called after the transform phase to detect and hoist static nodes.

```ts
export function hoistStatic(root: RootNode, context: TransformContext): void {
  walk(root, context, new Map());
}
```

### walk Function

Recursively traverses the AST and detects nodes that can be hoisted.

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
      child.tagType === 0 // Only plain elements
    ) {
      const constantType = getConstantType(child, context, resultCache);
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_HOIST) {
          // Can be hoisted
          const codegenNode = child.codegenNode as VNodeCall | undefined;
          if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
            codegenNode.isStatic = true;
            context.hoists.push(codegenNode);
            // Replace codegenNode with hoisted reference
            child.codegenNode = context.hoist(codegenNode) as VNodeCall;
          }
        }
      } else {
        // If dynamic, recursively check children
        walk(child, context, resultCache);
      }
    }
  }
}
```

Key points:
1. Only plain elements (not components) are targeted
2. Static nodes are added to `context.hoists`
3. The original `codegenNode` is replaced with a reference to `_hoisted_N`
4. Dynamic nodes have their children recursively checked

### getConstantType Function

Determines whether a node is static.

```ts
export function getConstantType(
  node: TemplateChildNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, ConstantTypes>,
): ConstantTypes {
  // Check cache
  const cached = resultCache.get(node);
  if (cached !== undefined) {
    return cached;
  }

  if (node.type === NodeTypes.ELEMENT) {
    // Components cannot be hoisted
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

    // Check for dynamic props
    if (codegenNode.props) {
      const propsType = codegenNode.props.type;
      if (propsType !== NodeTypes.JS_OBJECT_EXPRESSION) {
        resultCache.set(node, ConstantTypes.NOT_CONSTANT);
        return ConstantTypes.NOT_CONSTANT;
      }

      const properties = codegenNode.props.properties;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        // Not possible if both key and value are not static
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

    // Recursively check child elements
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

    // Not possible if there are directives
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

  // Text nodes can be hoisted
  if (node.type === NodeTypes.TEXT) {
    resultCache.set(node, ConstantTypes.CAN_STRINGIFY);
    return ConstantTypes.CAN_STRINGIFY;
  }

  // Interpolations ({{ }}) are dynamic
  if (node.type === NodeTypes.INTERPOLATION) {
    resultCache.set(node, ConstantTypes.NOT_CONSTANT);
    return ConstantTypes.NOT_CONSTANT;
  }

  resultCache.set(node, ConstantTypes.NOT_CONSTANT);
  return ConstantTypes.NOT_CONSTANT;
}
```

Determination logic:
1. **Components**: Always dynamic (props and slots may change)
2. **Dynamic props**: Dynamic if there are bindings (`:class`, `:style`, etc.)
3. **Directives**: Dynamic if there are `v-if`, `v-for`, etc.
4. **Interpolation**: `{{ message }}` is dynamic
5. **Children**: If even one child is dynamic, the parent is also dynamic
6. **Static text/attributes**: Can be hoisted

### Code Generation

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

Nodes accumulated in the `hoists` array are generated as constants before the render function.

### TransformContext's hoist Method

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

Adds the original node to the `hoists` array and returns an identifier `_hoisted_N`. This is referenced within the render function.

## Examples of Hoistable Nodes

```vue
<template>
  <!-- Can be hoisted -->
  <div class="static">Static content</div>
  <img src="/logo.png" alt="Logo">
  <p>Fixed text</p>

  <!-- Cannot be hoisted -->
  <div :class="dynamicClass">Dynamic</div>
  <p>{{ message }}</p>
  <div v-if="show">Conditional</div>
  <MyComponent />
</template>
```

## Invocation in the Transform Phase

```ts
export function transform(root: RootNode, options: TransformOptions): void {
  const context = createTransformContext(root, options);
  traverseNode(root, context);

  // Execute if hoistStatic option is enabled
  if (options.hoistStatic) {
    hoistStatic(root, context);
  }

  createRootCodegen(root, context);
  root.components = [...context.components];
  root.helpers = new Set([...context.helpers.keys()]);
  root.hoists = context.hoists;
}
```

## Options

```ts
export interface TransformOptions {
  hoistStatic?: boolean;  // Enable static hoisting
  // ...
}
```

## Generated Code Example

Input template:
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

Generated code:
```js
import { createVNode as _createVNode, toDisplayString as _toDisplayString } from 'vue'

// Static nodes are hoisted outside
const _hoisted_1 = _createVNode("header", null, [
  _createVNode("h1", null, "My App"),
  _createVNode("nav", null, [
    _createVNode("a", { href: "/home" }, "Home"),
    _createVNode("a", { href: "/about" }, "About")
  ])
])

function render(_ctx) {
  return _createVNode("div", null, [
    _hoisted_1,  // Reference is reused
    _createVNode("main", null, [
      _createVNode("p", null, _toDisplayString(_ctx.content))  // Dynamic part
    ])
  ])
}
```

## Summary

The Static Hoisting implementation consists of the following elements:

1. **ConstantTypes**: An enum representing the static level of nodes
2. **getConstantType**: Determines whether a node is static
3. **walk**: Traverses the AST and detects hoistable nodes
4. **hoist**: Adds nodes to the hoist array and returns a reference
5. **genHoists**: Generates code for hoisted nodes

This optimization significantly improves re-rendering performance for large templates with many static contents. It is particularly effective for unchanged UI parts such as headers, footers, and sidebars.

<KawaikoNote variant="surprise" title="Static Hoisting Complete!">

The compiler automatically optimizes by determining "this part won't change".
This is a strength unique to template-based frameworks!

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/040_static_hoisting)
