import { type ComponentOptions, Fragment, h, inject } from "chibivue";
import { routerViewLocationKey } from "./injectionSymbols";

export const RouterViewImpl: ComponentOptions = {
  name: "RouterView",
  setup() {
    const injectedRoute = inject(routerViewLocationKey)!;

    return () => {
      const ViewComponent = injectedRoute.value.component;

      // NOTE: wrap in Fragment to render by patch children:
      // prettier-ignore
      const component = h(Fragment, [h(ViewComponent, { key: injectedRoute.value.fullPath }),]);

      return component;
    };
  },
};
