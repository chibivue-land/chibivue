# Beginner 30-minute hands-on

::: warning AI-generated appendix
This appendix was drafted with GPT-5.5 from the original chibivue book content. Treat this route as a guided learning path; the original chapters and implementation code remain the source of truth.
:::

This route is for getting one small, satisfying loop: create an app, render a button, update state, and see why a compiler is useful. It follows the spirit of [Writing Vue.js in 15 minutes](/bonus/hyper-ultimate-super-extreme-minimal-vue/) but gives you more breathing room.

## Goal

By the end, you should be able to explain this chain:

```txt
createApp -> render function -> VNode -> patch -> reactive state -> effect -> rerender
```

You do not need to understand every edge case. The goal is to see the moving parts touch each other.

## 0-5 min: prepare the tiny mental model

Read:

- [chibivue, isn't it small...?](/bonus/hyper-ultimate-super-extreme-minimal-vue/)
- [Project Setup](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#project-setup-0-5-min)

Do:

- Create or open a chibivue playground project.
- Find the file that exports the tiny Vue-like API, usually `packages/index.ts`.
- Keep one rule in mind: every feature in this route can be intentionally naive.

Checkpoint:

- You know where the public API, renderer, reactivity, and compiler code will live, even if they are all in one file.

## 5-10 min: createApp and h

Read:

- [createApp](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#createapp-1-min)
- [h Function and Virtual DOM](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#h-function-and-virtual-dom-0-5-min)
- Optional deeper chapter: [First Rendering and the createApp API](/10-minimum-example/010-create-app-api)

Do:

- Write or inspect a `createApp` function that accepts `setup` and `render`.
- Write or inspect an `h` function that returns a plain object.
- Make sure the VNode includes only what the demo needs: tag, event, and children.

Checkpoint:

- You can say why Vue renders an object first instead of directly writing DOM code everywhere.

## 10-17 min: patch the VNode into the DOM

Read:

- [patch rendering](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#patch-rendering-2-min)
- Optional deeper chapter: [A Minimal Virtual DOM](/10-minimum-example/040-minimum-virtual-dom)

Do:

- Turn the VNode into an actual DOM element.
- Attach a click handler.
- Insert the element into the container selected by `mount`.

Checkpoint:

- A render function can produce a VNode, and `patch` can make that VNode visible in the browser.

## 17-23 min: make state reactive

Read:

- The reactivity section in [Implement](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)
- Optional deeper chapter: [Try Implementing a Small Reactivity System](/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

Do:

- Inspect the dependency store: which effect depends on which property?
- Update state from the click handler.
- Confirm that the render effect runs again when state changes.

Checkpoint:

- You can describe `track` as "remember who read this" and `trigger` as "rerun who cared about this."

## 23-28 min: replace manual render with template

Read:

- The compiler and SFC sections in [Implement](/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl)
- Optional deeper chapters: [Understanding the Template Compiler](/10-minimum-example/060-template-compiler), [Parse SFC](/10-minimum-example/091-parse-sfc)

Do:

- Inspect how a tiny template becomes a render function.
- Keep the compiler intentionally narrow: one button, one event, one interpolation is enough.

Checkpoint:

- You can explain that the compiler is not a separate magic system. It creates the render function that the runtime already knows how to run.

## 28-30 min: close the loop

Answer these aloud or in notes:

- What object does `h` return?
- Who calls `patch`?
- What makes `render` run again?
- Why does SFC support need a Vite plugin in this tiny implementation?

Next path:

- If this felt good, continue with [Beginner 60-minute hands-on](./beginner-60-min-hands-on).
- If the code felt too dense, read [First Rendering and the createApp API](/10-minimum-example/010-create-app-api) slowly before continuing.
