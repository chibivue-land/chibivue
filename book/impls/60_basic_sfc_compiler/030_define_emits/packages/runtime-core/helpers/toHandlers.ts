import { toHandlerKey } from "../../shared";

/**
 * For prefixing keys in v-on="obj" with "on"
 */
export function toHandlers(obj: Record<string, any>): Record<string, any> {
  const ret: Record<string, any> = {};
  for (const key in obj) {
    ret[toHandlerKey(key)] = obj[key];
  }
  return ret;
}
