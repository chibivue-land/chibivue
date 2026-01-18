# Tree Flattening (Block Tree)

## What is Tree Flattening?

Tree Flattening (Block Tree) is an advanced optimization technique introduced in Vue 3. It "flattens" and collects dynamic nodes within templates, allowing direct updates to only dynamic nodes instead of traversing the entire tree during updates.

<KawaikoNote variant="question" title="Why 'flattening'?">

Traditional Virtual DOM required recursive traversal of the entire tree during updates.
Tree Flattening "flattens" only dynamic nodes into an array,
allowing direct access while ignoring nested structures.

</KawaikoNote>

## Problems with Traditional Diff Algorithms

### Template Example

```vue
<template>
  <div>
    <header>
      <h1>Static Title</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <p>{{ dynamicText }}</p>  <!-- The only dynamic part -->
    </main>
    <footer>
      <p>Copyright 2024</p>
    </footer>
  </div>
</template>
```

### Traditional Approach

```
Traverse entire tree:
div
├── header (static)
│   ├── h1 (static)
│   └── nav (static)
│       ├── a (static)
│       └── a (static)
├── main
│   └── p (dynamic) ← Only this actually needs updating
└── footer (static)
    └── p (static)

→ Traverse 9 nodes to update 1
```

### Tree Flattening Approach

```
Collect only dynamic nodes:
dynamicChildren = [p]

→ Directly update 1 node
```

<KawaikoNote variant="funny" title="Dramatic efficiency improvement!">

If only 10 out of 1000 nodes are dynamic:
Traditional approach requires 1000 comparisons,
but Tree Flattening needs only 10 comparisons.

</KawaikoNote>

## The Block Concept

### What is a Block?

A Block is "a VNode subtree with stable structure." Within a Block, the following is guaranteed:

1. The number of child nodes doesn't change
2. The order of child nodes doesn't change
3. No structural directives (`v-if`, `v-for`)

### Elements that Create Blocks

The following elements create new Blocks:

- Root element
- Each branch of `v-if`
- Each item of `v-for`
- Components

```vue
<template>
  <!-- Block 1: Root -->
  <div>
    <p>{{ text1 }}</p>

    <!-- Block 2: v-if -->
    <div v-if="show">
      <p>{{ text2 }}</p>
    </div>

    <!-- Block 3, 4, ...: Each v-for item -->
    <div v-for="item in items" :key="item.id">
      <p>{{ item.text }}</p>
    </div>
  </div>
</template>
```

## VNode Extension

### dynamicChildren

Add a `dynamicChildren` property to VNode to collect dynamic child nodes.

```ts
export interface VNode {
  // ... existing properties

  /**
   * List of dynamic child nodes within the Block
   * Only these need to be traversed during updates
   */
  dynamicChildren: VNode[] | null;

  /**
   * Optimization hints for patch processing
   */
  patchFlag: number;

  /**
   * List of dynamic property names
   */
  dynamicProps: string[] | null;
}
```

## openBlock and createBlock

### Block Tracking

Block creation is done with the pair of `openBlock` and `createBlock`.

```ts
// Currently tracking Block
let currentBlock: VNode[] | null = null;

export function openBlock(): void {
  currentBlock = [];
}

export function createBlock(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(type, props, children, patchFlag, dynamicProps);

  // Set collected dynamic nodes
  vnode.dynamicChildren = currentBlock;
  currentBlock = null;

  return vnode;
}
```

### Collecting Dynamic Nodes

Within `createVNode`, VNodes with patchFlag are added to currentBlock.

```ts
export function createVNode(
  type: VNodeTypes,
  props?: VNodeProps | null,
  children?: VNodeChildren,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode: VNode = {
    type,
    props,
    children,
    patchFlag: patchFlag || 0,
    dynamicProps: dynamicProps || null,
    dynamicChildren: null,
    // ...
  };

  // Has patchFlag = dynamic node
  // Add to currentBlock if it exists
  if (patchFlag !== undefined && patchFlag > 0 && currentBlock) {
    currentBlock.push(vnode);
  }

  return vnode;
}
```

## Generated Code

### Template

```vue
<template>
  <div>
    <h1>Static Title</h1>
    <p>{{ message }}</p>
    <span :class="cls">{{ text }}</span>
  </div>
</template>
```

### Generated Render Function

```js
import { openBlock, createBlock, createVNode, toDisplayString } from 'vue'

// Static nodes are hoisted outside
const _hoisted_1 = createVNode("h1", null, "Static Title")

function render(_ctx) {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // Static (not included in dynamicChildren)
      createVNode("p", null, toDisplayString(_ctx.message), 1 /* TEXT */),
      createVNode("span", { class: _ctx.cls }, toDisplayString(_ctx.text), 3 /* TEXT | CLASS */)
    ])
  )
}

// Resulting VNode:
// {
//   type: "div",
//   children: [_hoisted_1, p, span],
//   dynamicChildren: [p, span]  // Only dynamic nodes
// }
```

## patchBlockChildren Implementation

When updating a Block, only traverse `dynamicChildren`.

```ts
function patchBlockChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: RendererElement,
  parentComponent: ComponentInternalInstance | null
): void {
  for (let i = 0; i < newChildren.length; i++) {
    const oldVNode = oldChildren[i];
    const newVNode = newChildren[i];

    // Patch only dynamic nodes
    patch(oldVNode, newVNode, container, null, parentComponent);
  }
}
```

### Usage in patchElement

```ts
function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInternalInstance | null
): void {
  const el = (n2.el = n1.el!);
  const oldProps = n1.props || {};
  const newProps = n2.props || {};

  // Optimized patch using patchFlag
  const { patchFlag, dynamicChildren } = n2;

  if (patchFlag > 0) {
    // Update only specific properties based on patchFlag
    if (patchFlag & PatchFlags.CLASS) {
      patchClass(el, newProps.class);
    }
    if (patchFlag & PatchFlags.STYLE) {
      patchStyle(el, oldProps.style, newProps.style);
    }
    if (patchFlag & PatchFlags.TEXT) {
      if (n1.children !== n2.children) {
        el.textContent = n2.children as string;
      }
    }
    // ...
  }

  // If dynamicChildren exists, use optimized path
  if (dynamicChildren) {
    patchBlockChildren(
      n1.dynamicChildren!,
      dynamicChildren,
      el,
      parentComponent
    );
  } else {
    // Fallback: normal child patching
    patchChildren(n1, n2, el, parentComponent);
  }
}
```

## Optimization Effect

Consider the case of updating only 1 item out of 1000 list items:

- **Full diff**: Traverses 1000+ nodes
- **Patch Flags only**: Traverses 1000 nodes (property comparison is optimized)
- **Tree Flattening**: Traverses only dynamic nodes (1 node)

The fewer dynamic nodes there are, the greater the effect of Tree Flattening.

## Cases Where Blocks Break

In the following cases, Block optimization is disabled (BAIL mode):

1. **Structural directives**: `v-if`, `v-for` create new Blocks
2. **Dynamic components**: `<component :is="...">`
3. **Slot outlets**: `<slot />`

```vue
<template>
  <div>
    <!-- Block is split here -->
    <div v-if="show">
      <p>{{ a }}</p>  <!-- Block A's dynamicChildren -->
    </div>
    <div v-else>
      <p>{{ b }}</p>  <!-- Block B's dynamicChildren -->
    </div>
  </div>
</template>
```

## Integration with Static Hoisting

Tree Flattening achieves maximum effect when combined with Static Hoisting.

```ts
// Static nodes are hoisted and not included in dynamicChildren
const _hoisted_1 = createVNode("header", null, [
  createVNode("h1", null, "Title"),
  createVNode("nav", null, [/* ... */])
]);

function render() {
  return (
    openBlock(),
    createBlock("div", null, [
      _hoisted_1,  // Static: skipped
      createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // Dynamic: tracked
    ])
  )
}
```

1. **Static Hoisting**: Hoist static nodes outside the function (skip VNode generation)
2. **Tree Flattening**: Collect only dynamic nodes (limit diff targets)
3. **Patch Flags**: Update only dynamic properties (optimize property comparison)

## Processing Flow

```
[Compile time]
Template parsing
  ↓
Detect static nodes → Static Hoisting
  ↓
Detect dynamic nodes → Add Patch Flags
  ↓
Identify Block boundaries → Insert openBlock/createBlock

[Runtime]
openBlock() → currentBlock = []
  ↓
createVNode (static) → Don't add to currentBlock
  ↓
createVNode (dynamic) → currentBlock.push(vnode)
  ↓
createBlock() → vnode.dynamicChildren = currentBlock

[Update time]
patchElement(n1, n2)
  ↓
Does n2.dynamicChildren exist?
  ↓ Yes
patchBlockChildren(n1.dynamicChildren, n2.dynamicChildren)
  ↓
Patch only dynamic nodes
```

## Summary

The Tree Flattening (Block Tree) implementation consists of:

1. **dynamicChildren**: Array to collect dynamic child nodes
2. **openBlock / createBlock**: Block creation and tracking
3. **patchBlockChildren**: Patch only dynamic nodes
4. **Block boundary management**: Create new Blocks with `v-if`, `v-for`, etc.

This optimization enables Vue 3 to achieve fast updates even in large-scale applications. When combined with Static Hoisting and Patch Flags, it enables optimizations unique to template-based frameworks.
