# Transition

## 什麼是 Transition？

`<Transition>` 是一個內建組件，用於在顯示或隱藏元素和組件時應用動畫．它與 CSS 過渡/動畫配合使用，實現平滑的 UI 過渡效果．

<KawaikoNote variant="question" title="為什麼需要 Transition？">

當你使用 `v-if` 切換元素的顯示/隱藏時，元素會瞬間消失或出現．
使用 Transition，你可以輕鬆添加淡入/淡出或滑動等動畫效果！

</KawaikoNote>

主要用例：

1. **與 v-if / v-show 組合**：條件渲染時的動畫
2. **動態組件**：使用 `<component :is>` 時的切換動畫
3. **路由過渡**：頁面之間的過渡效果

## 基本用法

```vue
<template>
  <button @click="show = !show">Toggle</button>
  <Transition name="fade">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

## 實作概述

### Props 定義

```ts
export interface TransitionProps {
  name?: string;
  type?: "transition" | "animation";
  css?: boolean;
  duration?: number | { enter: number; leave: number };
  enterFromClass?: string;
  enterActiveClass?: string;
  enterToClass?: string;
  appearFromClass?: string;
  appearActiveClass?: string;
  appearToClass?: string;
  leaveFromClass?: string;
  leaveActiveClass?: string;
  leaveToClass?: string;
  mode?: "in-out" | "out-in" | "default";
  appear?: boolean;
  // 生命週期鉤子
  onBeforeEnter?: (el: Element) => void;
  onEnter?: (el: Element, done: () => void) => void;
  onAfterEnter?: (el: Element) => void;
  onEnterCancelled?: (el: Element) => void;
  onBeforeLeave?: (el: Element) => void;
  onLeave?: (el: Element, done: () => void) => void;
  onAfterLeave?: (el: Element) => void;
  onLeaveCancelled?: (el: Element) => void;
  // appear 鉤子
  onBeforeAppear?: (el: Element) => void;
  onAppear?: (el: Element, done: () => void) => void;
  onAfterAppear?: (el: Element) => void;
  onAppearCancelled?: (el: Element) => void;
}
```

### TransitionHooks 介面

```ts
export interface TransitionHooks<HostElement = Element> {
  mode: string;
  beforeEnter(el: HostElement): void;
  enter(el: HostElement): void;
  leave(el: HostElement, remove: () => void): void;
  clone(vnode: VNode): TransitionHooks<HostElement>;
}
```

渲染器通過此介面與 Transition 進行協調．

## CSS 類別的生命週期

Transition 會自動添加和移除以下 CSS 類別：

### Enter（顯示元素）

1. **v-enter-from**：開始狀態．在元素插入之前添加，1 幀後移除
2. **v-enter-active**：啟用狀態．在整個過渡期間應用
3. **v-enter-to**：結束狀態．開始後 1 幀添加，過渡結束時移除

### Leave（隱藏元素）

1. **v-leave-from**：開始狀態．在 leave 過渡開始時添加，1 幀後移除
2. **v-leave-active**：啟用狀態．在整個過渡期間應用
3. **v-leave-to**：結束狀態．開始後 1 幀添加，過渡結束時移除

```
Enter:
┌──────────────────────────────────────────┐
│ v-enter-from → (1 frame) → v-enter-to   │
│ ├─────── v-enter-active ──────────────┤ │
└──────────────────────────────────────────┘

Leave:
┌──────────────────────────────────────────┐
│ v-leave-from → (1 frame) → v-leave-to   │
│ ├─────── v-leave-active ──────────────┤ │
└──────────────────────────────────────────┘
```

## 核心邏輯實作

### resolveTransitionProps

解析 props 並生成 TransitionHooks．

```ts
export function resolveTransitionProps(
  rawProps: TransitionProps
): TransitionProps & TransitionHooks {
  const {
    name = "v",
    type,
    css = true,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    // ... 其他類別
    mode = "default",
  } = rawProps;

  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];

  // 生成鉤子函數
  return {
    ...rawProps,
    mode,
    beforeEnter(el) {
      callHook(onBeforeEnter, [el]);
      addTransitionClass(el, enterFromClass);
      addTransitionClass(el, enterActiveClass);
    },
    enter: makeEnterHook(false),
    leave(el, done) {
      // leave 邏輯
    },
    clone(vnode) {
      return resolveTransitionProps(rawProps);
    },
  };
}
```

### CSS 類別管理

```ts
export interface ElementWithTransition extends HTMLElement {
  _vtc?: Set<string>;
}

export function addTransitionClass(
  el: Element & ElementWithTransition,
  cls: string
): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  (el._vtc || (el._vtc = new Set())).add(cls);
}

export function removeTransitionClass(
  el: Element & ElementWithTransition,
  cls: string
): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  const { _vtc } = el;
  if (_vtc) {
    _vtc.delete(cls);
    if (!_vtc.size) {
      el._vtc = undefined;
    }
  }
}
```

`_vtc`（Vue Transition Classes）屬性用於追蹤當前應用的過渡類別．

### nextFrame

為了使 CSS 過渡正常運作，我們需要等待 2 幀後再更改類別．

```ts
function nextFrame(cb: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
```

第一幀讓瀏覽器識別初始狀態，第二幀應用更改，確保過渡可靠觸發．

<KawaikoNote variant="funny" title="為什麼要等待 2 幀？">

「為什麼要呼叫兩次 `requestAnimationFrame`？」你可能會疑惑．
第一次呼叫告訴瀏覽器「這是初始狀態」，
第二次呼叫告訴它「這是結束狀態」，
這樣瀏覽器才能識別過渡！

</KawaikoNote>

### Enter 鉤子

```ts
const makeEnterHook = (isAppear: boolean) => {
  return (el: Element, done: () => void) => {
    const hook = isAppear ? onAppear : onEnter;
    const resolve = () => finishEnter(el, isAppear, done);

    callHook(hook, [el, resolve]);

    nextFrame(() => {
      removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
      addTransitionClass(el, isAppear ? appearToClass : enterToClass);
      if (!hasExplicitCallback(hook)) {
        whenTransitionEnds(el, type, enterDuration, resolve);
      }
    });
  };
};
```

1. 呼叫使用者定義的鉤子
2. 2 幀後，移除 from 類別並添加 to 類別
3. 偵測過渡結束並完成處理

### Leave 鉤子

```ts
leave(el, done) {
  const resolve = () => finishLeave(el, done);
  addTransitionClass(el, leaveFromClass);
  // 強制重排
  forceReflow();
  addTransitionClass(el, leaveActiveClass);

  nextFrame(() => {
    removeTransitionClass(el, leaveFromClass);
    addTransitionClass(el, leaveToClass);
    if (!hasExplicitCallback(onLeave)) {
      whenTransitionEnds(el, type, leaveDuration, resolve);
    }
  });
  callHook(onLeave, [el, resolve]);
}
```

## 偵測過渡結束

### getTransitionInfo

從 CSS 獲取 transition/animation 資訊．

```ts
export function getTransitionInfo(
  el: Element,
  expectedType?: TransitionProps["type"]
): CSSTransitionInfo {
  const styles = window.getComputedStyle(el);

  const transitionDelays = getStyleProperties("transitionDelay").split(", ");
  const transitionDurations = getStyleProperties("transitionDuration").split(", ");
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations);

  const animationDelays = getStyleProperties("animationDelay").split(", ");
  const animationDurations = getStyleProperties("animationDuration").split(", ");
  const animationTimeout = getTimeout(animationDelays, animationDurations);

  // 確定使用 transition 還是 animation
  let type: CSSTransitionInfo["type"] = null;
  let timeout = 0;
  let propCount = 0;

  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION;
      timeout = transitionTimeout;
      propCount = transitionDurations.length;
    }
  } else if (expectedType === ANIMATION) {
    // animation 的情況
  } else {
    // 自動偵測
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0
      ? (transitionTimeout > animationTimeout ? TRANSITION : ANIMATION)
      : null;
  }

  return { type, timeout, propCount, hasTransform };
}
```

### whenTransitionEnds

在過渡結束時執行回呼．

```ts
export function whenTransitionEnds(
  el: Element & { _endId?: number },
  expectedType: TransitionProps["type"] | undefined,
  explicitTimeout: number | null,
  resolve: () => void
): void {
  const id = (el._endId = ++endId);
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve();
    }
  };

  // 如果提供了明確的超時，則使用它
  if (explicitTimeout) {
    return setTimeout(resolveIfNotStale, explicitTimeout);
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
  if (!type) {
    return resolve();
  }

  const endEvent = type + "end"; // "transitionend" 或 "animationend"
  let ended = 0;

  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };

  // 超時回退
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);

  el.addEventListener(endEvent, onEnd);
}
```

要點：
- 監聽 `transitionend` / `animationend` 事件
- 等待與屬性數量相同的事件
- 超時回退（以防事件未觸發的保險）
- `_endId` 取消舊的過渡

### forceReflow

強制重排以確保 CSS 過渡可靠觸發．

```ts
export function forceReflow(): number {
  return document.body.offsetHeight;
}
```

讀取 `offsetHeight` 強制瀏覽器重新計算樣式．

<KawaikoNote variant="warning" title="為什麼要強制重排？">

即使連續添加 CSS 類別，瀏覽器也可能為了最佳化而批次進行樣式重新計算．
讀取 `offsetHeight` 可以強制它「立即計算！」

</KawaikoNote>

## Transition 組件主體

```ts
const Transition = (
  props: TransitionProps,
  { slots }: { slots: any }
): VNode | null => {
  const innerProps = resolveTransitionProps(props);
  const children = slots.default && slots.default();

  if (!children || children.length === 0) {
    return null;
  }

  const child = children[0];
  if (child) {
    // 在 VNode 上設定 transition 鉤子
    child.transition = innerProps;
  }

  return child;
};
```

Transition 本身不渲染任何 DOM 元素；它只是在子 VNode 上附加一個 `transition` 屬性．渲染器會看到這個屬性並呼叫鉤子．

## 使用範例

### 基本淡入淡出

```vue
<template>
  <Transition name="fade">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### 滑動動畫

```vue
<template>
  <Transition name="slide">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
```

### JavaScript 鉤子

```vue
<template>
  <Transition
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
    :css="false"
  >
    <p v-if="show">Hello</p>
  </Transition>
</template>

<script setup>
function onBeforeEnter(el) {
  el.style.opacity = 0;
}

function onEnter(el, done) {
  // 使用 GSAP 等動畫庫
  gsap.to(el, {
    opacity: 1,
    duration: 0.5,
    onComplete: done,
  });
}

function onLeave(el, done) {
  gsap.to(el, {
    opacity: 0,
    duration: 0.5,
    onComplete: done,
  });
}
</script>
```

### 明確的 duration

```vue
<template>
  <!-- enter: 300ms, leave: 500ms -->
  <Transition name="fade" :duration="{ enter: 300, leave: 500 }">
    <p v-if="show">Hello</p>
  </Transition>
</template>
```

## 與 VNode 的整合

### VNode.transition 屬性

VNode 有一個 `transition` 屬性，用於儲存 TransitionHooks．

```ts
// packages/runtime-core/src/vnode.ts
export interface VNode<HostNode = any> {
  // ... 其他屬性

  // transition
  transition: any | null;
}
```

### 在 Transition 組件中設定

Transition 組件在子 VNode 上設定 `transition` 屬性．

```ts
const Transition = (
  props: TransitionProps,
  { slots }: { slots: any }
): VNode | null => {
  const innerProps = resolveTransitionProps(props);
  const children = slots.default && slots.default();

  if (!children || children.length === 0) {
    return null;
  }

  const child = children[0];
  if (child) {
    // 在 VNode 上設定 transition 鉤子
    child.transition = innerProps;
  }

  return child;
};
```

### 渲染器中的處理

渲染器偵測 VNode 的 `transition` 屬性，並在適當的時機呼叫鉤子：

1. **插入元素時**：`beforeEnter` → DOM 插入 → `enter`
2. **移除元素時**：`leave` → DOM 移除

```ts
// 概念性處理流程
const mountElement = (vnode, container, anchor) => {
  const el = createElement(vnode.type);

  // 如果有 transition，呼叫 beforeEnter
  if (vnode.transition) {
    vnode.transition.beforeEnter(el);
  }

  // 插入 DOM
  insert(el, container, anchor);

  // 如果有 transition，呼叫 enter
  if (vnode.transition) {
    vnode.transition.enter(el);
  }
};

const unmountElement = (vnode) => {
  const el = vnode.el;

  // 如果有 transition，呼叫 leave
  if (vnode.transition) {
    vnode.transition.leave(el, () => {
      // leave 完成後從 DOM 移除
      remove(el);
    });
  } else {
    remove(el);
  }
};
```

## 處理流程

```
Transition 組件 render
  ↓
使用 resolveTransitionProps 生成 TransitionHooks
  ↓
child.transition = innerProps
  ↓
渲染器 mountElement
  ├── beforeEnter(el)
  │   └── 添加 enterFromClass/enterActiveClass
  ├── insert(el, container)
  └── enter(el, done)
      └── 在 nextFrame 中
          ├── 移除 enterFromClass
          ├── 添加 enterToClass
          └── 使用 whenTransitionEnds 等待完成
              └── done() 呼叫 finishEnter

渲染器 unmountElement
  └── transition.leave(el, remove)
      ├── 添加 leaveFromClass
      ├── forceReflow()
      ├── 添加 leaveActiveClass
      └── 在 nextFrame 中
          ├── 移除 leaveFromClass
          ├── 添加 leaveToClass
          └── 使用 whenTransitionEnds 等待完成
              └── remove() 從 DOM 移除
```

## 總結

Transition 的實作由以下元素組成：

1. **CSS 類別管理**：在 enter/leave 的每個階段添加/移除類別
2. **nextFrame**：等待 2 幀以保證過渡觸發
3. **forceReflow**：強制重排以重新計算樣式
4. **whenTransitionEnds**：監聽 transitionend/animationend 事件
5. **JavaScript 鉤子**：支援不使用 CSS 的動畫
6. **VNode.transition**：供渲染器呼叫鉤子的屬性

Transition 與 CSS 過渡/動畫密切配合，其實作基於對瀏覽器渲染管線的深入理解．

<KawaikoNote variant="surprise" title="Transition 完成！">

不僅僅是 CSS 類別操作，還有幀時序控制和重排管理——
這個實作需要深入理解瀏覽器內部機制．
出乎意料地深奧，不是嗎！

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/030_transition)
