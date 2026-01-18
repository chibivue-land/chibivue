import type { VNode } from "@chibivue/runtime-core";

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
  onBeforeEnter?: (el: Element) => void;
  onEnter?: (el: Element, done: () => void) => void;
  onAfterEnter?: (el: Element) => void;
  onEnterCancelled?: (el: Element) => void;
  onBeforeLeave?: (el: Element) => void;
  onLeave?: (el: Element, done: () => void) => void;
  onAfterLeave?: (el: Element) => void;
  onLeaveCancelled?: (el: Element) => void;
  onBeforeAppear?: (el: Element) => void;
  onAppear?: (el: Element, done: () => void) => void;
  onAfterAppear?: (el: Element) => void;
  onAppearCancelled?: (el: Element) => void;
}

export interface TransitionHooks<HostElement = Element> {
  mode: string;
  beforeEnter(el: HostElement): void;
  enter(el: HostElement): void;
  leave(el: HostElement, remove: () => void): void;
  clone(vnode: VNode): TransitionHooks<HostElement>;
}

const TRANSITION = "transition";
const ANIMATION = "animation";

export interface ElementWithTransition extends HTMLElement {
  _vtc?: Set<string>;
}

export function resolveTransitionProps(rawProps: TransitionProps): TransitionProps & TransitionHooks {
  const {
    name = "v",
    type,
    css = true,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    appearFromClass = enterFromClass,
    appearActiveClass = enterActiveClass,
    appearToClass = enterToClass,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
    mode = "default",
    appear = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear = onBeforeEnter,
    onAppear = onEnter,
    onAfterAppear = onAfterEnter,
    onAppearCancelled = onEnterCancelled,
  } = rawProps;

  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];

  const finishEnter = (el: Element & ElementWithTransition, isAppear: boolean, done?: () => void) => {
    removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
    removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
    done && done();
  };

  const finishLeave = (el: Element & ElementWithTransition, done?: () => void) => {
    removeTransitionClass(el, leaveToClass);
    removeTransitionClass(el, leaveActiveClass);
    done && done();
  };

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
      const resolve = () => finishLeave(el, done);
      addTransitionClass(el, leaveFromClass);
      // force reflow
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
    },
    clone(vnode) {
      return resolveTransitionProps(rawProps);
    },
  };
}

function normalizeDuration(duration: TransitionProps["duration"]): [number, number] | null {
  if (duration == null) {
    return null;
  } else if (typeof duration === "object") {
    return [NumberOf(duration.enter), NumberOf(duration.leave)];
  } else {
    const n = NumberOf(duration);
    return [n, n];
  }
}

function NumberOf(val: unknown): number {
  const res = Number(val);
  return isNaN(res) ? 0 : res;
}

export function addTransitionClass(el: Element & ElementWithTransition, cls: string): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  (el._vtc || (el._vtc = new Set())).add(cls);
}

export function removeTransitionClass(el: Element & ElementWithTransition, cls: string): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  const { _vtc } = el;
  if (_vtc) {
    _vtc.delete(cls);
    if (!_vtc.size) {
      el._vtc = undefined;
    }
  }
}

function nextFrame(cb: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

function callHook(hook: ((el: Element, done?: () => void) => void) | undefined, args: any[]): void {
  if (hook) {
    hook(...(args as [any, any]));
  }
}

function hasExplicitCallback(hook: ((el: Element, done: () => void) => void) | undefined): boolean {
  return hook ? hook.length > 1 : false;
}

interface CSSTransitionInfo {
  type: typeof TRANSITION | typeof ANIMATION | null;
  propCount: number;
  timeout: number;
  hasTransform: boolean;
}

export function getTransitionInfo(el: Element, expectedType?: TransitionProps["type"]): CSSTransitionInfo {
  const styles = window.getComputedStyle(el) as CSSStyleDeclaration & {
    webkitTransitionDuration?: string;
    webkitTransitionDelay?: string;
    webkitAnimationDuration?: string;
    webkitAnimationDelay?: string;
  };
  const getStyleProperties = (key: keyof CSSStyleDeclaration) => (styles[key] || "") as string;
  const transitionDelays = getStyleProperties("transitionDelay").split(", ");
  const transitionDurations = getStyleProperties("transitionDuration").split(", ");
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
  const animationDelays = getStyleProperties("animationDelay").split(", ");
  const animationDurations = getStyleProperties("animationDuration").split(", ");
  const animationTimeout = getTimeout(animationDelays, animationDurations);

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
    if (animationTimeout > 0) {
      type = ANIMATION;
      timeout = animationTimeout;
      propCount = animationDurations.length;
    }
  } else {
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0 ? (transitionTimeout > animationTimeout ? TRANSITION : ANIMATION) : null;
    propCount = type ? (type === TRANSITION ? transitionDurations.length : animationDurations.length) : 0;
  }

  const hasTransform =
    type === TRANSITION && /\b(transform|all)(,|$)/.test(getStyleProperties("transitionProperty"));

  return {
    type,
    timeout,
    propCount,
    hasTransform,
  };
}

function getTimeout(delays: string[], durations: string[]): number {
  while (delays.length < durations.length) {
    delays = delays.concat(delays);
  }
  return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
}

function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(",", ".")) * 1000;
}

export function whenTransitionEnds(
  el: Element & { _endId?: number },
  expectedType: TransitionProps["type"] | undefined,
  explicitTimeout: number | null,
  resolve: () => void,
): void {
  const id = (el._endId = ++endId);
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve();
    }
  };

  if (explicitTimeout) {
    return setTimeout(resolveIfNotStale, explicitTimeout);
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
  if (!type) {
    return resolve();
  }

  const endEvent = type + "end";
  let ended = 0;

  const end = () => {
    el.removeEventListener(endEvent, onEnd);
    resolveIfNotStale();
  };

  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };

  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);

  el.addEventListener(endEvent, onEnd);
}

let endId = 0;

export function forceReflow(): number {
  return document.body.offsetHeight;
}

export const TransitionPropsValidators: Record<string, any> = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: true,
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String,
};

const Transition = (props: TransitionProps, { slots }: { slots: any }): VNode | null => {
  const innerProps = resolveTransitionProps(props);
  const children = slots.default && slots.default();

  if (!children || children.length === 0) {
    return null;
  }

  const child = children[0];
  if (child) {
    child.transition = innerProps;
  }

  return child;
};

(Transition as any).displayName = "Transition";
(Transition as any).props = TransitionPropsValidators;

export { Transition };
