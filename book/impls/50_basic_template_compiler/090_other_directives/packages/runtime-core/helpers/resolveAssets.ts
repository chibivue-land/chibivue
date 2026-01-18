import { camelize, capitalize } from "../../shared";
import { type ConcreteComponent, currentInstance } from "../component";
import type { ComponentOptions } from "../componentOptions";
import { currentRenderingInstance } from "../componentRenderContext";

export function resolveComponent(name: string): ConcreteComponent | string {
  const instance = currentInstance || currentRenderingInstance;
  if (instance) {
    const Component = instance.type;
    const res =
      // local registration
      resolve((Component as ComponentOptions).components, name) ||
      // global registration
      resolve(instance.appContext.components, name);
    return res;
  }

  return name;
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))])
  );
}
