import type { Dep } from "./dep";
import { ReactiveEffect } from "./effect";
import { type Ref, trackRefValue, triggerRefValue } from "./ref";

declare const ComputedRefSymbol: unique symbol;

export interface ComputedRef<T = any> extends Ref {
  readonly value: T;
  [ComputedRefSymbol]: true;
}

type ComputedGetter<T> = (...args: any[]) => T;

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined;

  private _value!: T;
  public readonly effect: ReactiveEffect<T>;

  public readonly __v_isRef = true;
  public _dirty = true;

  constructor(getter: ComputedGetter<T>) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true;
        triggerRefValue(this);
      }
    });
  }

  get value() {
    trackRefValue(this);
    if (this._dirty) {
      this._dirty = false;
      this._value = this.effect.run();
    }
    return this._value;
  }

  set value(_newValue: T) {}
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T> {
  return new ComputedRefImpl(getter) as any;
}
