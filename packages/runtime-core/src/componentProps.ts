import { reactive } from '@chibivue/reactivity'
import { camelize, hasOwn, isReservedProp } from '@chibivue/shared'
import type { ComponentInternalInstance, Data } from './component'

export type NormalizedProps = Record<string, PropOptions | null>
export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: null | undefined | object
}
export type PropType<T> = { new (...args: any[]): T & {} } | { (): T }

export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const props: Data = {}
  setFullProps(instance, rawProps, props)
  instance.props = reactive(props)
}

export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const { props } = instance
  Object.entries(rawProps ?? {}).forEach(([key, value]) => {
    props[camelize(key)] = value
  })
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      // skip reserved properties (eg. ref, key)
      if (isReservedProp(key)) continue

      const value = rawProps[key]
      // kebab -> camel
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        props[camelKey] = value
      }
    }
  }
}
