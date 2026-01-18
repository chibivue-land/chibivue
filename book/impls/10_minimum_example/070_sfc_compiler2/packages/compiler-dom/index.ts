import { baseCompile, baseParse } from "../compiler-core";

export function compile(template: string) {
  return baseCompile(template);
}

export function parse(template: string) {
  return baseParse(template);
}
