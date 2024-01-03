import { ComponentOptions } from './componentOptions'
import { ComponentPublicInstanceConstructor } from './componentPublicInstance'

type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
> = ComponentPublicInstanceConstructor<PropsOrPropOptions, RawBindings>

export function defineComponent<PropsOptions, RawBindings>(
  options: ComponentOptions<PropsOptions, RawBindings>,
): DefineComponent<PropsOptions, RawBindings> {
  return options as any
}
