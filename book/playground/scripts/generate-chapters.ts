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

// Display names for chapters (more descriptive than directory names)
const CHAPTER_DISPLAY_NAMES: Record<string, string> = {
  // 10_minimum_example
  "10_minimum_example/010_create_app": "createApp",
  "10_minimum_example/015_package_architecture": "Package Architecture",
  "10_minimum_example/020_simple_h_function": "h Function",
  "10_minimum_example/030_reactive_system": "Reactive System",
  "10_minimum_example/040_vdom_system": "Virtual DOM",
  "10_minimum_example/050_component_system": "Component",
  "10_minimum_example/050_component_system2": "Component Props",
  "10_minimum_example/050_component_system3": "Component Emits",
  "10_minimum_example/060_template_compiler": "Template Compiler",
  "10_minimum_example/060_template_compiler2": "Template Compiler (Impl)",
  "10_minimum_example/060_template_compiler3": "Complex Parser",
  "10_minimum_example/070_sfc_compiler": "SFC Parser",
  "10_minimum_example/070_sfc_compiler2": "SFC Template",
  "10_minimum_example/070_sfc_compiler3": "SFC Script",
  "10_minimum_example/070_sfc_compiler4": "SFC Style",
  // 20_basic_virtual_dom
  "20_basic_virtual_dom/010_patch_keyed_children": "Keyed Children Patch",
  "20_basic_virtual_dom/020_bit_flags": "Bit Flags",
  "20_basic_virtual_dom/040_scheduler": "Scheduler",
  "20_basic_virtual_dom/050_next_tick": "nextTick",
  "20_basic_virtual_dom/060_other_props": "Other Props",
  // 30_basic_reactivity_system
  "30_basic_reactivity_system/010_ref": "ref",
  "30_basic_reactivity_system/020_shallow_ref": "shallowRef",
  "30_basic_reactivity_system/030_to_ref": "toRef",
  "30_basic_reactivity_system/040_to_refs": "toRefs",
  "30_basic_reactivity_system/050_computed": "computed",
  "30_basic_reactivity_system/060_watch": "watch",
  "30_basic_reactivity_system/070_watch_effect": "watchEffect",
  "30_basic_reactivity_system/080_reactive_proxy_handlers": "Reactive Proxy",
  "30_basic_reactivity_system/090_effect_scope": "effectScope",
  "30_basic_reactivity_system/100_other_apis": "Other APIs",
  // 40_basic_component_system
  "40_basic_component_system/010_lifecycle_hooks": "Lifecycle Hooks",
  "40_basic_component_system/020_provide_inject": "provide / inject",
  "40_basic_component_system/030_component_proxy": "Component Proxy",
  "40_basic_component_system/040_slots": "Slots",
  "40_basic_component_system/050_options_api": "Options API",
  // 50_basic_template_compiler
  "50_basic_template_compiler/010_transform": "Transform",
  "50_basic_template_compiler/020_v_bind": "v-bind",
  "50_basic_template_compiler/022_transform_expression": "Expression",
  "50_basic_template_compiler/025_v_on": "v-on",
  "50_basic_template_compiler/027_event_modifier": "Event Modifier",
  "50_basic_template_compiler/030_fragment": "Fragment",
  "50_basic_template_compiler/035_comment": "Comment",
  "50_basic_template_compiler/040_v_if": "v-if",
  "50_basic_template_compiler/050_v_for": "v-for",
  "50_basic_template_compiler/060_v_model": "v-model",
  "50_basic_template_compiler/070_resolve_component": "resolveComponent",
  "50_basic_template_compiler/080_slot_outlet": "Slot Outlet",
  "50_basic_template_compiler/085_slot_insert": "Slot Insert",
  "50_basic_template_compiler/090_other_directives": "Other Directives",
  "50_basic_template_compiler/100_chore_compiler": "Compiler Refactor",
  "50_basic_template_compiler/110_parser_optimization": "Parser Optimization",
  "50_basic_template_compiler/500_custom_directive": "Custom Directive",
  // 60_basic_sfc_compiler
  "60_basic_sfc_compiler/010_script_setup": "script setup",
  "60_basic_sfc_compiler/020_define_props": "defineProps",
  "60_basic_sfc_compiler/030_define_emits": "defineEmits",
  "60_basic_sfc_compiler/040_scoped_css": "Scoped CSS",
  "60_basic_sfc_compiler/050_props_destructure": "Props Destructure",
  "60_basic_sfc_compiler/060_type_based_macros": "Type-based Macros",
  // 90_web_application_essentials
  "90_web_application_essentials/010_router": "Router",
  "90_web_application_essentials/020_preprocessors": "Preprocessors",
  // bonus
  "bonus/hyper_ultimate_super_extreme_minimal_vue": "15-min Vue",
};

// Mapping from impl directory names to book page names
// Format: "section/chapter" -> "book-page-name" (without .md extension)
const CHAPTER_TO_BOOK_MAPPING: Record<string, string> = {
  // 10_minimum_example
  "10_minimum_example/010_create_app": "010-create-app-api",
  "10_minimum_example/015_package_architecture": "015-package-architecture",
  "10_minimum_example/020_simple_h_function": "020-simple-h-function",
  "10_minimum_example/030_reactive_system": "035-try-implementing-a-minimum-reactivity-system",
  "10_minimum_example/040_vdom_system": "040-minimum-virtual-dom",
  "10_minimum_example/050_component_system": "050-minimum-component",
  "10_minimum_example/050_component_system2": "051-component-props",
  "10_minimum_example/050_component_system3": "052-component-emits",
  "10_minimum_example/060_template_compiler": "060-template-compiler",
  "10_minimum_example/060_template_compiler2": "061-template-compiler-impl",
  "10_minimum_example/060_template_compiler3": "070-more-complex-parser",
  "10_minimum_example/070_sfc_compiler": "091-parse-sfc",
  "10_minimum_example/070_sfc_compiler2": "092-compile-sfc-template",
  "10_minimum_example/070_sfc_compiler3": "093-compile-sfc-script",
  "10_minimum_example/070_sfc_compiler4": "094-compile-sfc-style",
  // 20_basic_virtual_dom
  "20_basic_virtual_dom/010_patch_keyed_children": "010-patch-keyed-children",
  "20_basic_virtual_dom/020_bit_flags": "020-bit-flags",
  "20_basic_virtual_dom/040_scheduler": "030-scheduler",
  "20_basic_virtual_dom/050_next_tick": "030-scheduler",
  "20_basic_virtual_dom/060_other_props": "040-patch-other-attrs",
  // 30_basic_reactivity_system
  "30_basic_reactivity_system/010_ref": "010-ref-api",
  "30_basic_reactivity_system/020_shallow_ref": "010-ref-api",
  "30_basic_reactivity_system/030_to_ref": "010-ref-api",
  "30_basic_reactivity_system/040_to_refs": "010-ref-api",
  "30_basic_reactivity_system/050_computed": "020-computed-watch",
  "30_basic_reactivity_system/060_watch": "020-computed-watch",
  "30_basic_reactivity_system/070_watch_effect": "020-computed-watch",
  "30_basic_reactivity_system/080_reactive_proxy_handlers": "030-reactive-proxy-handlers",
  "30_basic_reactivity_system/090_effect_scope": "040-effect-scope",
  "30_basic_reactivity_system/100_other_apis": "050-other-apis",
  // 40_basic_component_system
  "40_basic_component_system/010_lifecycle_hooks": "010-lifecycle-hooks",
  "40_basic_component_system/020_provide_inject": "020-provide-inject",
  "40_basic_component_system/030_component_proxy": "030-component-proxy-setup-context",
  "40_basic_component_system/040_slots": "040-component-slot",
  "40_basic_component_system/050_options_api": "050-options-api",
  // 50_basic_template_compiler
  "50_basic_template_compiler/010_transform": "010-transform",
  "50_basic_template_compiler/020_v_bind": "020-v-bind",
  "50_basic_template_compiler/022_transform_expression": "022-transform-expression",
  "50_basic_template_compiler/025_v_on": "025-v-on",
  "50_basic_template_compiler/027_event_modifier": "027-event-modifier",
  "50_basic_template_compiler/030_fragment": "030-fragment",
  "50_basic_template_compiler/035_comment": "035-comment",
  "50_basic_template_compiler/040_v_if": "040-v-if-and-structural-directive",
  "50_basic_template_compiler/050_v_for": "050-v-for",
  "50_basic_template_compiler/060_v_model": "060-v-model",
  "50_basic_template_compiler/070_resolve_component": "070-resolve-component",
  "50_basic_template_compiler/080_slot_outlet": "080-slot",
  "50_basic_template_compiler/085_slot_insert": "080-slot",
  "50_basic_template_compiler/090_other_directives": "090-other-directives",
  "50_basic_template_compiler/100_chore_compiler": "100-chore-compiler",
  "50_basic_template_compiler/110_parser_optimization": "110-parser-optimization",
  "50_basic_template_compiler/500_custom_directive": "500-custom-directive",
  // 60_basic_sfc_compiler
  "60_basic_sfc_compiler/010_script_setup": "010-script-setup",
  "60_basic_sfc_compiler/020_define_props": "020-define-props",
  "60_basic_sfc_compiler/030_define_emits": "030-define-emits",
  "60_basic_sfc_compiler/040_scoped_css": "040-scoped-css",
  "60_basic_sfc_compiler/050_props_destructure": "050-props-destructure",
  "60_basic_sfc_compiler/060_type_based_macros": "060-type-based-macros",
  // 90_web_application_essentials
  "90_web_application_essentials/010_router": "010-plugins/010-router",
  "90_web_application_essentials/020_preprocessors": "010-plugins/020-preprocessors",
  // bonus
  "bonus/hyper_ultimate_super_extreme_minimal_vue":
    "hyper-ultimate-super-extreme-minimal-vue/15-min-impl",
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
  const key = `${section}/${chapterDir}`;
  const mappedPage = CHAPTER_TO_BOOK_MAPPING[key];

  if (mappedPage) {
    const sectionSlug = section.replace(/_/g, "-");
    // Handle nested paths like "010-plugins/010-router"
    if (mappedPage.includes("/")) {
      return `/ja/${sectionSlug}/${mappedPage}.html`;
    }
    return `/ja/${sectionSlug}/${mappedPage}.html`;
  }

  // Fallback: convert underscore to hyphen
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

function getChapterName(section: string, chapterDir: string): string {
  const key = `${section}/${chapterDir}`;
  const displayName = CHAPTER_DISPLAY_NAMES[key];
  if (displayName) {
    return displayName;
  }

  // Fallback: Remove the numeric prefix (e.g., "010_create_app" -> "create_app")
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

      // Console hook script to inject into index.html (minified for cleaner output)
      const consoleHookScript = `<!-- chibivue playground: console hook -->
    <script>!function(){var o={log:console.log,info:console.info,warn:console.warn,error:console.error};["log","info","warn","error"].forEach(function(e){console[e]=function(){o[e].apply(console,arguments);try{window.parent.postMessage({type:"console",level:e,args:Array.from(arguments).map(function(a){try{return"object"==typeof a?JSON.stringify(a):String(a)}catch(e){return String(a)}})},"*")}catch(e){}}});window.onerror=function(m,s,l){window.parent.postMessage({type:"console",level:"error",args:[m+" at "+s+":"+l]},"*")}}();</script>`;

      // Check if this chapter uses vite-plugin-chibivue (needs extra dependencies)
      const viteConfigFile = playgroundFiles.find((f) => f.path === "vite.config.ts");
      const usesVitePlugin = viteConfigFile?.content.includes("vite-plugin-chibivue");

      // Fix vite.config.ts and inject console hook into index.html
      const fixedPlaygroundFiles = playgroundFiles.map((f) => {
        if (f.path === "vite.config.ts") {
          // Replace relative paths to packages with the flat structure path
          let fixedContent = f.content
            .replace(
              /path\.resolve\(dirname,\s*["']\.\.\/\.\.\/packages["']\)/g,
              'path.resolve(dirname, "packages")',
            )
            // Fix import paths for @extensions
            .replace(
              /from\s+["']\.\.\/\.\.\/packages\/@extensions\/([^"']+)["']/g,
              'from "./packages/@extensions/$1"',
            )
            .replace(
              /import\s+(\w+)\s+from\s+["']\.\.\/\.\.\/packages\/@extensions\/([^"']+)["']/g,
              'import $1 from "./packages/@extensions/$2"',
            );
          return { ...f, content: fixedContent };
        }
        // Inject console hook into index.html
        if (f.path === "index.html") {
          const fixedContent = f.content.replace(/<head>/i, `<head>\n${consoleHookScript}`);
          return { ...f, content: fixedContent };
        }
        // Add extra dependencies to package.json if using vite-plugin-chibivue
        if (f.path === "package.json" && usesVitePlugin) {
          try {
            const pkg = JSON.parse(f.content);
            pkg.dependencies = pkg.dependencies || {};
            pkg.dependencies["@babel/parser"] = "^7.28.6";
            pkg.dependencies["magic-string"] = "^0.30.21";
            pkg.dependencies["estree-walker"] = "^3.0.3";
            return { ...f, content: JSON.stringify(pkg, null, 2) + "\n" };
          } catch {
            return f;
          }
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
        name: getChapterName(section, chapterDir),
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
