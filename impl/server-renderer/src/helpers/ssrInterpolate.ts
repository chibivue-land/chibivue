import { toDisplayString } from "@chibivue/shared";
import { escapeHtml } from "./ssrUtils";

export function ssrInterpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value));
}
