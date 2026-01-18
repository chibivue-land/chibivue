export type ComponentOptions = {
  props?: Record<string, any>;
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function;
  render?: Function;
  template?: string;
};
