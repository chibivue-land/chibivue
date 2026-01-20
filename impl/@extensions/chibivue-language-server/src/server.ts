import {
  createConnection,
  createServer,
  createSimpleProject,
  loadTsdkByPath,
} from "@volar/language-server/node";
import type { LanguagePlugin } from "@volar/language-core";
import type {} from "@volar/typescript"; // Module augmentation for typescript property
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";

// ============================================================================
// Chibivue Language Server
// ============================================================================

const connection = createConnection();

const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  // Load TypeScript SDK
  const tsdk = params.initializationOptions?.typescript?.tsdk;
  const ts = tsdk ? loadTsdkByPath(tsdk, params.locale).typescript : require("typescript");

  // Create language plugin for URI-based file identification
  const chibivuePlugin: LanguagePlugin<URI> = {
    getLanguageId(uri: URI): string | undefined {
      if (uri.path.endsWith(".vue")) {
        return "vue";
      }
      return undefined;
    },

    typescript: {
      extraFileExtensions: [
        {
          extension: "vue",
          isMixedContent: true,
          scriptKind: 7, // ts.ScriptKind.Deferred
        },
      ],

      getServiceScript(_rootVirtualCode) {
        return undefined;
      },
    },
  };

  // Create project
  const project = createSimpleProject([chibivuePlugin]);

  // Create TypeScript language service plugins
  const languageServicePlugins = createTypeScriptServices(ts);

  return server.initialize(params, project, languageServicePlugins);
});

connection.onInitialized(() => {
  server.initialized();
});

connection.onShutdown(() => {
  server.shutdown();
});
