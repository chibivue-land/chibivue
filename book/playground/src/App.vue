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

// Chapter selector state
const isSelectorOpen = ref(false);
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);
const selectorRef = ref<HTMLDivElement | null>(null);
const highlightedIndex = ref(-1);

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

// Filtered chapters based on search query
const filteredChapters = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return chapters;
  return chapters.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.section.toLowerCase().includes(query)
  );
});

const filteredGroupedChapters = computed(() => {
  const groups: Record<string, Chapter[]> = {};
  for (const chapter of filteredChapters.value) {
    if (!groups[chapter.section]) {
      groups[chapter.section] = [];
    }
    groups[chapter.section].push(chapter);
  }
  return groups;
});

const flatFilteredChapters = computed(() => filteredChapters.value);

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

// Chapter selector methods
function openSelector() {
  isSelectorOpen.value = true;
  searchQuery.value = "";
  highlightedIndex.value = -1;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

function closeSelector() {
  isSelectorOpen.value = false;
  searchQuery.value = "";
  highlightedIndex.value = -1;
}

function handleSelectorSelect(chapterId: string) {
  selectChapter(chapterId);
  closeSelector();
}

function handleSelectorKeydown(e: KeyboardEvent) {
  const chapters = flatFilteredChapters.value;
  if (e.key === 'Escape') {
    closeSelector();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, chapters.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (e.key === 'Enter' && highlightedIndex.value >= 0) {
    e.preventDefault();
    handleSelectorSelect(chapters[highlightedIndex.value].id);
  }
}

function handleClickOutside(e: MouseEvent) {
  if (selectorRef.value && !selectorRef.value.contains(e.target as Node)) {
    closeSelector();
  }
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

// Console message handler
function handleConsoleMessage(event: MessageEvent) {
  if (event.data?.type === 'console') {
    consoleOutput.value.push({
      type: event.data.level || 'log',
      message: event.data.args?.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') || '',
      timestamp: new Date(),
    });
  }
}

// Lifecycle
onMounted(async () => {
  monaco = await loader.init();

  // Listen for console messages from iframe
  window.addEventListener('message', handleConsoleMessage);

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
  window.removeEventListener('message', handleConsoleMessage);
  document.removeEventListener('click', handleClickOutside);
});

// Watch for selector open state to add/remove click outside listener
watch(isSelectorOpen, (isOpen) => {
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});

watch(terminalOutput, async () => {
  await nextTick();
  if (terminalContainer.value) {
    terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
  }
});

watch(consoleOutput, async () => {
  await nextTick();
  if (consoleContainer.value) {
    consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight;
  }
}, { deep: true });
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
        <!-- Custom Chapter Selector -->
        <div ref="selectorRef" class="chapter-selector-custom">
          <button class="selector-trigger" @click="openSelector">
            <span class="selector-icon">📚</span>
            <span class="selector-text">
              {{ selectedChapter ? selectedChapter.name : 'Select a chapter...' }}
            </span>
            <span class="selector-arrow" :class="{ open: isSelectorOpen }">▼</span>
          </button>

          <!-- Dropdown -->
          <Teleport to="body">
            <div v-if="isSelectorOpen" class="selector-dropdown" @keydown="handleSelectorKeydown">
              <div class="selector-header">
                <div class="search-wrapper">
                  <span class="search-icon">🔍</span>
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    class="search-input"
                    placeholder="Search chapters..."
                    @keydown="handleSelectorKeydown"
                  />
                  <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</span>
                </div>
              </div>

              <div class="selector-content">
                <template v-if="Object.keys(filteredGroupedChapters).length > 0">
                  <div
                    v-for="(chapterList, section) in filteredGroupedChapters"
                    :key="section"
                    class="selector-group"
                  >
                    <div class="group-header">{{ section }}</div>
                    <div
                      v-for="(chapter, idx) in chapterList"
                      :key="chapter.id"
                      class="selector-item"
                      :class="{
                        selected: chapter.id === selectedChapterId,
                        highlighted: flatFilteredChapters.indexOf(chapter) === highlightedIndex
                      }"
                      @click="handleSelectorSelect(chapter.id)"
                      @mouseenter="highlightedIndex = flatFilteredChapters.indexOf(chapter)"
                    >
                      <span class="item-check" v-if="chapter.id === selectedChapterId">✓</span>
                      <span class="item-name">{{ chapter.name }}</span>
                    </div>
                  </div>
                </template>
                <div v-else class="selector-empty">
                  <span>No chapters found</span>
                </div>
              </div>

              <div class="selector-footer">
                <span class="footer-hint">
                  <kbd>↑</kbd><kbd>↓</kbd> Navigate
                  <kbd>Enter</kbd> Select
                  <kbd>Esc</kbd> Close
                </span>
                <span class="chapter-count">{{ filteredChapters.length }} chapters</span>
              </div>
            </div>
          </Teleport>
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

      <!-- Terminal & Console Panel -->
      <div class="terminal-panel" :style="{ height: `${terminalHeight}px` }">
        <div class="panel-header terminal-header">
          <div class="output-tabs">
            <button
              :class="['output-tab', { active: activeTab === 'terminal' }]"
              @click="activeTab = 'terminal'"
            >
              Terminal
            </button>
            <button
              :class="['output-tab', { active: activeTab === 'console' }]"
              @click="activeTab = 'console'"
            >
              Console
              <span v-if="consoleOutput.length > 0" class="console-badge">{{ consoleOutput.length }}</span>
            </button>
          </div>
          <div class="terminal-actions">
            <button
              v-if="activeTab === 'terminal'"
              @click="terminalOutput = []"
              class="terminal-btn"
              title="Clear"
            >
              Clear
            </button>
            <button
              v-else
              @click="consoleOutput = []"
              class="terminal-btn"
              title="Clear"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- Terminal Output -->
        <div v-show="activeTab === 'terminal'" ref="terminalContainer" class="terminal-output">
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

        <!-- Console Output -->
        <div v-show="activeTab === 'console'" ref="consoleContainer" class="console-output">
          <div
            v-for="(entry, index) in consoleOutput"
            :key="index"
            :class="['console-entry', `console-${entry.type}`]"
          >
            <span class="console-time">{{ entry.timestamp.toLocaleTimeString() }}</span>
            <span class="console-type">[{{ entry.type }}]</span>
            <span class="console-message">{{ entry.message }}</span>
          </div>
          <div v-if="consoleOutput.length === 0" class="terminal-empty">
            Console output will appear here when the app runs...
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
  width: 120px;
  height: 120px;
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
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--c-navy-900) 50%, #0d1520 100%);
  overflow: hidden;
}

/* Header */
.playground-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  background: rgba(21, 30, 45, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(44, 201, 168, 0.1);
  flex-shrink: 0;
  position: relative;
}

.playground-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%);
  opacity: 0.3;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  width: 40px;
  height: 40px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  filter: drop-shadow(0 2px 8px rgba(44, 201, 168, 0.3));
}

.brand-logo:hover {
  transform: scale(1.15) rotate(8deg);
  filter: drop-shadow(0 4px 12px rgba(44, 201, 168, 0.5));
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 18px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--c-mint-300) 0%, var(--c-mint-500) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.brand-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  font-weight: 500;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Custom Chapter Selector */
.chapter-selector-custom {
  position: relative;
}

.selector-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: rgba(27, 38, 55, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(44, 201, 168, 0.15);
  border-radius: 12px;
  color: var(--text-primary);
  min-width: 300px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.selector-trigger:hover {
  border-color: var(--c-mint-500);
  background: rgba(36, 51, 82, 0.8);
  box-shadow: 0 4px 16px rgba(44, 201, 168, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.selector-icon {
  font-size: 16px;
}

.selector-text {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-arrow {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.selector-arrow.open {
  transform: rotate(180deg);
}

/* Selector Dropdown - uses Teleport so needs :global or in global CSS */
.chapter-links {
  display: flex;
  gap: 8px;
}

.link-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.link-book {
  background: linear-gradient(135deg, rgba(44, 201, 168, 0.15) 0%, rgba(44, 201, 168, 0.08) 100%);
  color: var(--c-mint-300);
  border-color: rgba(44, 201, 168, 0.2);
}

.link-book:hover {
  background: linear-gradient(135deg, var(--c-mint-500) 0%, var(--c-mint-600) 100%);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(44, 201, 168, 0.3);
}

.link-vue {
  background: linear-gradient(135deg, rgba(66, 184, 131, 0.15) 0%, rgba(66, 184, 131, 0.08) 100%);
  color: #5fd9a4;
  border-color: rgba(66, 184, 131, 0.2);
}

.link-vue:hover {
  background: linear-gradient(135deg, #42b883 0%, #35a070 100%);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

.link-icon {
  font-size: 13px;
}

/* Actions */
.header-actions {
  display: flex;
  gap: 10px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.btn:hover::before {
  opacity: 1;
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none !important;
}

.btn-icon {
  font-size: 14px;
}

.btn-run {
  background: linear-gradient(135deg, var(--c-mint-400) 0%, var(--c-mint-600) 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(44, 201, 168, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.btn-run:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--c-mint-300) 0%, var(--c-mint-500) 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(44, 201, 168, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.btn-run:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(44, 201, 168, 0.3);
}

.btn-apply {
  background: rgba(36, 51, 82, 0.8);
  color: var(--text-primary);
  border: 1px solid rgba(44, 201, 168, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn-apply:hover:not(:disabled) {
  background: rgba(46, 63, 96, 0.9);
  border-color: var(--c-mint-500);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(44, 201, 168, 0.2);
}

.btn-reset {
  background: rgba(36, 51, 82, 0.5);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-reset:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.15);
  color: #ff8a8a;
  border-color: rgba(255, 107, 107, 0.4);
  transform: translateY(-1px);
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-tiny {
  padding: 5px 12px;
  font-size: 11px;
  background: rgba(27, 38, 55, 0.8);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-weight: 500;
}

.btn-tiny:hover {
  background: rgba(36, 51, 82, 0.9);
  color: var(--text-primary);
  border-color: rgba(44, 201, 168, 0.3);
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
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(27, 38, 55, 0.95) 0%, rgba(21, 30, 45, 0.9) 100%);
  border-bottom: 1px solid rgba(44, 201, 168, 0.08);
  min-height: 42px;
  backdrop-filter: blur(8px);
}

.panel-title {
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--c-mint-400);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title::before {
  content: '';
  width: 3px;
  height: 12px;
  background: linear-gradient(180deg, var(--c-mint-400) 0%, var(--c-mint-600) 100%);
  border-radius: 2px;
}

/* File Explorer */
.file-explorer {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, rgba(21, 30, 45, 0.95) 100%);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.file-count {
  font-size: 10px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.file-tree {
  flex: 1;
  overflow: auto;
  padding: 6px 8px;
}

:deep(.tree-directory) {
  margin-bottom: 2px;
}

:deep(.tree-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  user-select: none;
  border-radius: 6px;
  margin: 1px 0;
  position: relative;
}

:deep(.tree-item:hover) {
  background: rgba(44, 201, 168, 0.08);
  color: var(--text-primary);
}

:deep(.tree-item.directory) {
  font-weight: 500;
}

:deep(.tree-item.directory:hover) {
  background: rgba(244, 211, 94, 0.08);
}

:deep(.tree-item.selected) {
  background: linear-gradient(90deg, var(--accent-soft) 0%, rgba(44, 201, 168, 0.05) 100%);
  color: var(--text-primary);
}

:deep(.tree-item.selected::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
}

:deep(.tree-item.modified .item-name) {
  color: var(--warning);
}

:deep(.chevron) {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  opacity: 0.7;
}

:deep(.chevron::before) {
  content: '▶';
}

:deep(.chevron.expanded) {
  transform: rotate(90deg);
  opacity: 1;
  color: var(--c-duck-yellow);
}

:deep(.folder-icon) {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: transform 0.2s;
}

:deep(.folder-icon::before) {
  content: '📁';
}

:deep(.tree-item.directory:hover .folder-icon) {
  transform: scale(1.1);
}

:deep(.file-icon-badge) {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s;
}

:deep(.tree-item:hover .file-icon-badge) {
  transform: scale(1.05);
}

:deep(.icon-vue) {
  background: linear-gradient(135deg, #42b883 0%, #35a070 100%);
  color: white;
}

:deep(.icon-ts) {
  background: linear-gradient(135deg, #3178c6 0%, #235a9e 100%);
  color: white;
}

:deep(.icon-js) {
  background: linear-gradient(135deg, #f7df1e 0%, #e5c900 100%);
  color: #323330;
}

:deep(.icon-json) {
  background: linear-gradient(135deg, #6d6d6d 0%, #4a4a4a 100%);
  color: #f5d67b;
}

:deep(.icon-css) {
  background: linear-gradient(135deg, #264de4 0%, #1a3cb8 100%);
  color: white;
}

:deep(.icon-html) {
  background: linear-gradient(135deg, #e44d26 0%, #c73d1a 100%);
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
  border-right: 1px solid rgba(44, 201, 168, 0.08);
  flex: 1;
  min-width: 0;
  background: linear-gradient(180deg, #0f1724 0%, #0d1520 100%);
}

.editor-header {
  padding: 0;
  background: linear-gradient(180deg, rgba(21, 30, 45, 0.98) 0%, rgba(15, 23, 36, 0.95) 100%);
  border-bottom: 1px solid rgba(44, 201, 168, 0.06);
}

.tab-bar {
  display: flex;
  padding: 0 12px;
  gap: 4px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  font-size: 13px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  border-radius: 8px 8px 0 0;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--text-secondary);
  background: rgba(44, 201, 168, 0.05);
}

.tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, rgba(44, 201, 168, 0.08) 0%, rgba(44, 201, 168, 0.03) 100%);
}

.tab-name {
  font-weight: 600;
  letter-spacing: -0.2px;
}

.tab-modified {
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, var(--c-duck-yellow) 0%, #e5b800 100%);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(244, 211, 94, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.9); }
}

.tab-bar-empty {
  padding: 12px 18px;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}

.editor-container {
  flex: 1;
  min-height: 0;
  border-radius: 0 0 0 8px;
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(21, 30, 45, 0.9) 0%, rgba(13, 21, 32, 0.95) 100%);
  flex: 1;
  min-width: 0;
}

.preview-url {
  font-size: 10px;
  color: var(--c-mint-400);
  font-family: 'JetBrains Mono', monospace;
  background: rgba(44, 201, 168, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(44, 201, 168, 0.15);
}

.preview-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 8px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.preview-frame {
  flex: 1;
  border: none;
  background: white;
  border-radius: 8px;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 32px;
  text-align: center;
  background: radial-gradient(ellipse at center, rgba(44, 201, 168, 0.03) 0%, transparent 70%);
}

.placeholder-logo {
  width: 120px;
  height: 120px;
  opacity: 0.9;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 8px 20px rgba(44, 201, 168, 0.3));
}

.placeholder-text {
  color: var(--text-muted);
  font-size: 14px;
  max-width: 220px;
  line-height: 1.6;
}

.placeholder-text strong {
  color: var(--c-mint-400);
  font-weight: 600;
  padding: 2px 8px;
  background: rgba(44, 201, 168, 0.15);
  border-radius: 4px;
}

/* Terminal */
.terminal-panel {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0f1419 0%, #0a0e13 100%);
  border-top: 1px solid rgba(44, 201, 168, 0.1);
  flex-shrink: 0;
  position: relative;
}

.terminal-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%);
  opacity: 0.2;
}

.terminal-header {
  background: linear-gradient(180deg, rgba(22, 27, 34, 0.98) 0%, rgba(15, 20, 25, 0.95) 100%);
  border-bottom: 1px solid rgba(48, 54, 61, 0.5);
}

.terminal-actions {
  display: flex;
  gap: 8px;
}

.terminal-btn {
  padding: 5px 12px;
  background: rgba(33, 38, 45, 0.6);
  border: 1px solid rgba(48, 54, 61, 0.8);
  border-radius: 6px;
  color: #8b949e;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.terminal-btn:hover {
  background: rgba(33, 38, 45, 0.9);
  border-color: var(--c-mint-600);
  color: var(--c-mint-400);
}

.terminal-output {
  flex: 1;
  overflow: auto;
  padding: 14px 18px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.8;
  color: #e6edf3;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.95) 0%, rgba(10, 14, 19, 0.98) 100%);
}

.terminal-line {
  white-space: pre-wrap;
  word-break: break-all;
  padding: 2px 0;
}

.terminal-empty {
  color: #6e7681;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-empty::before {
  content: '●';
  color: var(--c-mint-600);
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.terminal-prompt {
  color: var(--c-mint-400);
  font-weight: 600;
}

/* Output Tabs */
.output-tabs {
  display: flex;
  gap: 4px;
}

.output-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6e7681;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.3px;
}

.output-tab:hover {
  color: #adbac7;
  background: rgba(44, 201, 168, 0.03);
}

.output-tab.active {
  color: var(--c-mint-400);
  border-bottom-color: var(--c-mint-400);
  background: linear-gradient(180deg, rgba(44, 201, 168, 0.08) 0%, transparent 100%);
}

.console-badge {
  background: linear-gradient(135deg, var(--c-mint-500) 0%, var(--c-mint-600) 100%);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(44, 201, 168, 0.3);
}

/* Console Output */
.console-output {
  flex: 1;
  overflow: auto;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.95) 0%, rgba(10, 14, 19, 0.98) 100%);
}

.console-entry {
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  transition: background 0.15s;
  border-left: 2px solid transparent;
}

.console-entry:hover {
  background: rgba(255, 255, 255, 0.02);
}

.console-time {
  color: #484f58;
  font-size: 10px;
  flex-shrink: 0;
  font-weight: 500;
}

.console-type {
  font-weight: 700;
  flex-shrink: 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 3px;
}

.console-message {
  color: #e6edf3;
  word-break: break-all;
}

.console-log .console-type {
  color: #6e7681;
  background: rgba(110, 118, 129, 0.15);
}

.console-info .console-type {
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.15);
}

.console-warn {
  background: rgba(210, 153, 34, 0.08);
  border-left-color: #d29922;
}

.console-warn .console-type {
  color: #d29922;
  background: rgba(210, 153, 34, 0.2);
}

.console-error {
  background: rgba(248, 81, 73, 0.08);
  border-left-color: #f85149;
}

.console-error .console-type {
  color: #f85149;
  background: rgba(248, 81, 73, 0.2);
}

.console-error .console-message {
  color: #ffa198;
}
</style>
