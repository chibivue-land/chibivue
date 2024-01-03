import { isArray, isIntegerKey } from '../shared'
import { Dep, createDep } from './dep'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined

export type EffectScheduler = (...args: any[]) => any

export const ITERATE_KEY = Symbol()

export class ReactiveEffect<T = any> {
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
  ) {}

  run() {
    let parent: ReactiveEffect | undefined = activeEffect
    activeEffect = this
    const res = this.fn()
    activeEffect = parent
    return res
  }
}

export function track(target: object, key: unknown) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep)
}

export function trackEffects(dep: Dep) {
  if (activeEffect) {
    dep.add(activeEffect)
  }
}

export function trigger(target: object, key?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }
  if (!isArray(target)) {
    deps.push(depsMap.get(ITERATE_KEY))
  } else if (isIntegerKey(key)) {
    // new index added to array -> length changes
    deps.push(depsMap.get('length'))
  }

  for (const dep of deps) {
    if (dep) {
      triggerEffects(dep)
    }
  }
}

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler()
  } else {
    effect.run()
  }
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key)
}
