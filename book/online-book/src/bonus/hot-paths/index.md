# Hot Paths

::: warning AI-generated appendix
This appendix was drafted with GPT-5.5 from the original chibivue book content. Treat these routes as guided learning paths; the original chapters and implementation code remain the source of truth.
:::

chibivue is intentionally incremental, but that also makes it large. This appendix gives you shorter routes through the book when you want to learn the core ideas before reading everything in order.

Each route tells you what to read, what to implement or inspect, and when to stop. If a route feels too fast, jump to the linked original chapter and come back when the missing piece clicks.

## Routes

| Route | Time | Audience | You will understand |
| --- | --- | --- | --- |
| [Beginner 30-minute hands-on](./beginner-30-min-hands-on) | 30 min | First-time readers who want the smallest possible win | How `createApp`, VNode rendering, reactivity, and a tiny compiler connect |
| [Beginner 60-minute hands-on](./beginner-60-min-hands-on) | 60 min | Beginners who can spend one focused session | The full Minimum Example flow, from first render to SFC |
| [Intermediate 60-minute hands-on](./intermediate-60-min-hands-on) | 60 min | Readers who already know Vue or TypeScript | The runtime and compiler paths that make component updates work |
| [Advanced 30-minute summary](./advanced-30-min-summary) | 30 min | Readers who want a compressed map before source reading | The whole book as 30 checkpoints |

## How to use these paths

1. Keep the original chapter open beside the route.
2. Time-box each section. Finishing the whole route matters less than preserving the big picture.
3. Use the implementation snapshots under `book/impls` when you want to compare your mental model with working code.
4. After a route, choose one original chapter and read it slowly. The hot path is the map, not the territory.

## Source sections covered

- [Getting Started](/00-introduction/010-about)
- [Minimum Example](/10-minimum-example/010-create-app-api)
- [Basic Virtual DOM](/20-basic-virtual-dom/010-patch-keyed-children)
- [Basic Reactivity System](/30-basic-reactivity-system/005-reactivity-optimization)
- [Basic Component System](/40-basic-component-system/010-lifecycle-hooks)
- [Basic Template Compiler](/50-basic-template-compiler/010-transform)
- [Basic SFC Compiler](/60-basic-sfc-compiler/010-script-setup)
- [Web Application Essentials](/90-web-application-essentials/010-plugins/010-router)
- [Writing Vue.js in 15 minutes](/bonus/hyper-ultimate-super-extreme-minimal-vue/)
