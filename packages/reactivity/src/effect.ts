import { isArray, isIntegerKey } from "@chibivue/shared";
import { ComputedRefImpl } from "./computed";
import { type Dep, createDep } from "./dep";
import { type EffectScope, recordEffectScope } from "./effectScope";

type KeyToDepMap = Map<any, Dep>;
const targetMap = new WeakMap<any, KeyToDepMap>();

export let activeEffect: ReactiveEffect | undefined;

export type EffectScheduler = (...args: any[]) => any;

export const ITERATE_KEY = Symbol();

export class ReactiveEffect<T = any> {
  active = true;
  parent: ReactiveEffect | undefined = undefined;
  computed?: ComputedRefImpl<T>;

  private deferStop?: boolean;
  onStop?: () => void;

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope);
  }

  run() {
    if (!this.active) {
      return this.fn();
    }

    try {
      this.parent = activeEffect;
      activeEffect = this;
      const res = this.fn();
      return res;
    } finally {
      activeEffect = this.parent;
      this.parent = undefined;
      if (this.deferStop) {
        this.stop();
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

export function track(target: object, key: unknown) {
  console.log("🚀 ~ file: effect.ts:63 ~ track ~ key:", key);
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = createDep()));
  }

  trackEffects(dep);
}

export function trackEffects(dep: Dep) {
  if (activeEffect) {
    dep.add(activeEffect);
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  let deps: (Dep | undefined)[] = [];
  if (key !== void 0) {
    deps.push(depsMap.get(key));
  }

  if (!isArray(target)) {
    deps.push(depsMap.get(ITERATE_KEY));
  } else if (isIntegerKey(key)) {
    deps.push(depsMap.get("length"));
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep);
    }
  }
}

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep];
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect);
    }
  }

  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect);
    }
  }
}

function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler();
  } else {
    effect.run();
  }
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key);
}

export interface ReactiveEffectRunner<T = any> {
  (): T;
  effect: ReactiveEffect;
}

export function effect<T = any>(fn: () => T): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn;
  }

  const _effect = new ReactiveEffect(fn);
  _effect.run();

  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner;
  runner.effect = _effect;
  return runner;
}
