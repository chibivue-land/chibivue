import type { ObjectDirective } from "@chibivue/runtime-core";

export const vShow: ObjectDirective<HTMLElement> = {
  beforeMount(el, { value }, { transition }) {
    el._vod = el.style.display === "none" ? "" : el.style.display;
    if (transition && value) {
      transition.beforeEnter(el);
    } else {
      setDisplay(el, value);
    }
  },
  mounted(el, { value }, { transition }) {
    if (transition && value) {
      transition.enter(el);
    }
  },
  updated(el, { value, oldValue }, { transition }) {
    if (!value === !oldValue) return;
    if (transition) {
      if (value) {
        transition.beforeEnter(el);
        setDisplay(el, true);
        transition.enter(el);
      } else {
        transition.leave(el, () => {
          setDisplay(el, false);
        });
      }
    } else {
      setDisplay(el, value);
    }
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value);
  },
};

function setDisplay(el: HTMLElement, value: unknown): void {
  el.style.display = value ? el._vod : "none";
}

declare global {
  interface HTMLElement {
    _vod: string;
  }
}
