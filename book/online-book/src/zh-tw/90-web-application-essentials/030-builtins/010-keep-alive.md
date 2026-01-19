# KeepAlive

## 什麼是 KeepAlive

`<KeepAlive>` 是一個內建組件，它可以快取並複用組件實例而不銷毀它們．通常，當組件切換時，舊組件會被卸載，狀態也會丟失．但是，透過使用 KeepAlive，您可以在切換組件時保留它們的狀態．

<KawaikoNote variant="question" title="為什麼需要 KeepAlive？">

例如，想像一個帶有標籤頁切換的介面，其中一個標籤頁正在填寫表單．
如果您切換到另一個標籤頁再切換回來，輸入的內容消失了會很令人沮喪．
KeepAlive 就是為了滿足這種「保留狀態」的需求！

</KawaikoNote>

主要用例：

1. **標籤頁切換**：在表單輸入過程中切換標籤頁時保留輸入內容
2. **路由**：在頁面導航期間保留滾動位置和輸入狀態
3. **效能**：避免頻繁切換的組件重新渲染

## 基本用法

```vue
<template>
  <KeepAlive>
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

## 實作概述

### Props 定義

```ts
export interface KeepAliveProps {
  include?: MatchPattern;
  exclude?: MatchPattern;
  max?: number | string;
}

type MatchPattern = string | RegExp | (string | RegExp)[];
```

- **include**：要快取的組件名稱（只有包含的才會被快取）
- **exclude**：要排除快取的組件名稱（包含的不會被快取）
- **max**：快取的最大數量（使用 LRU 演算法刪除最舊的）

### KeepAliveContext

KeepAlive 組件有一個用於與渲染器互動的特殊上下文．

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

- **activate**：將快取的組件恢復顯示
- **deactivate**：隱藏組件並快取它

## 核心邏輯實作

### 快取管理

```ts
const cache: Map<any, VNode> = new Map();
const keys: Set<any> = new Set();
let current: VNode | null = null;

// 用於儲存非活動組件的隱藏容器
const storageContainer = instance.renderer.o.createElement("div");
```

KeepAlive 使用 `cache` Map 來快取組件的 VNode．`keys` Set 用於 LRU（最近最少使用）演算法的順序管理．

### activate 函數

從快取中恢復組件並顯示它．

```ts
instance.activate = (vnode, container, anchor, _parentComponent) => {
  const instance = vnode.component!;
  // 從隱藏容器移動到實際容器
  move(vnode, container, anchor);
  // 套用任何 props 變化
  patch(instance.vnode, vnode, container, anchor, parentComponent);
  queuePostFlushCb(() => {
    instance.isDeactivated = false;
    // 呼叫 onActivated 鉤子
    if (instance.a) {
      instance.a.forEach((hook: () => void) => hook());
    }
  });
};
```

關鍵點：
1. 將 DOM 從隱藏容器移動到目標容器
2. 透過 patch 套用 props 變化
3. 呼叫 `onActivated` 生命週期鉤子

### deactivate 函數

隱藏並快取組件．

```ts
instance.deactivate = (vnode: VNode) => {
  // 移動到隱藏容器（DOM 不會被刪除）
  move(vnode, storageContainer, null);
  queuePostFlushCb(() => {
    const instance = vnode.component!;
    // 呼叫 onDeactivated 鉤子
    if (instance.da) {
      instance.da.forEach((hook: () => void) => hook());
    }
    instance.isDeactivated = true;
  });
};
```

與正常卸載不同，DOM 元素不會被刪除，只是移動到隱藏容器中．

<KawaikoNote variant="funny" title="隱藏容器技巧">

被隱藏的組件會被移動到螢幕外的「藏身處」．
需要時，只需從「藏身處」取出即可，省去了重建的麻煩！

</KawaikoNote>

### render 函數

這是 KeepAlive 的核心邏輯．

```ts
return (): VNode | undefined => {
  if (!slots.default) {
    return undefined;
  }

  const children = slots.default();
  const rawVNode = children[0];

  // 如果有多個子節點則不快取
  if (children.length > 1) {
    current = null;
    return children as unknown as VNode;
  }

  // 如果不是組件則直接返回
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

  // include/exclude 過濾
  if (
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  ) {
    current = vnode;
    return rawVNode;
  }

  // 確定快取鍵
  const key = vnode.key == null ? comp : vnode.key;
  const cachedVNode = cache.get(key);

  if (cachedVNode) {
    // 快取命中：恢復狀態
    vnode.el = cachedVNode.el;
    vnode.component = cachedVNode.component;
    vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
    // LRU：因為最近使用所以更新順序
    keys.delete(key);
    keys.add(key);
  } else {
    // 新快取條目
    keys.add(key);
    // 如果超過最大值則刪除最舊的
    if (max && keys.size > parseInt(max as string, 10)) {
      pruneCacheEntry(keys.values().next().value);
    }
  }

  // 設定標誌讓渲染器識別 KeepAlive
  vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;
  current = vnode;
  return vnode;
};
```

### 透過 ShapeFlags 控制

KeepAlive 使用 ShapeFlags 與渲染器協調．

```ts
// 此組件應由 KeepAlive 管理
vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

// 此組件是從快取恢復的
vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE;
```

渲染器檢查這些標誌，並呼叫 activate/deactivate 而不是正常的 mount/unmount．

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

模式支援以下格式：
- 字串（逗號分隔）：`"ComponentA,ComponentB"`
- 正規表達式：`/^Tab/`
- 陣列：`["ComponentA", /^Tab/]`

### 快取清理

```ts
function pruneCacheEntry(key: any): void {
  const cached = cache.get(key) as VNode;
  // 如果當前未顯示則卸載
  if (!current || !isSameVNodeType(cached, current)) {
    unmount(cached);
  } else if (current) {
    // 如果當前正在顯示則只重設標誌
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

## 生命週期鉤子

由 KeepAlive 管理的組件可以使用額外的生命週期鉤子：

- **onActivated**：當組件變為活動狀態時
- **onDeactivated**：當組件變為非活動狀態時

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

## 使用範例

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
  <!-- 只快取 ComponentA 和 ComponentB -->
  <KeepAlive include="ComponentA,ComponentB">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- 快取除 ComponentC 以外的所有組件 -->
  <KeepAlive exclude="ComponentC">
    <component :is="currentComponent" />
  </KeepAlive>

  <!-- 使用正規表達式匹配 -->
  <KeepAlive :include="/^Tab/">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

### 使用 max

```vue
<template>
  <!-- 最多快取 10 個組件（LRU） -->
  <KeepAlive :max="10">
    <component :is="currentComponent" />
  </KeepAlive>
</template>
```

## 與渲染器的整合

KeepAlive 與渲染器緊密協調工作．

### mountComponent 中的 KeepAlive 檢測

```ts
// packages/runtime-core/src/renderer.ts
const mountComponent: MountComponentFn = (initialVNode, container, anchor, parentComponent) => {
  const instance: ComponentInternalInstance = (
    initialVNode.component = createComponentInstance(initialVNode, parentComponent)
  );

  // 對於 KeepAlive 組件，注入渲染器
  if (isKeepAlive(initialVNode)) {
    (instance as KeepAliveContext).renderer = {
      p: patch,   // patch 函數
      m: move,    // DOM 移動函數
      um: unmount, // 卸載函數
      o: options,  // 宿主選項（createElement 等）
    };
  }

  // ... 正常的掛載處理
};
```

### processComponent 中的 KEPT_ALIVE 檢查

```ts
const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null = null,
) => {
  if (n1 == null) {
    // 新掛載
    if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
      // 從快取恢復：呼叫 activate
      (parentComponent as KeepAliveContext).activate(
        n2,
        container,
        anchor,
        parentComponent as ComponentInternalInstance
      );
    } else {
      // 正常掛載
      mountComponent(n2, container, anchor, parentComponent);
    }
  } else {
    updateComponent(n1, n2);
  }
};
```

### unmount 中的 SHOULD_KEEP_ALIVE 檢查

```ts
const unmount: UnmountFn = (vnode, parentComponent?: ComponentInternalInstance) => {
  const { type, shapeFlag, children } = vnode;

  // KeepAlive 管理下的組件會被停用而不是刪除
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    (parentComponent as KeepAliveContext).deactivate(vnode);
    return;
  }

  // 正常的卸載處理
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode.component!);
  }
  // ...
};
```

## 處理流程

```
初次掛載：
KeepAlive render
  → 從插槽獲取子節點
  → 不在快取中 → 添加到 keys
  → 設定 COMPONENT_SHOULD_KEEP_ALIVE 標誌
  → 返回 vnode
      ↓
processComponent
  → 沒有 COMPONENT_KEPT_ALIVE → mountComponent
  → isKeepAlive(vnode) → 注入渲染器
  → 正常組件掛載

從快取恢復：
KeepAlive render
  → 從插槽獲取子節點
  → 快取命中 → 複用 el/component
  → 添加 COMPONENT_KEPT_ALIVE 標誌
  → 更新 keys 順序（LRU）
  → 返回 vnode
      ↓
processComponent
  → 存在 COMPONENT_KEPT_ALIVE
  → 呼叫 parentComponent.activate()
      ↓
activate
  → 從隱藏容器移動到實際容器
  → 透過 patch 套用 props 變化
  → instance.isDeactivated = false
  → 呼叫 onActivated 鉤子

停用：
unmount
  → 存在 COMPONENT_SHOULD_KEEP_ALIVE
  → 呼叫 parentComponent.deactivate()
      ↓
deactivate
  → 移動到隱藏容器（DOM 不會被刪除）
  → instance.isDeactivated = true
  → 呼叫 onDeactivated 鉤子
  → 保留在快取中
```

<KawaikoNote variant="warning" title="注意記憶體使用！">

被 KeepAlive 快取的組件會一直保留在記憶體中．
快取太多會佔用記憶體，所以請使用 `max` 屬性設定上限．
它會透過 LRU（刪除最近最少使用的項目）自動管理！

</KawaikoNote>

## 總結

KeepAlive 的實作由以下元素組成：

1. **快取系統**：使用 Map 和 Set 的 LRU 快取
2. **隱藏容器**：保存非活動的 DOM（`createElement("div")`）
3. **activate/deactivate**：DOM 移動和生命週期管理
4. **ShapeFlags**：與渲染器協調
   - `COMPONENT_SHOULD_KEEP_ALIVE`：卸載時呼叫 deactivate
   - `COMPONENT_KEPT_ALIVE`：掛載時呼叫 activate
5. **渲染器注入**：KeepAlive 持有 patch/move/unmount 函數的參考
6. **include/exclude/max**：靈活的快取控制

KeepAlive 是一個強大的功能，可以在保留組件狀態的同時提高效能，但需要權衡記憶體使用，因此設定適當的 `max` 值很重要．

<KawaikoNote variant="surprise" title="KeepAlive 完成！">

「隱藏而不是刪除」組件是一個簡單的想法，
但與渲染器協調和 LRU 快取的實作相當深入！

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/020_keep_alive)
