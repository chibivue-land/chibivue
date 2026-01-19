# KeepAlive

## 什么是 KeepAlive

`<KeepAlive>` 是一个内置组件，它可以缓存并复用组件实例而不销毁它们．通常，当组件切换时，旧组件会被卸载，状态也会丢失．但是，通过使用 KeepAlive，您可以在切换组件时保留它们的状态．

<KawaikoNote variant="question" title="为什么需要 KeepAlive？">

例如，想象一个带有标签页切换的界面，其中一个标签页正在填写表单．
如果您切换到另一个标签页再切换回来，输入的内容消失了会很令人沮丧．
KeepAlive 就是为了满足这种"保留状态"的需求！

</KawaikoNote>

主要用例：

1. **标签页切换**：在表单输入过程中切换标签页时保留输入内容
2. **路由**：在页面导航期间保留滚动位置和输入状态
3. **性能**：避免频繁切换的组件重新渲染

## 基本用法

```vue
<template>
  <KeepAlive>
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

## 实现概述

### Props 定义

```ts
export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type MatchPattern = string | RegExp | (string | RegExp)[];
```

- **include**：要缓存的组件名称（只有包含的才会被缓存）
- **exclude**：要排除缓存的组件名称（包含的不会被缓存）
- **max**：缓存的最大数量（使用 LRU 算法删除最旧的）

### KeepAliveContext

KeepAlive 组件有一个用于与渲染器交互的特殊上下文．

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

- **activate**：将缓存的组件恢复显示
- **deactivate**：隐藏组件并缓存它

## 核心逻辑实现

### 缓存管理

```ts
const cache: Map<any, VNode> = new Map();
const keys: Set<any> = new Set();
let current: VNode | null = null;

// 用于存储非活动组件的隐藏容器
const storageContainer = instance.renderer.o.createElement("div");
```

KeepAlive 使用 `cache` Map 来缓存组件的 VNode．`keys` Set 用于 LRU（最近最少使用）算法的顺序管理．

### activate 函数

从缓存中恢复组件并显示它．

```ts
instance.activate = (vnode, container, anchor, _parentComponent) => {
  const instance = vnode.component!;
  // 从隐藏容器移动到实际容器
  move(vnode, container, anchor);
  // 应用任何 props 变化
  patch(instance.vnode, vnode, container, anchor, parentComponent);
  queuePostFlushCb(() => {
    instance.isDeactivated = false;
    // 调用 onActivated 钩子
    if (instance.a) {
      instance.a.forEach((hook: () => void) => hook());
    }
  });
};
```

关键点：
1. 将 DOM 从隐藏容器移动到目标容器
2. 通过 patch 应用 props 变化
3. 调用 `onActivated` 生命周期钩子

### deactivate 函数

隐藏并缓存组件．

```ts
instance.deactivate = (vnode: VNode) => {
  // 移动到隐藏容器（DOM 不会被删除）
  move(vnode, storageContainer, null);
  queuePostFlushCb(() => {
    const instance = vnode.component!;
    // 调用 onDeactivated 钩子
    if (instance.da) {
      instance.da.forEach((hook: () => void) => hook());
    }
    instance.isDeactivated = true;
  });
};
```

与正常卸载不同，DOM 元素不会被删除，只是移动到隐藏容器中．

<KawaikoNote variant="funny" title="隐藏容器技巧">

被隐藏的组件会被移动到屏幕外的"藏身处"．
需要时，只需从"藏身处"取出即可，省去了重建的麻烦！

</KawaikoNote>

### render 函数

这是 KeepAlive 的核心逻辑．

```ts
return (): VNode | undefined => {
  if (!slots.default) {
    return undefined;
  }

  const children = slots.default();
  const rawVNode = children[0];

  // 如果有多个子节点则不缓存
  if (children.length > 1) {
    current = null;
    return children as unknown as VNode;
  }

  // 如果不是组件则直接返回
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

  // include/exclude 过滤
  if (
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  ) {
    current = vnode;
    return rawVNode;
  }

  // 确定缓存键
  const key = vnode.key == null ? comp : vnode.key;
  const cachedVNode = cache.get(key);

  if (cachedVNode) {
    // 缓存命中：恢复状态
    vnode.el = cachedVNode.el;
    vnode.component = cachedVNode.component;
    vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
    // LRU：因为最近使用所以更新顺序
    keys.delete(key);
    keys.add(key);
  } else {
    // 新缓存条目
    keys.add(key);
    // 如果超过最大值则删除最旧的
    if (max && keys.size > parseInt(max as string, 10)) {
      pruneCacheEntry(keys.values().next().value);
    }
  }

  // 设置标志让渲染器识别 KeepAlive
  vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  current = vnode;
  return vnode;
};
```

### 通过 ShapeFlags 控制

KeepAlive 使用 ShapeFlags 与渲染器协调．

```ts
// 此组件应由 KeepAlive 管理
vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

// 此组件是从缓存恢复的
vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
```

渲染器检查这些标志，并调用 activate/deactivate 而不是正常的 mount/unmount．

### include/exclude 匹配

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

模式支持以下格式：
- 字符串（逗号分隔）：`"ComponentA,ComponentB"`
- 正则表达式：`/^Tab/`
- 数组：`["ComponentA", /^Tab/]`

### 缓存清理

```ts
function pruneCacheEntry(key: any): void {
  const cached = cache.get(key) as VNode;
  // 如果当前未显示则卸载
  if (!current || !isSameVNodeType(cached, current)) {
    unmount(cached);
  } else if (current) {
    // 如果当前正在显示则只重置标志
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

## 生命周期钩子

由 KeepAlive 管理的组件可以使用额外的生命周期钩子：

- **onActivated**：当组件变为活动状态时
- **onDeactivated**：当组件变为非活动状态时

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

## 使用示例

### 基本用法

```vue
<template>
  <KeepAlive>
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### 使用 include/exclude

```vue
<template>
  <!-- 只缓存 ComponentA 和 ComponentB -->
  <KeepAlive include="ComponentA,ComponentB">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- 缓存除 ComponentC 以外的所有组件 -->
  <KeepAlive exclude="ComponentC">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- 使用正则表达式匹配 -->
  <KeepAlive :include="/^Tab/">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### 使用 max

```vue
<template>
  <!-- 最多缓存 10 个组件（LRU） -->
  <KeepAlive :max="10">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

## 与渲染器的集成

KeepAlive 与渲染器紧密协调工作．

### mountComponent 中的 KeepAlive 检测

```ts
// packages/runtime-core/src/renderer.ts
const mountComponent: MountComponentFn = (initialVNode, container, anchor, parentComponent) => {
  const instance: ComponentInternalInstance = (
    initialVNode.component = createComponentInstance(initialVNode, parentComponent)
  );

  // 对于 KeepAlive 组件，注入渲染器
  if (isKeepAlive(initialVNode)) {
    (instance as KeepAliveContext).renderer = {
      p: patch,   // patch 函数
      m: move,    // DOM 移动函数
      um: unmount, // 卸载函数
      o: options,  // 宿主选项（createElement 等）
    };
  }

  // ... 正常的挂载处理
};
```

### processComponent 中的 KEPT_ALIVE 检查

```ts
const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null = null,
) => {
  if (n1 == null) {
    // 新挂载
    if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      // 从缓存恢复：调用 activate
      (parentComponent as KeepAliveContext).activate(
        n2,
        container,
        anchor,
        parentComponent as ComponentInternalInstance
      );
    } else {
      // 正常挂载
      mountComponent(n2, container, anchor, parentComponent);
    }
  } else {
    updateComponent(n1, n2);
  }
};
```

### unmount 中的 SHOULD_KEEP_ALIVE 检查

```ts
const unmount: UnmountFn = (vnode, parentComponent?: ComponentInternalInstance) => {
  const { type, shapeFlag, children } = vnode;

  // KeepAlive 管理下的组件会被停用而不是删除
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    (parentComponent as KeepAliveContext).deactivate(vnode);
    return;
  }

  // 正常的卸载处理
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode.component!);
  }
  // ...
};
```

## 处理流程

```
初次挂载：
KeepAlive render
  → 从插槽获取子节点
  → 不在缓存中 → 添加到 keys
  → 设置 COMPONENT_SHOULD_KEEP_ALIVE 标志
  → 返回 vnode
      ↓
processComponent
  → 没有 COMPONENT_KEPT_ALIVE → mountComponent
  → isKeepAlive(vnode) → 注入渲染器
  → 正常组件挂载

从缓存恢复：
KeepAlive render
  → 从插槽获取子节点
  → 缓存命中 → 复用 el/component
  → 添加 COMPONENT_KEPT_ALIVE 标志
  → 更新 keys 顺序（LRU）
  → 返回 vnode
      ↓
processComponent
  → 存在 COMPONENT_KEPT_ALIVE
  → 调用 parentComponent.activate()
      ↓
activate
  → 从隐藏容器移动到实际容器
  → 通过 patch 应用 props 变化
  → instance.isDeactivated = false
  → 调用 onActivated 钩子

停用：
unmount
  → 存在 COMPONENT_SHOULD_KEEP_ALIVE
  → 调用 parentComponent.deactivate()
      ↓
deactivate
  → 移动到隐藏容器（DOM 不会被删除）
  → instance.isDeactivated = true
  → 调用 onDeactivated 钩子
  → 保留在缓存中
```

<KawaikoNote variant="warning" title="注意内存使用！">

被 KeepAlive 缓存的组件会一直保留在内存中．
缓存太多会占用内存，所以请使用 `max` 属性设置上限．
它会通过 LRU（删除最近最少使用的项目）自动管理！

</KawaikoNote>

## 总结

KeepAlive 的实现由以下元素组成：

1. **缓存系统**：使用 Map 和 Set 的 LRU 缓存
2. **隐藏容器**：保存非活动的 DOM（`createElement("div")`）
3. **activate/deactivate**：DOM 移动和生命周期管理
4. **ShapeFlags**：与渲染器协调
   - `COMPONENT_SHOULD_KEEP_ALIVE`：卸载时调用 deactivate
   - `COMPONENT_KEPT_ALIVE`：挂载时调用 activate
5. **渲染器注入**：KeepAlive 持有 patch/move/unmount 函数的引用
6. **include/exclude/max**：灵活的缓存控制

KeepAlive 是一个强大的功能，可以在保留组件状态的同时提高性能，但需要权衡内存使用，因此设置适当的 `max` 值很重要．

<KawaikoNote variant="surprise" title="KeepAlive 完成！">

"隐藏而不是删除"组件是一个简单的想法，
但与渲染器协调和 LRU 缓存的实现相当深入！

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/020_keep_alive)
