# Transition

## What is Transition?

`<Transition>` is a built-in component for applying animations when showing or hiding elements and components. It works with CSS transitions/animations to achieve smooth UI transitions.

<KawaikoNote variant="question" title="Why is Transition Needed?">

When you toggle element visibility with `v-if`, elements appear and disappear instantly.
With Transition, you can easily add animations
like fade-in/out or slides!

</KawaikoNote>

Main use cases:

1. **Combining with v-if / v-show**: Animations for conditional rendering
2. **Dynamic components**: Switching animations with `<component :is>`
3. **Route transitions**: Transition effects between pages

## Basic Usage

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

## Implementation Overview

### Props Definition

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
  // Lifecycle hooks
  onBeforeEnter?: (el: Element) => void;
  onEnter?: (el: Element, done: () => void) => void;
  onAfterEnter?: (el: Element) => void;
  onEnterCancelled?: (el: Element) => void;
  onBeforeLeave?: (el: Element) => void;
  onLeave?: (el: Element, done: () => void) => void;
  onAfterLeave?: (el: Element) => void;
  onLeaveCancelled?: (el: Element) => void;
  // Appear hooks
  onBeforeAppear?: (el: Element) => void;
  onAppear?: (el: Element, done: () => void) => void;
  onAfterAppear?: (el: Element) => void;
  onAppearCancelled?: (el: Element) => void;
}
```

### TransitionHooks Interface

```ts
export interface TransitionHooks<HostElement = Element> {
  mode: string;
  beforeEnter(el: HostElement): void;
  enter(el: HostElement): void;
  leave(el: HostElement, remove: () => void): void;
  clone(vnode: VNode): TransitionHooks<HostElement>;
}
```

The renderer coordinates with Transition through this interface.

## CSS Class Lifecycle

Transition automatically adds and removes the following CSS classes:

### Enter (Showing Element)

1. **v-enter-from**: Start state. Added before the element is inserted, removed after 1 frame
2. **v-enter-active**: Active state. Applied throughout the entire transition
3. **v-enter-to**: End state. Added 1 frame after start, removed when transition ends

### Leave (Hiding Element)

1. **v-leave-from**: Start state. Added when leave transition starts, removed after 1 frame
2. **v-leave-active**: Active state. Applied throughout the entire transition
3. **v-leave-to**: End state. Added 1 frame after start, removed when transition ends

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

## Core Logic Implementation

### resolveTransitionProps

Parses props and generates TransitionHooks.

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
    // ... other classes
    mode = "default",
  } = rawProps;

  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];

  // Generate hook functions
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
      // leave logic
    },
    clone(vnode) {
      return resolveTransitionProps(rawProps);
    },
  };
}
```

### CSS Class Management

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

The `_vtc` (Vue Transition Classes) property tracks the currently applied transition classes.

### nextFrame

To make CSS transitions work correctly, we wait 2 frames before changing classes.

```ts
function nextFrame(cb: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
```

The first frame allows the browser to recognize the initial state, and the second frame applies the change, ensuring the transition fires reliably.

<KawaikoNote variant="funny" title="Why Wait 2 Frames?">

"Why call `requestAnimationFrame` twice?" you might wonder.
The first call tells the browser "this is the initial state,"
and the second call tells it "this is the end state,"
allowing the browser to recognize the transition!

</KawaikoNote>

### Enter Hook

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

1. Call user-defined hooks
2. After 2 frames, remove the from class and add the to class
3. Detect transition end and complete the process

### Leave Hook

```ts
leave(el, done) {
  const resolve = () => finishLeave(el, done);
  addTransitionClass(el, leaveFromClass);
  // Force reflow
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

## Detecting Transition End

### getTransitionInfo

Gets transition/animation information from CSS.

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

  // Determine whether to use transition or animation
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
    // For animation
  } else {
    // Auto-detect
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0
      ? (transitionTimeout > animationTimeout ? TRANSITION : ANIMATION)
      : null;
  }

  return { type, timeout, propCount, hasTransform };
}
```

### whenTransitionEnds

Executes a callback when the transition ends.

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

  // If explicit timeout is provided, use it
  if (explicitTimeout) {
    return setTimeout(resolveIfNotStale, explicitTimeout);
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
  if (!type) {
    return resolve();
  }

  const endEvent = type + "end"; // "transitionend" or "animationend"
  let ended = 0;

  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };

  // Timeout fallback
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);

  el.addEventListener(endEvent, onEnd);
}
```

Key points:
- Monitors `transitionend` / `animationend` events
- Waits for as many events as there are properties
- Timeout fallback (insurance in case the event doesn't fire)
- `_endId` cancels old transitions

### forceReflow

Forces a reflow to ensure CSS transitions fire reliably.

```ts
export function forceReflow(): number {
  return document.body.offsetHeight;
}
```

Reading `offsetHeight` forces the browser to recalculate styles.

<KawaikoNote variant="warning" title="Why Force a Reflow?">

Even when CSS classes are added consecutively, the browser
may batch style recalculations for optimization.
Reading `offsetHeight` forces it to "calculate now!"

</KawaikoNote>

## Transition Component Body

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
    // Set transition hooks on the VNode
    child.transition = innerProps;
  }

  return child;
};
```

Transition itself doesn't render any DOM elements; it just attaches a `transition` property to the child VNode. The renderer sees this property and calls the hooks.

## Usage Examples

### Basic Fade

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

### Slide Animation

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

### JavaScript Hooks

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
  // Use an animation library like GSAP
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

### Explicit Duration

```vue
<template>
  <!-- enter: 300ms, leave: 500ms -->
  <Transition name="fade" :duration="{ enter: 300, leave: 500 }">
    <p v-if="show">Hello</p>
  </Transition>
</template>
```

## Integration with VNode

### VNode.transition Property

VNode has a `transition` property that stores TransitionHooks.

```ts
// packages/runtime-core/src/vnode.ts
export interface VNode<HostNode = any> {
  // ... other properties

  // transition
  transition: any | null;
}
```

### Setting in Transition Component

The Transition component sets the `transition` property on the child VNode.

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
    // Set transition hooks on the VNode
    child.transition = innerProps;
  }

  return child;
};
```

### Processing in the Renderer

The renderer detects the VNode's `transition` property and calls hooks at appropriate times:

1. **When inserting element**: `beforeEnter` → DOM insertion → `enter`
2. **When removing element**: `leave` → DOM removal

```ts
// Conceptual processing flow
const mountElement = (vnode, container, anchor) => {
  const el = createElement(vnode.type);

  // Call beforeEnter if there's a transition
  if (vnode.transition) {
    vnode.transition.beforeEnter(el);
  }

  // Insert into DOM
  insert(el, container, anchor);

  // Call enter if there's a transition
  if (vnode.transition) {
    vnode.transition.enter(el);
  }
};

const unmountElement = (vnode) => {
  const el = vnode.el;

  // Call leave if there's a transition
  if (vnode.transition) {
    vnode.transition.leave(el, () => {
      // Remove from DOM after leave completes
      remove(el);
    });
  } else {
    remove(el);
  }
};
```

## Processing Flow

```
Transition component render
  ↓
Generate TransitionHooks with resolveTransitionProps
  ↓
child.transition = innerProps
  ↓
Renderer mountElement
  ├── beforeEnter(el)
  │   └── Add enterFromClass/enterActiveClass
  ├── insert(el, container)
  └── enter(el, done)
      └── In nextFrame
          ├── Remove enterFromClass
          ├── Add enterToClass
          └── Wait for completion with whenTransitionEnds
              └── done() calls finishEnter

Renderer unmountElement
  └── transition.leave(el, remove)
      ├── Add leaveFromClass
      ├── forceReflow()
      ├── Add leaveActiveClass
      └── In nextFrame
          ├── Remove leaveFromClass
          ├── Add leaveToClass
          └── Wait for completion with whenTransitionEnds
              └── remove() removes from DOM
```

## Summary

The Transition implementation consists of the following elements:

1. **CSS class management**: Add/remove classes at each phase of enter/leave
2. **nextFrame**: Wait 2 frames to guarantee transition fires
3. **forceReflow**: Force reflow for style recalculation
4. **whenTransitionEnds**: Monitor transitionend/animationend events
5. **JavaScript hooks**: Support for animations without CSS
6. **VNode.transition**: Property for the renderer to call hooks

Transition works closely with CSS transitions/animations and is implemented with a deep understanding of the browser's rendering pipeline.

<KawaikoNote variant="surprise" title="Transition Complete!">

Not just CSS class manipulation, but frame timing control and reflow management too -
this implementation requires a deep understanding of browser internals.
Surprisingly deep, isn't it!

</KawaikoNote>

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/030_transition)
