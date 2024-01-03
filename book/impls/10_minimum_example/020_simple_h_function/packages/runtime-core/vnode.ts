export interface VNode {
  type: string
  props: VNodeProps
  children: (VNode | string)[]
}

export interface VNodeProps {
  [key: string]: any
}
