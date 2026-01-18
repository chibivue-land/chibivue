import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const IMPLS_DIR = join(__dirname, "../../impls");
const OUTPUT_FILE = join(__dirname, "../src/chapters.generated.ts");

interface ChapterFile {
  path: string;
  content: string;
}

interface Chapter {
  id: string;
  section: string;
  sectionOrder: string;
  name: string;
  files: ChapterFile[];
  bookUrl: string;
  vueDocUrl?: string;
}

// Section display names
const SECTION_NAMES: Record<string, string> = {
  "00_introduction": "Introduction",
  "10_minimum_example": "Minimum Example",
  "20_basic_virtual_dom": "Basic Virtual DOM",
  "30_basic_reactivity_system": "Basic Reactivity System",
  "40_basic_component_system": "Basic Component System",
  "50_basic_template_compiler": "Basic Template Compiler",
  "60_basic_sfc_compiler": "Basic SFC Compiler",
  "90_web_application_essentials": "Web Application Essentials",
  bonus: "Bonus",
};

// Vue.js documentation URLs mapped by chapter keywords
const VUE_DOC_URLS: Record<string, string> = {
  create_app: "https://vuejs.org/api/application.html#createapp",
  h_function: "https://vuejs.org/api/render-function.html#h",
  virtual_dom: "https://vuejs.org/guide/extras/rendering-mechanism.html#virtual-dom",
  reactivity: "https://vuejs.org/guide/essentials/reactivity-fundamentals.html",
  reactive: "https://vuejs.org/api/reactivity-core.html#reactive",
  ref: "https://vuejs.org/api/reactivity-core.html#ref",
  computed: "https://vuejs.org/api/reactivity-core.html#computed",
  watch: "https://vuejs.org/api/reactivity-core.html#watch",
  component: "https://vuejs.org/guide/essentials/component-basics.html",
  props: "https://vuejs.org/guide/components/props.html",
  emits: "https://vuejs.org/guide/components/events.html",
  slots: "https://vuejs.org/guide/components/slots.html",
  provide: "https://vuejs.org/guide/components/provide-inject.html",
  inject: "https://vuejs.org/guide/components/provide-inject.html",
  template: "https://vuejs.org/guide/essentials/template-syntax.html",
  v_bind: "https://vuejs.org/api/built-in-directives.html#v-bind",
  v_on: "https://vuejs.org/api/built-in-directives.html#v-on",
  v_if: "https://vuejs.org/api/built-in-directives.html#v-if",
  v_for: "https://vuejs.org/api/built-in-directives.html#v-for",
  v_model: "https://vuejs.org/api/built-in-directives.html#v-model",
  sfc: "https://vuejs.org/guide/scaling-up/sfc.html",
  script_setup: "https://vuejs.org/api/sfc-script-setup.html",
  scoped_css: "https://vuejs.org/api/sfc-css-features.html#scoped-css",
  css_modules: "https://vuejs.org/api/sfc-css-features.html#css-modules",
  lifecycle: "https://vuejs.org/guide/essentials/lifecycle.html",
  scheduler: "https://vuejs.org/api/general.html#nexttick",
  transition: "https://vuejs.org/guide/built-ins/transition.html",
  teleport: "https://vuejs.org/guide/built-ins/teleport.html",
  suspense: "https://vuejs.org/guide/built-ins/suspense.html",
  keep_alive: "https://vuejs.org/guide/built-ins/keep-alive.html",
  custom_directive: "https://vuejs.org/guide/reusability/custom-directives.html",
  composition_api: "https://vuejs.org/guide/extras/composition-api-faq.html",
  compiler: "https://vuejs.org/guide/extras/rendering-mechanism.html#templates-vs-render-functions",
};

function getVueDocUrl(chapterDir: string): string | undefined {
  const normalized = chapterDir.toLowerCase();
  for (const [keyword, url] of Object.entries(VUE_DOC_URLS)) {
    if (normalized.includes(keyword.replace(/_/g, ""))) {
      return url;
    }
  }
  return undefined;
}

function getBookUrl(section: string, chapterDir: string): string {
  // Convert underscore to hyphen for URL
  const sectionSlug = section.replace(/_/g, "-");
  const chapterSlug = chapterDir.replace(/_/g, "-");
  return `/ja/${sectionSlug}/${chapterSlug}.html`;
}

// Files to exclude from reading
const EXCLUDE_FILES = [
  ".gitignore",
  "node_modules",
  "dist",
  ".DS_Store",
  "pnpm-lock.yaml",
  "package-lock.json",
];

// File extensions to include
const INCLUDE_EXTENSIONS = [".ts", ".js", ".vue", ".html", ".css", ".json"];

function shouldIncludeFile(filename: string): boolean {
  if (EXCLUDE_FILES.some((exclude) => filename.includes(exclude))) {
    return false;
  }
  return INCLUDE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function readFilesRecursively(dir: string, basePath: string = ""): ChapterFile[] {
  const files: ChapterFile[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = basePath ? `${basePath}/${entry}` : entry;

    if (EXCLUDE_FILES.some((exclude) => entry.includes(exclude))) {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...readFilesRecursively(fullPath, relativePath));
    } else if (shouldIncludeFile(entry)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return files;
}

function getChapterName(chapterDir: string): string {
  // Remove the numeric prefix (e.g., "010_create_app" -> "create_app")
  const withoutPrefix = chapterDir.replace(/^\d+_/, "");
  // Convert to title case
  return withoutPrefix
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function loadChapters(): Chapter[] {
  const chapters: Chapter[] = [];

  if (!existsSync(IMPLS_DIR)) {
    console.warn("Impls directory not found:", IMPLS_DIR);
    return chapters;
  }

  const sections = readdirSync(IMPLS_DIR).sort();

  for (const section of sections) {
    const sectionPath = join(IMPLS_DIR, section);
    const sectionStat = statSync(sectionPath);

    if (!sectionStat.isDirectory()) continue;

    const sectionName = SECTION_NAMES[section] || section;
    const chapterDirs = readdirSync(sectionPath).sort();

    for (const chapterDir of chapterDirs) {
      const chapterPath = join(sectionPath, chapterDir);

      if (!statSync(chapterPath).isDirectory()) continue;

      // Check if this chapter has a playground
      const playgroundPath = join(chapterPath, "examples", "playground");
      const packagesPath = join(chapterPath, "packages");

      if (!existsSync(playgroundPath)) continue;

      // Read playground files
      const playgroundFiles = readFilesRecursively(playgroundPath);

      // Read packages files (with "packages/" prefix)
      const packagesFiles = readFilesRecursively(packagesPath).map((f) => ({
        path: `packages/${f.path}`,
        content: f.content,
      }));

      // Fix vite.config.ts to use the correct path for WebContainer
      const fixedPlaygroundFiles = playgroundFiles.map((f) => {
        if (f.path === "vite.config.ts") {
          // Replace relative path to packages with the flat structure path
          const fixedContent = f.content.replace(
            /path\.resolve\(dirname,\s*["']\.\.\/\.\.\/packages["']\)/g,
            'path.resolve(dirname, "packages")',
          );
          return { ...f, content: fixedContent };
        }
        return f;
      });

      // Merge files
      const allFiles = [...fixedPlaygroundFiles, ...packagesFiles];

      if (allFiles.length === 0) continue;

      const vueDocUrl = getVueDocUrl(chapterDir);
      chapters.push({
        id: `${section}/${chapterDir}`,
        section: sectionName,
        sectionOrder: section,
        name: getChapterName(chapterDir),
        files: allFiles,
        bookUrl: getBookUrl(section, chapterDir),
        ...(vueDocUrl && { vueDocUrl }),
      });
    }
  }

  return chapters;
}

function generateOutput(chapters: Chapter[]): string {
  return `// This file is auto-generated by scripts/generate-chapters.ts
// Do not edit manually

import type { Chapter } from "./types";

export const chapters: Chapter[] = ${JSON.stringify(chapters, null, 2)};
`;
}

// Main
const chapters = loadChapters();
const output = generateOutput(chapters);
writeFileSync(OUTPUT_FILE, output);
console.log(`Generated ${chapters.length} chapters to ${OUTPUT_FILE}`);
