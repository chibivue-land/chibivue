/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@monaco-editor/loader" {
  import type * as Monaco from "monaco-editor";

  interface Loader {
    init(): Promise<typeof Monaco>;
    config(options: {
      paths?: { vs?: string };
      "vs/nls"?: { availableLanguages?: Record<string, string> };
    }): void;
  }

  const loader: Loader;
  export default loader;
}
