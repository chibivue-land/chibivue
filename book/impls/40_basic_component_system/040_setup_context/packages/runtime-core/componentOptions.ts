import { SetupContext } from './component'
import { PropType } from './componentProps'
import { ComponentPublicInstance } from './componentPublicInstance'
import { VNode } from './vnode'

export type ComponentOptions<P = {}, B = {}> = {
  props?: P
  setup?: (props: InferPropTypes<P>, ctx: SetupContext) => (() => VNode) | B
  render?: (ctx: ComponentPublicInstance<InferPropTypes<P>, B>) => VNode
  template?: string
}

type InferPropTypes<T> = { [K in keyof T]: InferPropType<T[K]> }
type InferPropType<T> = T extends { type: PropType<infer U> } ? U : never
