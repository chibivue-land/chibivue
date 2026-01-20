import * as vscode from "vscode";
import * as path from "path";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type { LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";

// ============================================================================
// Extension State
// ============================================================================

let client: LanguageClient | undefined;

// ============================================================================
// Extension Activation
// ============================================================================

export async function activate(context: vscode.ExtensionContext) {
  // Find the language server module
  const serverModule = context.asAbsolutePath(
    path.join("node_modules", "@chibivue", "language-server", "dist", "server.js"),
  );

  // If the server module doesn't exist, try to find it in workspace
  const serverPath = await resolveServerPath(context);

  if (!serverPath) {
    vscode.window.showErrorMessage(
      "Chibivue: Could not find language server. Please install @chibivue/language-server.",
    );
    return;
  }

  // Server options
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"],
      },
    },
  };

  // Get TypeScript SDK path
  const tsdk = await getTsdk();

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "vue" }],
    initializationOptions: {
      typescript: {
        tsdk,
      },
    },
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.vue"),
    },
  };

  // Create the language client
  client = new LanguageClient("chibivue", "Chibivue Language Server", serverOptions, clientOptions);

  // Start the client
  await client.start();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("chibivue.restartServer", async () => {
      await client?.restart();
      vscode.window.showInformationMessage("Chibivue: Language server restarted.");
    }),
  );

  vscode.window.showInformationMessage("Chibivue: Language support activated.");
}

// ============================================================================
// Extension Deactivation
// ============================================================================

export async function deactivate() {
  if (client) {
    await client.stop();
    client = undefined;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve the path to the language server
 */
async function resolveServerPath(context: vscode.ExtensionContext): Promise<string | undefined> {
  // Try extension's node_modules
  const extensionServerPath = context.asAbsolutePath(
    path.join("node_modules", "@chibivue", "language-server", "dist", "server.js"),
  );

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(extensionServerPath));
    return extensionServerPath;
  } catch {
    // Not found in extension
  }

  // Try workspace's node_modules
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const workspaceServerPath = path.join(
        folder.uri.fsPath,
        "node_modules",
        "@chibivue",
        "language-server",
        "dist",
        "server.js",
      );

      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(workspaceServerPath));
        return workspaceServerPath;
      } catch {
        // Not found in this workspace
      }
    }
  }

  return undefined;
}

/**
 * Get TypeScript SDK path
 */
async function getTsdk(): Promise<string | undefined> {
  // Try to get from VSCode settings
  const config = vscode.workspace.getConfiguration("typescript");
  const tsdk = config.get<string>("tsdk");

  if (tsdk) {
    return tsdk;
  }

  // Try workspace's node_modules
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const tsdkPath = path.join(folder.uri.fsPath, "node_modules", "typescript", "lib");

      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(tsdkPath));
        return tsdkPath;
      } catch {
        // Not found
      }
    }
  }

  return undefined;
}
