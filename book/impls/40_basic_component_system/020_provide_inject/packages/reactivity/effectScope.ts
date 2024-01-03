import { ReactiveEffect } from './effect'

let activeEffectScope: EffectScope | undefined

export class EffectScope {
  private _active = true

  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []

  parent: EffectScope | undefined
  scopes: EffectScope[] | undefined

  constructor() {
    this.parent = activeEffectScope
  }

  get active() {
    return this._active
  }

  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    }
  }

  on() {
    activeEffectScope = this
  }

  off() {
    activeEffectScope = this.parent
  }

  stop() {
    if (this._active) {
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop()
        }
      }
      this.parent = undefined
      this._active = false
    }
  }
}

export function effectScope() {
  return new EffectScope()
}

export function recordEffectScope(
  effect: ReactiveEffect,
  scope: EffectScope | undefined = activeEffectScope,
) {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope() {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  }
}
