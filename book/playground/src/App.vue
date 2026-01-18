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
const consoleOutput = ref<{ type: string; message: string; timestamp: Date }[]>([]);
const activeTab = ref<'terminal' | 'console'>('terminal');
const previewUrl = ref("");
const previewIframe = ref<HTMLIFrameElement | null>(null);
const isLoading = ref(false);
const isBooting = ref(false);
const isInitializing = ref(true);
const editorContainer = ref<HTMLDivElement | null>(null);
const terminalContainer = ref<HTMLDivElement | null>(null);
const consoleContainer = ref<HTMLDivElement | null>(null);
const expandedDirs = ref<Set<string>>(new Set());
const sidebarWidth = ref(240);
const terminalHeight = ref(200);
const isResizingSidebar = ref(false);
const isResizingTerminal = ref(false);

let webcontainer: WebContainer | null = null;
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monaco: typeof Monaco | null = null;

// Clean terminal output - strip TUI control sequences
function cleanTerminalOutput(text: string): string {
  return text
    // Remove cursor movement and screen clearing
    .replace(/\x1b\[\d*[ABCDEFGJKST]/g, '')
    .replace(/\x1b\[\d*;\d*[Hf]/g, '')
    .replace(/\x1b\[\??\d*[hl]/g, '')
    .replace(/\x1b\[[\d;]*m/g, '') // Remove all color codes for clean output
    .replace(/\x1b\]\d*;[^\x07]*\x07/g, '') // OSC sequences
    .replace(/\x1b\[[\d;]*[A-Za-z]/g, '') // Any remaining CSI
    .replace(/\x1b[78]/g, '') // Save/restore cursor
    .replace(/\r/g, '') // Carriage returns
    .replace(/\x07/g, '') // Bell
    .trim();
}

// ANSI to HTML conversion with full color support
function ansiToHtml(text: string): string {
  // First clean up TUI sequences
  const cleaned = cleanTerminalOutput(text);
  if (!cleaned) return '';

  return cleaned;
}

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
  expandedDirs.value.clear();

  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return;

  for (const file of chapter.files) {
    originalContents.value.set(file.path, file.content);
    fileContents.value.set(file.path, file.content);
  }

  loadFromStorage();

  for (const file of chapter.files) {
    const firstDir = file.path.split("/")[0];
    if (firstDir !== file.path) {
      expandedDirs.value.add(firstDir);
    }
  }

  const firstFile = chapter.files.find((f) => !f.path.includes("/") || f.path.split("/").length <= 2);
  if (firstFile) {
    selectFile(firstFile.path);
  }
}

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path);
  } else {
    expandedDirs.value.add(path);
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

    terminalOutput.value.push("Installing dependencies with pnpm...");
    const installProcess = await webcontainer.spawn("pnpm", ["install", "--prefer-offline"]);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          const cleaned = cleanTerminalOutput(data);
          if (cleaned && !cleaned.includes('Progress:')) {
            terminalOutput.value.push(cleaned);
          }
        },
      }),
    );

    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error(`Install failed with exit code ${installExitCode}`);
    }

    terminalOutput.value.push("Starting dev server...");
    const devProcess = await webcontainer.spawn("pnpm", ["run", "dev"]);

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          const cleaned = cleanTerminalOutput(data);
          if (cleaned) {
            terminalOutput.value.push(cleaned);
          }
        },
      }),
    );

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
    terminalOutput.value.push("Changes applied. HMR should trigger.");
  } catch (e) {
    terminalOutput.value.push(`Error: ${e}`);
  } finally {
    isLoading.value = false;
  }
}

// Resize handlers
function startResizeSidebar(e: MouseEvent) {
  isResizingSidebar.value = true;
  document.addEventListener('mousemove', resizeSidebar);
  document.addEventListener('mouseup', stopResizeSidebar);
  e.preventDefault();
}

function resizeSidebar(e: MouseEvent) {
  if (isResizingSidebar.value) {
    sidebarWidth.value = Math.max(180, Math.min(400, e.clientX));
  }
}

function stopResizeSidebar() {
  isResizingSidebar.value = false;
  document.removeEventListener('mousemove', resizeSidebar);
  document.removeEventListener('mouseup', stopResizeSidebar);
}

function startResizeTerminal(e: MouseEvent) {
  isResizingTerminal.value = true;
  document.addEventListener('mousemove', resizeTerminal);
  document.addEventListener('mouseup', stopResizeTerminal);
  e.preventDefault();
}

function resizeTerminal(e: MouseEvent) {
  if (isResizingTerminal.value) {
    const containerRect = document.querySelector('.playground-main')?.getBoundingClientRect();
    if (containerRect) {
      terminalHeight.value = Math.max(100, Math.min(400, containerRect.bottom - e.clientY));
    }
  }
}

function stopResizeTerminal() {
  isResizingTerminal.value = false;
  document.removeEventListener('mousemove', resizeTerminal);
  document.removeEventListener('mouseup', stopResizeTerminal);
}

// FileTreeItem component
const FileTreeItem = defineComponent({
  name: "FileTreeItem",
  props: {
    item: { type: Object, required: true },
    selectedFile: { type: String, default: null },
    modifiedFiles: { type: Set, required: true },
    expandedDirs: { type: Set, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ["select", "toggle"],
  setup(props, { emit }) {
    return () => {
      const item = props.item as any;
      const isSelected = props.selectedFile === item.path;
      const isModified = (props.modifiedFiles as Set<string>).has(item.path);
      const isExpanded = (props.expandedDirs as Set<string>).has(item.path);

      const getFileIcon = (name: string) => {
        if (name.endsWith('.vue')) return { icon: 'V', class: 'icon-vue' };
        if (name.endsWith('.ts')) return { icon: 'T', class: 'icon-ts' };
        if (name.endsWith('.js')) return { icon: 'J', class: 'icon-js' };
        if (name.endsWith('.json')) return { icon: '{', class: 'icon-json' };
        if (name.endsWith('.css')) return { icon: '#', class: 'icon-css' };
        if (name.endsWith('.html')) return { icon: '<', class: 'icon-html' };
        return { icon: 'f', class: 'icon-default' };
      };

      if (item.isDirectory) {
        return h("div", { class: "tree-directory" }, [
          h("div", {
            class: "tree-item directory",
            style: { paddingLeft: `${props.depth * 14 + 8}px` },
            onClick: () => emit("toggle", item.path),
          }, [
            h("span", { class: ["chevron", { expanded: isExpanded }] }),
            h("span", { class: "folder-icon" }),
            h("span", { class: "item-name" }, item.name),
          ]),
          isExpanded
            ? (item.children || []).map((child: any) =>
                h(FileTreeItem, {
                  item: child,
                  selectedFile: props.selectedFile,
                  modifiedFiles: props.modifiedFiles,
                  expandedDirs: props.expandedDirs,
                  depth: props.depth + 1,
                  onSelect: (path: string) => emit("select", path),
                  onToggle: (path: string) => emit("toggle", path),
                }),
              )
            : null,
        ]);
      }

      const fileIcon = getFileIcon(item.name);
      return h(
        "div",
        {
          class: ["tree-item", "file", { selected: isSelected, modified: isModified }],
          style: { paddingLeft: `${props.depth * 14 + 24}px` },
          onClick: () => emit("select", item.path),
        },
        [
          h("span", { class: ["file-icon-badge", fileIcon.class] }, fileIcon.icon),
          h("span", { class: "item-name" }, item.name),
          isModified ? h("span", { class: "modified-badge" }) : null,
        ],
      );
    };
  },
});

// Initialize editor after DOM is ready
async function initEditor() {
  if (!monaco || !editorContainer.value || editor) return;

  editor = monaco.editor.create(editorContainer.value, {
    value: "",
    language: "typescript",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    padding: { top: 12 },
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    renderLineHighlight: 'gutter',
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
  });

  editor.onDidChangeModelContent(() => {
    onEditorChange(editor!.getValue());
  });

  // Update editor with current file content
  updateEditor();
}

// Lifecycle
onMounted(async () => {
  monaco = await loader.init();

  if (chapters.length > 0) {
    await selectChapter(chapters[0].id);
  }

  isInitializing.value = false;

  // Wait for DOM to render, then init editor
  await nextTick();
  await initEditor();
});

onUnmounted(() => {
  editor?.dispose();
  webcontainer?.teardown();
});

watch(terminalOutput, async () => {
  await nextTick();
  if (terminalContainer.value) {
    terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
  }
});
</script>

<template>
  <!-- Loading Overlay -->
  <div v-if="isInitializing" class="loading-overlay">
    <div class="loading-content">
      <img src="/kawaiko.png" alt="chibivue" class="loading-logo" />
      <div class="loading-spinner-container">
        <div class="loading-spinner"></div>
      </div>
      <p class="loading-text">Initializing Playground...</p>
    </div>
  </div>

  <div v-else class="playground">
    <!-- Header -->
    <header class="playground-header">
      <div class="header-brand">
        <img src="/kawaiko.png" alt="chibivue" class="brand-logo" />
        <div class="brand-text">
          <h1 class="brand-title">chibivue</h1>
          <span class="brand-subtitle">Playground</span>
        </div>
      </div>

      <div class="header-center">
        <div class="chapter-selector">
          <select :value="selectedChapterId" @change="selectChapter(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Select a chapter...</option>
            <optgroup v-for="(chapterList, section) in groupedChapters" :key="section" :label="section">
              <option v-for="chapter in chapterList" :key="chapter.id" :value="chapter.id">
                {{ chapter.name }}
              </option>
            </optgroup>
          </select>
        </div>

        <div v-if="selectedChapter" class="chapter-links">
          <a :href="selectedChapter.bookUrl" target="_blank" class="link-btn link-book">
            <span class="link-icon">📖</span>
            Book
          </a>
          <a v-if="selectedChapter.vueDocUrl" :href="selectedChapter.vueDocUrl" target="_blank" class="link-btn link-vue">
            <span class="link-icon">📗</span>
            Vue Docs
          </a>
        </div>
      </div>

      <div class="header-actions">
        <button @click="bootWebContainer" :disabled="!selectedChapterId || isBooting" class="btn btn-run">
          <span v-if="isBooting" class="btn-spinner"></span>
          <span v-else class="btn-icon">▶</span>
          {{ isBooting ? "Starting..." : previewUrl ? "Restart" : "Run" }}
        </button>
        <button @click="applyChanges" :disabled="!previewUrl || modifiedFiles.size === 0 || isLoading" class="btn btn-apply">
          <span class="btn-icon">⟳</span>
          Apply
        </button>
        <button @click="resetAllFiles" :disabled="!selectedChapterId || modifiedFiles.size === 0" class="btn btn-reset">
          <span class="btn-icon">↺</span>
          Reset
        </button>
      </div>
    </header>

    <!-- Main content -->
    <div class="playground-main">
      <div class="main-panels">
        <!-- File explorer -->
        <aside class="file-explorer" :style="{ width: `${sidebarWidth}px` }">
          <div class="panel-header">
            <span class="panel-title">Explorer</span>
            <span class="file-count" v-if="selectedChapter">{{ selectedChapter.files.length }} files</span>
          </div>
          <div class="file-tree">
            <template v-for="item in fileTree" :key="item.path">
              <FileTreeItem
                :item="item"
                :selected-file="selectedFile"
                :modified-files="modifiedFiles"
                :expanded-dirs="expandedDirs"
                @select="selectFile"
                @toggle="toggleDir"
              />
            </template>
          </div>
        </aside>

        <!-- Sidebar resize handle -->
        <div class="resize-handle-vertical" @mousedown="startResizeSidebar"></div>

        <!-- Editor -->
        <main class="editor-panel">
          <div class="panel-header editor-header">
            <div class="tab-bar" v-if="selectedFile">
              <div class="tab active">
                <span class="tab-name">{{ selectedFile.split('/').pop() }}</span>
                <span v-if="modifiedFiles.has(selectedFile)" class="tab-modified"></span>
              </div>
            </div>
            <div v-else class="tab-bar-empty">No file selected</div>
            <button
              v-if="selectedFile && modifiedFiles.has(selectedFile)"
              @click="resetFile"
              class="btn btn-tiny"
            >
              Reset File
            </button>
          </div>
          <div ref="editorContainer" class="editor-container"></div>
        </main>

        <!-- Preview -->
        <aside class="preview-panel">
          <div class="panel-header">
            <span class="panel-title">Preview</span>
            <span v-if="previewUrl" class="preview-url">{{ previewUrl }}</span>
          </div>
          <div class="preview-content">
            <iframe v-if="previewUrl" :src="previewUrl" class="preview-frame"></iframe>
            <div v-else class="preview-placeholder">
              <img src="/kawaiko.png" alt="chibivue" class="placeholder-logo" />
              <p class="placeholder-text">Select a chapter and click <strong>Run</strong> to start</p>
            </div>
          </div>
        </aside>
      </div>

      <!-- Terminal resize handle -->
      <div class="resize-handle-horizontal" @mousedown="startResizeTerminal"></div>

      <!-- Terminal -->
      <div class="terminal-panel" :style="{ height: `${terminalHeight}px` }">
        <div class="panel-header terminal-header">
          <span class="panel-title">Terminal</span>
          <div class="terminal-actions">
            <button @click="terminalOutput = []" class="terminal-btn" title="Clear">
              <span>Clear</span>
            </button>
          </div>
        </div>
        <div ref="terminalContainer" class="terminal-output">
          <div
            v-for="(line, index) in terminalOutput"
            :key="index"
            class="terminal-line"
            v-html="ansiToHtml(line)"
          ></div>
          <div v-if="terminalOutput.length === 0" class="terminal-empty">
            Ready. Click Run to start the dev server...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Loading Overlay */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--c-navy-900) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
}

.loading-logo {
  width: 100px;
  height: 100px;
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.loading-spinner-container {
  margin: 20px auto;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 16px;
}

/* Main Layout */
.playground {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
}

/* Header */
.playground-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 36px;
  height: 36px;
  transition: transform 0.3s ease;
}

.brand-logo:hover {
  transform: scale(1.1) rotate(5deg);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chapter-selector select {
  padding: 8px 36px 8px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 280px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a9fb0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.chapter-selector select:hover {
  border-color: var(--c-mint-600);
}

.chapter-selector select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.chapter-links {
  display: flex;
  gap: 8px;
}

.link-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}

.link-book {
  background: var(--accent-soft);
  color: var(--accent);
}

.link-book:hover {
  background: var(--c-mint-600);
  color: white;
}

.link-vue {
  background: rgba(66, 184, 131, 0.15);
  color: #42b883;
}

.link-vue:hover {
  background: #42b883;
  color: white;
}

.link-icon {
  font-size: 14px;
}

/* Actions */
.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 14px;
}

.btn-run {
  background: linear-gradient(135deg, var(--c-mint-500) 0%, var(--c-mint-600) 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(26, 179, 148, 0.3);
}

.btn-run:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--c-mint-400) 0%, var(--c-mint-500) 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(26, 179, 148, 0.4);
}

.btn-apply {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-apply:hover:not(:disabled) {
  background: var(--c-navy-600);
  border-color: var(--c-mint-600);
}

.btn-reset {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-reset:hover:not(:disabled) {
  background: rgba(255, 100, 100, 0.1);
  color: #ff6b6b;
  border-color: #ff6b6b;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.btn-tiny {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.btn-tiny:hover {
  background: var(--bg-elevated);
}

/* Main Content */
.playground-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-panels {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* Resize Handles */
.resize-handle-vertical {
  width: 6px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.resize-handle-vertical::after {
  content: '';
  position: absolute;
  top: 0;
  left: 1px;
  width: 2px;
  height: 100%;
  background: var(--border);
  transition: background 0.2s;
}

.resize-handle-vertical:hover::after,
.resize-handle-vertical:active::after {
  background: var(--accent);
}

.resize-handle-horizontal {
  height: 4px;
  background: transparent;
  cursor: row-resize;
  position: relative;
  margin: -2px 0;
  z-index: 10;
}

.resize-handle-horizontal::after {
  content: '';
  position: absolute;
  left: 0;
  top: 1px;
  width: 100%;
  height: 2px;
  background: var(--border);
  transition: background 0.2s;
}

.resize-handle-horizontal:hover::after,
.resize-handle-horizontal:active::after {
  background: var(--accent);
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  min-height: 38px;
}

.panel-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

/* File Explorer */
.file-explorer {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.file-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 4px;
}

.file-tree {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

:deep(.tree-item) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  transition: all 0.15s;
  user-select: none;
  border-left: 2px solid transparent;
}

:deep(.tree-item:hover) {
  background: var(--bg-tertiary);
}

:deep(.tree-item.selected) {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

:deep(.tree-item.modified .item-name) {
  color: var(--warning);
}

:deep(.chevron) {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

:deep(.chevron::before) {
  content: '▶';
}

:deep(.chevron.expanded) {
  transform: rotate(90deg);
}

:deep(.folder-icon) {
  width: 16px;
  height: 16px;
  background: var(--c-duck-yellow);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

:deep(.folder-icon::before) {
  content: '📁';
  font-size: 12px;
}

:deep(.file-icon-badge) {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  font-family: monospace;
}

:deep(.icon-vue) {
  background: #42b883;
  color: white;
}

:deep(.icon-ts) {
  background: #3178c6;
  color: white;
}

:deep(.icon-js) {
  background: #f7df1e;
  color: #323330;
}

:deep(.icon-json) {
  background: #5a5a5a;
  color: #f5d67b;
}

:deep(.icon-css) {
  background: #264de4;
  color: white;
}

:deep(.icon-html) {
  background: #e44d26;
  color: white;
}

:deep(.icon-default) {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

:deep(.item-name) {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.modified-badge) {
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
}

/* Editor Panel */
.editor-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
  flex: 1;
  min-width: 0;
}

.editor-header {
  padding: 0;
  background: var(--bg-secondary);
}

.tab-bar {
  display: flex;
  padding: 0 8px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, transparent 0%, var(--accent-soft) 100%);
}

.tab-name {
  font-weight: 500;
}

.tab-modified {
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
}

.tab-bar-empty {
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
}

.editor-container {
  flex: 1;
  min-height: 0;
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
  flex: 1;
  min-width: 0;
}

.preview-url {
  font-size: 10px;
  color: var(--text-muted);
  font-family: monospace;
  background: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preview-frame {
  flex: 1;
  border: none;
  background: white;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
}

.placeholder-logo {
  width: 80px;
  height: 80px;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

.placeholder-text {
  color: var(--text-muted);
  font-size: 13px;
  max-width: 200px;
}

.placeholder-text strong {
  color: var(--accent);
}

/* Terminal */
.terminal-panel {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.terminal-header {
  background: #161b22;
  border-bottom: 1px solid #21262d;
}

.terminal-actions {
  display: flex;
  gap: 8px;
}

.terminal-btn {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.terminal-btn:hover {
  background: #21262d;
  border-color: #8b949e;
  color: #c9d1d9;
}

.terminal-output {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #c9d1d9;
}

.terminal-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-empty {
  color: #484f58;
}

.terminal-prompt {
  color: #58a6ff;
  font-weight: 600;
}
</style>
