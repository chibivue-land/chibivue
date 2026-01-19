# KeepAlive

## What is KeepAlive

`<KeepAlive>` is a built-in component that caches and reuses component instances without destroying them. Normally, when components are switched, the old component is unmounted and its state is lost. However, by using KeepAlive, you can switch between components while preserving their state.

<KawaikoNote variant="question" title="Why is KeepAlive needed?">

For example, imagine a screen with tab switching where you have a form being filled out in one tab.
If you switch to another tab and come back, it would be frustrating if the input content disappeared.
KeepAlive addresses this need to "preserve state"!

</KawaikoNote>

Main use cases:

1. **Tab switching**: Preserve input content when switching tabs during form entry
2. **Routing**: Preserve scroll position and input state during page navigation
3. **Performance**: Avoid re-rendering frequently switched components

## Basic Usage

```vue
<template>
  <KeepAlive>
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

## Implementation Overview

### Props Definition

```ts
export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type MatchPattern = string | RegExp | (string | RegExp)[];
```

- **include**: Component names to cache (only those included are cached)
- **exclude**: Component names to exclude from caching (those included are not cached)
- **max**: Maximum number to cache (oldest ones are removed using LRU algorithm)

### KeepAliveContext

The KeepAlive component has a special context for interacting with the renderer.

```ts
export interface KeepAliveContext extends ComponentInternalInstance {
  renderer: KeepAliveRenderer;
  activate: (
    vnode: VNode,
    container: any,
    anchor: any | null,
    parentComponent: ComponentInternalInstance | null,
  ) => void;
  deactivate: (vnode: VNode) => void;
}
```

- **activate**: Bring a cached component back to display
- **deactivate**: Hide a component and cache it

## Core Logic Implementation

### Cache Management

```ts
const cache: Map<any, VNode> = new Map();
const keys: Set<any> = new Set();
let current: VNode | null = null;

// Hidden container for storing inactive components
const storageContainer = instance.renderer.o.createElement("div");
```

KeepAlive caches component VNodes using a `cache` Map. The `keys` Set is used for order management in the LRU (Least Recently Used) algorithm.

### activate Function

Restores a component from the cache and displays it.

```ts
instance.activate = (vnode, container, anchor, _parentComponent) => {
  const instance = vnode.component!;
  // Move from hidden container to actual container
  move(vnode, container, anchor);
  // Apply any props changes
  patch(instance.vnode, vnode, container, anchor, parentComponent);
  queuePostFlushCb(() => {
    instance.isDeactivated = false;
    // Call onActivated hooks
    if (instance.a) {
      instance.a.forEach((hook: () => void) => hook());
    }
  });
};
```

Key points:
1. Move DOM from hidden container to target container
2. Apply props changes via patch
3. Call `onActivated` lifecycle hook

### deactivate Function

Hides and caches the component.

```ts
instance.deactivate = (vnode: VNode) => {
  // Move to hidden container (DOM is not removed)
  move(vnode, storageContainer, null);
  queuePostFlushCb(() => {
    const instance = vnode.component!;
    // Call onDeactivated hooks
    if (instance.da) {
      instance.da.forEach((hook: () => void) => hook());
    }
    instance.isDeactivated = true;
  });
};
```

Unlike normal unmounting, DOM elements are not removed but simply moved to the hidden container.

<KawaikoNote variant="funny" title="The Hidden Container Trick">

Components being hidden are moved to a "hideout" off-screen.
When needed, they're simply retrieved from the "hideout", saving the trouble of rebuilding!

</KawaikoNote>

### render Function

This is the core logic of KeepAlive.

```ts
return (): VNode | undefined => {
  if (!slots.default) {
    return undefined;
  }

  const children = slots.default();
  const rawVNode = children[0];

  // Don't cache if there are multiple children
  if (children.length > 1) {
    current = null;
    return children as unknown as VNode;
  }

  // Return as-is if not a component
  if (
    !(rawVNode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) &&
    !(rawVNode.shapeFlag & ShapeFlags.COMPONENT)
  ) {
    current = null;
    return rawVNode;
  }

  let vnode = rawVNode;
  const comp = vnode.type as any;
  const name = getComponentName(comp);
  const { include, exclude, max } = props;

  // include/exclude filtering
  if (
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  ) {
    current = vnode;
    return rawVNode;
  }

  // Determine cache key
  const key = vnode.key == null ? comp : vnode.key;
  const cachedVNode = cache.get(key);

  if (cachedVNode) {
    // Cache hit: restore state
    vnode.el = cachedVNode.el;
    vnode.component = cachedVNode.component;
    vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
    // LRU: update order since recently used
    keys.delete(key);
    keys.add(key);
  } else {
    // New cache entry
    keys.add(key);
    // Remove oldest if exceeding max
    if (max && keys.size > parseInt(max as string, 10)) {
      pruneCacheEntry(keys.values().next().value);
    }
  }

  // Set flag to let renderer recognize KeepAlive
  vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  current = vnode;
  return vnode;
};
```

### Control via ShapeFlags

KeepAlive coordinates with the renderer using ShapeFlags.

```ts
// This component should be managed by KeepAlive
vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

// This component was restored from cache
vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
```

The renderer checks these flags and calls activate/deactivate instead of normal mount/unmount.

### include/exclude Matching

```ts
function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name));
  } else if (isString(pattern)) {
    return pattern.split(",").includes(name);
  } else if (pattern instanceof RegExp) {
    return pattern.test(name);
  }
  return false;
}
```

Patterns support the following formats:
- String (comma-separated): `"ComponentA,ComponentB"`
- Regular expression: `/^Tab/`
- Array: `["ComponentA", /^Tab/]`

### Cache Pruning

```ts
function pruneCacheEntry(key: any): void {
  const cached = cache.get(key) as VNode;
  // Unmount if not currently displayed
  if (!current || !isSameVNodeType(cached, current)) {
    unmount(cached);
  } else if (current) {
    // Only reset flags if currently displayed
    resetShapeFlag(current);
  }
  cache.delete(key);
  keys.delete(key);
}

function resetShapeFlag(vnode: VNode): void {
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE;
}
```

## Lifecycle Hooks

Components managed by KeepAlive can use additional lifecycle hooks:

- **onActivated**: When the component becomes active
- **onDeactivated**: When the component becomes inactive

```ts
import { onActivated, onDeactivated } from 'vue'

export default {
  setup() {
    onActivated(() => {
      console.log('activated!')
    })
    onDeactivated(() => {
      console.log('deactivated!')
    })
  }
}
```

## Usage Examples

### Basic Usage

```vue
<template>
  <KeepAlive>
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### Using include/exclude

```vue
<template>
  <!-- Cache only ComponentA and ComponentB -->
  <KeepAlive include="ComponentA,ComponentB">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- Cache everything except ComponentC -->
  <KeepAlive exclude="ComponentC">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- Match with regular expression -->
  <KeepAlive :include="/^Tab/">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### Using max

```vue
<template>
  <!-- Cache up to 10 components (LRU) -->
  <KeepAlive :max="10">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

## Integration with Renderer

KeepAlive works in close coordination with the renderer.

### KeepAlive Detection in mountComponent

```ts
// packages/runtime-core/src/renderer.ts
const mountComponent: MountComponentFn = (initialVNode, container, anchor, parentComponent) => {
  const instance: ComponentInternalInstance = (
    initialVNode.component = createComponentInstance(initialVNode, parentComponent)
  );

  // For KeepAlive components, inject the renderer
  if (isKeepAlive(initialVNode)) {
    (instance as KeepAliveContext).renderer = {
      p: patch,   // patch function
      m: move,    // DOM move function
      um: unmount, // unmount function
      o: options,  // host options (createElement, etc.)
    };
  }

  // ... normal mount processing
};
```

### KEPT_ALIVE Check in processComponent

```ts
const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null = null,
) => {
  if (n1 == null) {
    // New mount
    if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      // Restore from cache: call activate
      (parentComponent as KeepAliveContext).activate(
        n2,
        container,
        anchor,
        parentComponent as ComponentInternalInstance
      );
    } else {
      // Normal mount
      mountComponent(n2, container, anchor, parentComponent);
    }
  } else {
    updateComponent(n1, n2);
  }
};
```

### SHOULD_KEEP_ALIVE Check in unmount

```ts
const unmount: UnmountFn = (vnode, parentComponent?: ComponentInternalInstance) => {
  const { type, shapeFlag, children } = vnode;

  // Components under KeepAlive management are deactivated, not removed
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    (parentComponent as KeepAliveContext).deactivate(vnode);
    return;
  }

  // Normal unmount processing
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode.component!);
  }
  // ...
};
```

## Processing Flow

```
Initial Mount:
KeepAlive render
  → Get child from slot
  → Not in cache → Add to keys
  → Set COMPONENT_SHOULD_KEEP_ALIVE flag
  → Return vnode
      ↓
processComponent
  → No COMPONENT_KEPT_ALIVE → mountComponent
  → isKeepAlive(vnode) → Inject renderer
  → Normal component mount

Restore from Cache:
KeepAlive render
  → Get child from slot
  → Cache hit → Reuse el/component
  → Add COMPONENT_KEPT_ALIVE flag
  → Update keys order (LRU)
  → Return vnode
      ↓
processComponent
  → COMPONENT_KEPT_ALIVE present
  → Call parentComponent.activate()
      ↓
activate
  → Move from hidden container to real container
  → Apply props changes via patch
  → instance.isDeactivated = false
  → Call onActivated hook

Deactivation:
unmount
  → COMPONENT_SHOULD_KEEP_ALIVE present
  → Call parentComponent.deactivate()
      ↓
deactivate
  → Move to hidden container (DOM is not removed)
  → instance.isDeactivated = true
  → Call onDeactivated hook
  → Kept in cache
```

<KawaikoNote variant="warning" title="Watch Your Memory Usage!">

Components cached by KeepAlive remain in memory.
Caching too many can strain memory, so set an upper limit with the `max` property.
It's automatically managed with LRU (removing least recently used items)!

</KawaikoNote>

## Summary

The KeepAlive implementation consists of the following elements:

1. **Cache System**: LRU cache using Map and Set
2. **Hidden Container**: Holds inactive DOM (`createElement("div")`)
3. **activate/deactivate**: DOM movement and lifecycle management
4. **ShapeFlags**: Coordination with renderer
   - `COMPONENT_SHOULD_KEEP_ALIVE`: Call deactivate during unmount
   - `COMPONENT_KEPT_ALIVE`: Call activate during mount
5. **Renderer Injection**: KeepAlive holds references to patch/move/unmount functions
6. **include/exclude/max**: Flexible cache control

KeepAlive is a powerful feature that improves performance while preserving component state, but there's a trade-off with memory usage, so setting an appropriate `max` value is important.

<KawaikoNote variant="surprise" title="KeepAlive Complete!">

It's a simple idea of "hiding instead of removing" components,
but the implementation with renderer coordination and LRU cache is quite deep!

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/020_keep_alive)
