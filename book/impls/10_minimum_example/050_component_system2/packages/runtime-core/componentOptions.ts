export type ComponentOptions = {
  props?: Record<string, any>
  setup?: (props: Record<string, any>) => Function
  render?: Function
}
