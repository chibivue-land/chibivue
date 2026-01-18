export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;
