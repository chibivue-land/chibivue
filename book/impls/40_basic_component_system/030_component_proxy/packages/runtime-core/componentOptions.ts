import type { PropType } from './componentProps'
import type { ComponentPublicInstance } from './componentPublicInstance'
import type { VNode } from './vnode'

export type ComponentOptions<P = {}, B = {}> = {
  props?: P
  setup?: (
    props: InferPropTypes<P>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => (() => VNode) | B
  render?: (ctx: ComponentPublicInstance<InferPropTypes<P>, B>) => VNode
  template?: string
}

type InferPropTypes<T> = { [K in keyof T]: InferPropType<T[K]> }
type InferPropType<T> = T extends { type: PropType<infer U> } ? U : never
