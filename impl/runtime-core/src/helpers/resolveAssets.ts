import { isVapor } from "@chibivue/runtime-vapor";
import { camelize, capitalize } from "@chibivue/shared";

import { type ConcreteComponent, currentInstance } from "../component";
import type { ComponentOptions } from "../componentOptions";
import { currentRenderingInstance } from "../componentRenderContext";
import { KeepAlive } from "../components/KeepAlive";

export const COMPONENTS = "components";

export type AssetTypes = typeof COMPONENTS;

// Built-in components that can be resolved by name
const builtInComponents: Record<string, ConcreteComponent> = {
  KeepAlive,
};

export function resolveComponent(name: string): ConcreteComponent | string {
  // Check built-in components first
  if (builtInComponents[name]) {
    return builtInComponents[name];
  }
  return resolveAsset(COMPONENTS, name) || name;
}

function resolveAsset(type: AssetTypes, name: string) {
  const instance = currentRenderingInstance || currentInstance;

  if (instance && !isVapor(instance)) {
    const Component = instance.type;
    const res =
      // local registration
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // global registration
      resolve(instance.appContext[type], name);

    return res;
  }
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))])
  );
}
