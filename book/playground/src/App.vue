<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineComponent, h } from "vue";
import { WebContainer } from "@webcontainer/api";
import loader from "@monaco-editor/loader";
import type * as Monaco from "monaco-editor";
import { chapters } from "./chapters.generated";
import type { Chapter } from "./types";

// State
const selectedChapterId = ref("");
const selectedFile = ref<string | null>(null);
const fileContents = ref<Map<string, string>>(new Map());
const originalContents = ref<Map<string, string>>(new Map());
const modifiedFiles = ref<Set<string>>(new Set());
const terminalOutput = ref<string[]>([]);
const previewUrl = ref("");
const isLoading = ref(false);
const isBooting = ref(false);
const editorContainer = ref<HTMLDivElement | null>(null);
const terminalContainer = ref<HTMLDivElement | null>(null);

let webcontainer: WebContainer | null = null;
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monaco: typeof Monaco | null = null;

// Computed
const selectedChapter = computed(() => chapters.find((c) => c.id === selectedChapterId.value));

const groupedChapters = computed(() => {
  const groups: Record<string, Chapter[]> = {};
  for (const chapter of chapters) {
    if (!groups[chapter.section]) {
      groups[chapter.section] = [];
    }
    groups[chapter.section].push(chapter);
  }
  return groups;
});

const fileTree = computed(() => {
  if (!selectedChapter.value) return [];
  const files = selectedChapter.value.files;
  const tree: { name: string; path: string; isDirectory: boolean; children?: any[] }[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find((item) => item.name === part);

      if (existing) {
        if (!isLast && existing.children) {
          current = existing.children;
        }
      } else {
        const newItem = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isDirectory: !isLast,
          children: isLast ? undefined : [],
        };
        current.push(newItem);
        if (!isLast) {
          current = newItem.children!;
        }
      }
    }
  }

  return tree;
});

// Storage key for persisting edits
const storageKey = computed(() => `chibivue-playground-${selectedChapterId.value}`);

// Methods
function loadFromStorage() {
  if (!selectedChapterId.value) return;
  try {
    const saved = localStorage.getItem(storageKey.value);
    if (saved) {
      const data = JSON.parse(saved);
      fileContents.value = new Map(Object.entries(data.files || {}));
      modifiedFiles.value = new Set(data.modified || []);
    }
  } catch (e) {
    console.error("Failed to load from storage:", e);
  }
}

function saveToStorage() {
  if (!selectedChapterId.value) return;
  try {
    const data = {
      files: Object.fromEntries(fileContents.value),
      modified: Array.from(modifiedFiles.value),
    };
    localStorage.setItem(storageKey.value, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to storage:", e);
  }
}

function clearStorage() {
  if (!selectedChapterId.value) return;
  localStorage.removeItem(storageKey.value);
}

async function selectChapter(chapterId: string) {
  if (selectedChapterId.value === chapterId) return;

  selectedChapterId.value = chapterId;
  selectedFile.value = null;
  fileContents.value.clear();
  originalContents.value.clear();
  modifiedFiles.value.clear();
  terminalOutput.value = [];
  previewUrl.value = "";

  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return;

  // Load original contents
  for (const file of chapter.files) {
    originalContents.value.set(file.path, file.content);
    fileContents.value.set(file.path, file.content);
  }

  // Load saved edits from storage
  loadFromStorage();

  // Select first non-directory file
  const firstFile = chapter.files.find((f) => !f.path.includes("/") || f.path.split("/").length <= 2);
  if (firstFile) {
    selectFile(firstFile.path);
  }
}

async function selectFile(path: string) {
  selectedFile.value = path;
  await nextTick();
  updateEditor();
}

function updateEditor() {
  if (!editor || !monaco || !selectedFile.value) return;

  const content = fileContents.value.get(selectedFile.value) || "";
  const ext = selectedFile.value.split(".").pop() || "";

  const languageMap: Record<string, string> = {
    ts: "typescript",
    js: "javascript",
    vue: "html",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
  };

  const language = languageMap[ext] || "plaintext";

  editor.setValue(content);
  monaco.editor.setModelLanguage(editor.getModel()!, language);
}

function onEditorChange(value: string) {
  if (!selectedFile.value) return;

  fileContents.value.set(selectedFile.value, value);

  const original = originalContents.value.get(selectedFile.value);
  if (value !== original) {
    modifiedFiles.value.add(selectedFile.value);
  } else {
    modifiedFiles.value.delete(selectedFile.value);
  }

  saveToStorage();
}

function resetFile() {
  if (!selectedFile.value) return;

  const original = originalContents.value.get(selectedFile.value);
  if (original !== undefined) {
    fileContents.value.set(selectedFile.value, original);
    modifiedFiles.value.delete(selectedFile.value);
    updateEditor();
    saveToStorage();
  }
}

function resetAllFiles() {
  if (!selectedChapter.value) return;

  for (const file of selectedChapter.value.files) {
    fileContents.value.set(file.path, file.content);
  }
  modifiedFiles.value.clear();
  clearStorage();
  updateEditor();
}

async function bootWebContainer() {
  if (isBooting.value) return;

  isBooting.value = true;
  terminalOutput.value = ["Booting WebContainer..."];

  try {
    if (!webcontainer) {
      webcontainer = await WebContainer.boot();
    }

    // Mount files
    const files: Record<string, any> = {};
    for (const [path, content] of fileContents.value) {
      const parts = path.split("/");
      let current = files;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      current[parts[parts.length - 1]] = { file: { contents: content } };
    }

    await webcontainer.mount(files);
    terminalOutput.value.push("Files mounted successfully");

    // Install dependencies
    terminalOutput.value.push("Installing dependencies...");
    const installProcess = await webcontainer.spawn("npm", ["install"]);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminalOutput.value.push(data);
        },
      }),
    );

    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error(`Install failed with exit code ${installExitCode}`);
    }

    terminalOutput.value.push("Dependencies installed");

    // Start dev server
    terminalOutput.value.push("Starting dev server...");
    const devProcess = await webcontainer.spawn("npm", ["run", "dev"]);

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminalOutput.value.push(data);
        },
      }),
    );

    // Wait for server ready
    webcontainer.on("server-ready", (_port, url) => {
      previewUrl.value = url;
      terminalOutput.value.push(`Server ready at ${url}`);
    });
  } catch (e) {
    terminalOutput.value.push(`Error: ${e}`);
    console.error(e);
  } finally {
    isBooting.value = false;
  }
}

async function applyChanges() {
  if (!webcontainer || modifiedFiles.value.size === 0) return;

  isLoading.value = true;
  terminalOutput.value.push("Applying changes...");

  try {
    for (const path of modifiedFiles.value) {
      const content = fileContents.value.get(path);
      if (content !== undefined) {
        await webcontainer.fs.writeFile(path, content);
        terminalOutput.value.push(`Updated: ${path}`);
      }
    }
    terminalOutput.value.push("Changes applied. Hot reload should trigger.");
  } catch (e) {
    terminalOutput.value.push(`Error applying changes: ${e}`);
  } finally {
    isLoading.value = false;
  }
}

// FileTreeItem component (inline)
const FileTreeItem = defineComponent({
  name: "FileTreeItem",
  props: {
    item: { type: Object, required: true },
    selectedFile: { type: String, default: null },
    modifiedFiles: { type: Set, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ["select"],
  setup(props, { emit }) {
    return () => {
      const item = props.item as any;
      const isSelected = props.selectedFile === item.path;
      const isModified = (props.modifiedFiles as Set<string>).has(item.path);

      if (item.isDirectory) {
        return h("div", { class: "tree-directory" }, [
          h("div", { class: "tree-item directory", style: { paddingLeft: `${props.depth * 12}px` } }, [
            h("span", { class: "folder-icon" }, "\u{1F4C1}"),
            h("span", item.name),
          ]),
          ...(item.children || []).map((child: any) =>
            h(FileTreeItem, {
              item: child,
              selectedFile: props.selectedFile,
              modifiedFiles: props.modifiedFiles,
              depth: props.depth + 1,
              onSelect: (path: string) => emit("select", path),
            }),
          ),
        ]);
      }

      return h(
        "div",
        {
          class: ["tree-item", "file", { selected: isSelected, modified: isModified }],
          style: { paddingLeft: `${props.depth * 12 + 8}px` },
          onClick: () => emit("select", item.path),
        },
        [
          h("span", { class: "file-icon" }, "\u{1F4C4}"),
          h("span", item.name),
          isModified ? h("span", { class: "modified-dot" }, "\u2022") : null,
        ],
      );
    };
  },
});

// Lifecycle
onMounted(async () => {
  // Initialize Monaco
  monaco = await loader.init();

  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: "",
      language: "typescript",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      wordWrap: "on",
    });

    editor.onDidChangeModelContent(() => {
      onEditorChange(editor!.getValue());
    });
  }

  // Select first chapter if available
  if (chapters.length > 0) {
    await selectChapter(chapters[0].id);
  }
});

onUnmounted(() => {
  editor?.dispose();
  webcontainer?.teardown();
});

// Auto-scroll terminal
watch(terminalOutput, async () => {
  await nextTick();
  if (terminalContainer.value) {
    terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
  }
});
</script>

<template>
  <div class="playground">
    <!-- Header -->
    <header class="playground-header">
      <div class="header-left">
        <h1 class="logo">chibivue Playground</h1>
        <div class="chapter-selector">
          <select :value="selectedChapterId" @change="selectChapter(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Select a chapter</option>
            <optgroup v-for="(chapterList, section) in groupedChapters" :key="section" :label="section">
              <option v-for="chapter in chapterList" :key="chapter.id" :value="chapter.id">
                {{ chapter.name }}
              </option>
            </optgroup>
          </select>
        </div>
      </div>

      <div class="actions">
        <button @click="bootWebContainer" :disabled="!selectedChapterId || isBooting" class="btn btn-primary">
          {{ isBooting ? "Booting..." : previewUrl ? "Restart" : "Run" }}
        </button>
        <button @click="applyChanges" :disabled="!previewUrl || modifiedFiles.size === 0 || isLoading" class="btn">
          Apply Changes
        </button>
        <button @click="resetAllFiles" :disabled="!selectedChapterId || modifiedFiles.size === 0" class="btn btn-danger">
          Reset All
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="playground-content">
      <!-- File explorer -->
      <aside class="file-explorer">
        <div class="file-explorer-header">Files</div>
        <div class="file-tree">
          <template v-for="item in fileTree" :key="item.path">
            <FileTreeItem
              :item="item"
              :selected-file="selectedFile"
              :modified-files="modifiedFiles"
              @select="selectFile"
            />
          </template>
        </div>
      </aside>

      <!-- Editor -->
      <main class="editor-panel">
        <div class="editor-header">
          <span v-if="selectedFile">
            {{ selectedFile }}
            <span v-if="modifiedFiles.has(selectedFile)" class="modified-indicator">*</span>
          </span>
          <span v-else class="no-file">No file selected</span>
          <button
            v-if="selectedFile && modifiedFiles.has(selectedFile)"
            @click="resetFile"
            class="btn btn-small"
          >
            Reset
          </button>
        </div>
        <div ref="editorContainer" class="editor-container"></div>
      </main>

      <!-- Preview & Terminal -->
      <aside class="preview-panel">
        <div class="preview-container">
          <div class="preview-header">Preview</div>
          <iframe v-if="previewUrl" :src="previewUrl" class="preview-frame"></iframe>
          <div v-else class="preview-placeholder">
            Click "Run" to start the development server
          </div>
        </div>

        <div class="terminal-container">
          <div class="terminal-header">Terminal</div>
          <div ref="terminalContainer" class="terminal-output">
            <div v-for="(line, index) in terminalOutput" :key="index" class="terminal-line">
              {{ line }}
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.playground-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

.chapter-selector select {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 300px;
  font-size: 14px;
  cursor: pointer;
}

.chapter-selector select:focus {
  outline: none;
  border-color: var(--accent);
}

.actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: var(--border);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-danger {
  color: var(--accent);
  border-color: var(--accent);
}

.btn-danger:hover:not(:disabled) {
  background: var(--accent);
  color: white;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.playground-content {
  display: grid;
  grid-template-columns: 220px 1fr 420px;
  flex: 1;
  overflow: hidden;
}

.file-explorer {
  border-right: 1px solid var(--border);
  overflow: auto;
  background: var(--bg-secondary);
}

.file-explorer-header,
.editor-header,
.preview-header,
.terminal-header {
  padding: 10px 14px;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.file-tree {
  padding: 8px 0;
}

:deep(.tree-item) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s;
}

:deep(.tree-item.file:hover) {
  background: var(--bg-tertiary);
}

:deep(.tree-item.selected) {
  background: var(--accent);
  color: white;
}

:deep(.tree-item.modified) {
  color: var(--warning);
}

:deep(.tree-item.selected.modified) {
  color: white;
}

:deep(.file-icon),
:deep(.folder-icon) {
  font-size: 14px;
}

:deep(.modified-dot) {
  color: var(--warning);
  margin-left: 4px;
  font-weight: bold;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.no-file {
  font-style: italic;
}

.modified-indicator {
  color: var(--warning);
  margin-left: 4px;
}

.editor-container {
  flex: 1;
  min-height: 0;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
}

.preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preview-frame {
  flex: 1;
  border: none;
  background: white;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 20px;
  text-align: center;
}

.terminal-container {
  height: 220px;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}

.terminal-output {
  flex: 1;
  overflow: auto;
  padding: 10px 14px;
  background: #0d0d0d;
  font-family: "Fira Code", "Consolas", "Monaco", monospace;
  font-size: 12px;
  color: #00ff00;
}

.terminal-line {
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
</style>
