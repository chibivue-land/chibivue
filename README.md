<p align="center">
  <img src="./book/online-book/src/public/og.png" width="480">
</p>

<h1 align="center">chibivue</h1>

<p align="center">
  <b>Writing Vue.js: Step by Step, from just one line of "Hello, World".</b>
</p>

<p align="center">
  <a href="https://book.chibivue.land">Online Book</a> ·
  <a href="https://discord.gg/aVHvmbmSRy">Discord</a> ·
  <a href="https://github.com/sponsors/ubugeeei">Sponsor</a>
</p>

<p align="center">
  <a href="./README-zh-cn.md">简体中文</a> ·
  <a href="./README-zh-tw.md">繁體中文</a>
</p>

---

**chibivue** is a minimal implementation of [Vue.js](https://github.com/vuejs/core) for educational purposes.

- Reactivity System
- Virtual DOM & Patch Rendering
- Component System
- Template Compiler
- SFC Compiler
- Vapor Mode (experimental)

> "chibi" means "small" in Japanese.

## Online Book

[![Pages Deploy](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chibivue-land/chibivue/actions/workflows/deploy.yml)

| Language | URL |
|----------|-----|
| English | https://book.chibivue.land |
| 日本語 | https://book.chibivue.land/ja |
| 简体中文 | https://book.chibivue.land/zh-cn |
| 繁體中文 | https://book.chibivue.land/zh-tw |

## Quick Start

### Requirements

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+

### Read the Book Locally

```sh
git clone https://github.com/chibivue-land/chibivue
cd chibivue
pnpm install
pnpm dev
```

### Try the Implementation

```sh
pnpm setup      # Generate playground
pnpm impl:dev   # Start dev server
```

## Implementation Status

### Core Features

| Category | Feature | Status |
|----------|---------|--------|
| Reactivity | ref, reactive, computed, watch, effectScope | ✅ |
| Virtual DOM | h function, patch rendering, scheduler | ✅ |
| Component | Options API, Composition API, lifecycle hooks | ✅ |
| Component | props, emit, provide/inject, slots | ✅ |
| Template | v-bind, v-on, v-if, v-for, v-model | ✅ |
| SFC | template, script, style, script setup | ✅ |
| SFC | defineProps, defineEmits, scoped CSS | ✅ |
| Extensions | Router, Store | ✅ |
| Vapor Mode | Basic implementation | ✅ |
| SSR | Server-side rendering | 🚧 |

## Bonus Track

**Hyper Ultimate Super Extreme Minimal Vue**

Implements createApp, Virtual DOM, Reactivity, Template Compiler, and SFC Compiler in just **110 lines**.

[Read the Chapter](https://book.chibivue.land/bonus/hyper-ultimate-super-extreme-minimal-vue) · [View Source](https://github.com/chibivue-land/chibivue/blob/main/book/impls/bonus/hyper-ultimate-super-extreme-minimal-vue/packages/index.ts)

## Contributing

See [contributing.md](.github/contributing.md).

## Community

Join our [Discord Server](https://discord.gg/aVHvmbmSRy) for discussions, questions, and announcements.

---

<div align="center">

## Sponsors

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

[Become a Sponsor](https://github.com/sponsors/ubugeeei)

</div>
