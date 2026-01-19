# Transition

## 什么是 Transition？

`<Transition>` 是一个内置组件，用于在显示或隐藏元素和组件时应用动画．它与 CSS 过渡/动画配合使用，实现平滑的 UI 过渡效果．

<KawaikoNote variant="question" title="为什么需要 Transition？">

当你使用 `v-if` 切换元素的显示/隐藏时，元素会瞬间消失或出现．
使用 Transition，你可以轻松添加淡入/淡出或滑动等动画效果！

</KawaikoNote>

主要用例：

1. **与 v-if / v-show 组合**：条件渲染时的动画
2. **动态组件**：使用 `<component :is>` 时的切换动画
3. **路由过渡**：页面之间的过渡效果

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

## 实现概述

### Props 定义

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
  // 生命周期钩子
  onBeforeEnter?: (el: Element) => void;
  onEnter?: (el: Element, done: () => void) => void;
  onAfterEnter?: (el: Element) => void;
  onEnterCancelled?: (el: Element) => void;
  onBeforeLeave?: (el: Element) => void;
  onLeave?: (el: Element, done: () => void) => void;
  onAfterLeave?: (el: Element) => void;
  onLeaveCancelled?: (el: Element) => void;
  // appear 钩子
  onBeforeAppear?: (el: Element) => void;
  onAppear?: (el: Element, done: () => void) => void;
  onAfterAppear?: (el: Element) => void;
  onAppearCancelled?: (el: Element) => void;
}
```

### TransitionHooks 接口

```ts
export interface TransitionHooks<HostElement = Element> {
  mode: string;
  beforeEnter(el: HostElement): void;
  enter(el: HostElement): void;
  leave(el: HostElement, remove: () => void): void;
  clone(vnode: VNode): TransitionHooks<HostElement>;
}
```

渲染器通过此接口与 Transition 进行协调．

## CSS 类的生命周期

Transition 会自动添加和移除以下 CSS 类：

### Enter（显示元素）

1. **v-enter-from**：开始状态．在元素插入之前添加，1 帧后移除
2. **v-enter-active**：激活状态．在整个过渡期间应用
3. **v-enter-to**：结束状态．开始后 1 帧添加，过渡结束时移除

### Leave（隐藏元素）

1. **v-leave-from**：开始状态．在 leave 过渡开始时添加，1 帧后移除
2. **v-leave-active**：激活状态．在整个过渡期间应用
3. **v-leave-to**：结束状态．开始后 1 帧添加，过渡结束时移除

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

## 核心逻辑实现

### resolveTransitionProps

解析 props 并生成 TransitionHooks．

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
    // ... 其他类
    mode = "default",
  } = rawProps;

  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];

  // 生成钩子函数
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
      // leave 逻辑
    },
    clone(vnode) {
      return resolveTransitionProps(rawProps);
    },
  };
}
```

### CSS 类管理

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

`_vtc`（Vue Transition Classes）属性用于跟踪当前应用的过渡类．

### nextFrame

为了使 CSS 过渡正常工作，我们需要等待 2 帧后再更改类．

```ts
function nextFrame(cb: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
```

第一帧让浏览器识别初始状态，第二帧应用更改，确保过渡可靠触发．

<KawaikoNote variant="funny" title="为什么要等待 2 帧？">

"为什么要调用两次 `requestAnimationFrame`？"你可能会疑惑．
第一次调用告诉浏览器"这是初始状态"，
第二次调用告诉它"这是结束状态"，
这样浏览器才能识别过渡！

</KawaikoNote>

### Enter 钩子

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

1. 调用用户定义的钩子
2. 2 帧后，移除 from 类并添加 to 类
3. 检测过渡结束并完成处理

### Leave 钩子

```ts
leave(el, done) {
  const resolve = () => finishLeave(el, done);
  addTransitionClass(el, leaveFromClass);
  // 强制重排
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

## 检测过渡结束

### getTransitionInfo

从 CSS 获取 transition/animation 信息．

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

  // 确定使用 transition 还是 animation
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
    // animation 的情况
  } else {
    // 自动检测
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0
      ? (transitionTimeout > animationTimeout ? TRANSITION : ANIMATION)
      : null;
  }

  return { type, timeout, propCount, hasTransform };
}
```

### whenTransitionEnds

在过渡结束时执行回调．

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

  // 如果提供了显式超时，则使用它
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

  // 超时回退
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);

  el.addEventListener(endEvent, onEnd);
}
```

要点：
- 监听 `transitionend` / `animationend` 事件
- 等待与属性数量相同的事件
- 超时回退（以防事件未触发的保险）
- `_endId` 取消旧的过渡

### forceReflow

强制重排以确保 CSS 过渡可靠触发．

```ts
export function forceReflow(): number {
  return document.body.offsetHeight;
}
```

读取 `offsetHeight` 强制浏览器重新计算样式．

<KawaikoNote variant="warning" title="为什么要强制重排？">

即使连续添加 CSS 类，浏览器也可能为了优化而批量进行样式重新计算．
读取 `offsetHeight` 可以强制它"立即计算！"

</KawaikoNote>

## Transition 组件主体

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
    // 在 VNode 上设置 transition 钩子
    child.transition = innerProps;
  }

  return child;
};
```

Transition 本身不渲染任何 DOM 元素；它只是在子 VNode 上附加一个 `transition` 属性．渲染器会看到这个属性并调用钩子．

## 使用示例

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

### 滑动动画

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

### JavaScript 钩子

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
  // 使用 GSAP 等动画库
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

### 显式 duration

```vue
<template>
  <!-- enter: 300ms, leave: 500ms -->
  <Transition name="fade" :duration="{ enter: 300, leave: 500 }">
    <p v-if="show">Hello</p>
  </Transition>
</template>
```

## 与 VNode 的集成

### VNode.transition 属性

VNode 有一个 `transition` 属性，用于存储 TransitionHooks．

```ts
// packages/runtime-core/src/vnode.ts
export interface VNode<HostNode = any> {
  // ... 其他属性

  // transition
  transition: any | null;
}
```

### 在 Transition 组件中设置

Transition 组件在子 VNode 上设置 `transition` 属性．

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
    // 在 VNode 上设置 transition 钩子
    child.transition = innerProps;
  }

  return child;
};
```

### 渲染器中的处理

渲染器检测 VNode 的 `transition` 属性，并在适当的时机调用钩子：

1. **插入元素时**：`beforeEnter` → DOM 插入 → `enter`
2. **移除元素时**：`leave` → DOM 移除

```ts
// 概念性处理流程
const mountElement = (vnode, container, anchor) => {
  const el = createElement(vnode.type);

  // 如果有 transition，调用 beforeEnter
  if (vnode.transition) {
    vnode.transition.beforeEnter(el);
  }

  // 插入 DOM
  insert(el, container, anchor);

  // 如果有 transition，调用 enter
  if (vnode.transition) {
    vnode.transition.enter(el);
  }
};

const unmountElement = (vnode) => {
  const el = vnode.el;

  // 如果有 transition，调用 leave
  if (vnode.transition) {
    vnode.transition.leave(el, () => {
      // leave 完成后从 DOM 移除
      remove(el);
    });
  } else {
    remove(el);
  }
};
```

## 处理流程

```
Transition 组件 render
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
              └── done() 调用 finishEnter

渲染器 unmountElement
  └── transition.leave(el, remove)
      ├── 添加 leaveFromClass
      ├── forceReflow()
      ├── 添加 leaveActiveClass
      └── 在 nextFrame 中
          ├── 移除 leaveFromClass
          ├── 添加 leaveToClass
          └── 使用 whenTransitionEnds 等待完成
              └── remove() 从 DOM 移除
```

## 总结

Transition 的实现由以下元素组成：

1. **CSS 类管理**：在 enter/leave 的每个阶段添加/移除类
2. **nextFrame**：等待 2 帧以保证过渡触发
3. **forceReflow**：强制重排以重新计算样式
4. **whenTransitionEnds**：监听 transitionend/animationend 事件
5. **JavaScript 钩子**：支持不使用 CSS 的动画
6. **VNode.transition**：供渲染器调用钩子的属性

Transition 与 CSS 过渡/动画密切配合，其实现基于对浏览器渲染管道的深入理解．

<KawaikoNote variant="surprise" title="Transition 完成！">

不仅仅是 CSS 类操作，还有帧时序控制和重排管理——
这个实现需要深入理解浏览器内部机制．
出乎意料地深奥，不是吗！

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/030_transition)
