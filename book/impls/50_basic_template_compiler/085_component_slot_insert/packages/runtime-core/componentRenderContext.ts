import type { ComponentInternalInstance } from "./component";

export let currentRenderingInstance: ComponentInternalInstance | null = null;

export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance;
  currentRenderingInstance = instance;
  return prev;
}

export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance,
) {
  if (!ctx) return fn;

  const renderFnWithContext = (...args: any[]) => {
    const prevInstance = setCurrentRenderingInstance(ctx);
    try {
      return fn(...args);
    } finally {
      setCurrentRenderingInstance(prevInstance);
    }
  };

  return renderFnWithContext;
}
