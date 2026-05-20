# Beginner 60-minute hands-on

::: warning AI-generated appendix
This appendix was drafted with GPT-5.5 from the original chibivue book content. Treat this route as a guided learning path; the original chapters and implementation code remain the source of truth.
:::

This route walks through the original Minimum Example without trying to absorb every explanation. You will touch the main shape of a Vue-like framework: application API, renderer, reactivity, components, template compiler, and SFC support.

## Goal

By the end, you should understand why chibivue is split into packages and how a `.vue` file eventually becomes DOM updates.

## 0-8 min: project shape

Read:

- [Approach in This Book and Setting Up the Environment](/00-introduction/040-setup-project)
- [Package Architecture](/10-minimum-example/015-package-architecture)

Do:

- Locate `packages/runtime-core`, `packages/runtime-dom`, `packages/reactivity`, `packages/compiler-core`, `packages/compiler-dom`, and `packages/compiler-sfc` in an implementation snapshot under `book/impls`.
- Write down one sentence for each package: what problem does it own?

Checkpoint:

- You can tell runtime code apart from compiler code.

## 8-18 min: first render

Read:

- [First Rendering and the createApp API](/10-minimum-example/010-create-app-api)
- [Let's Enable Rendering HTML Elements](/10-minimum-example/020-simple-h-function)
- [Let's work on supporting event handlers and attributes.](/10-minimum-example/025-event-handler-and-attrs)

Do:

- Follow how `createApp(...).mount(...)` reaches the renderer.
- Find where an element is created.
- Find where props or event handlers are applied.

Checkpoint:

- You can trace one button from render function to real DOM.

## 18-28 min: first reactivity

Read:

- [Prerequisite Knowledge for the Reactivity System](/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system)
- [Try Implementing a Small Reactivity System](/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

Do:

- Identify where an active effect is stored.
- Identify where property reads are tracked.
- Identify where property writes trigger effects.

Checkpoint:

- You understand why reactive state needs both a Proxy and an effect function.

## 28-40 min: VNode and components

Read:

- [A Minimal Virtual DOM](/10-minimum-example/040-minimum-virtual-dom)
- [Aspiring for Component-Oriented Development](/10-minimum-example/050-minimum-component)
- [Component Props](/10-minimum-example/051-component-props)
- [Component Emit](/10-minimum-example/052-component-emits)

Do:

- Compare an element VNode with a component VNode.
- Find where component `setup` is called.
- Find how props enter a component and how emit leaves it.

Checkpoint:

- You can explain why components are also represented as VNodes.

## 40-52 min: template compiler

Read:

- [Understanding the Template Compiler](/10-minimum-example/060-template-compiler)
- [Implementing the Template Compiler](/10-minimum-example/061-template-compiler-impl)
- [Data Binding](/10-minimum-example/080-template-binding)

Do:

- Trace the pipeline: template string, parse result, generated render function.
- Find where interpolation like `{{ count }}` becomes code.

Checkpoint:

- You can say what the compiler produces and why the runtime can execute it.

## 52-60 min: SFC support

Read:

- [Developing with SFC (Peripheral Knowledge)](/10-minimum-example/090-prerequisite-knowledge-for-the-sfc)
- [Parse SFC](/10-minimum-example/091-parse-sfc)
- [SFC template block](/10-minimum-example/092-compile-sfc-template)
- [SFC script block](/10-minimum-example/093-compile-sfc-script)
- [SFC style block](/10-minimum-example/094-compile-sfc-style)

Do:

- Identify the three blocks of an SFC.
- Find which block becomes render code.
- Find which block becomes component options.
- Find which block becomes CSS.

Checkpoint:

- You can describe `.vue` as a convenient authoring format that is split and transformed before the runtime sees it.

## Stop here

You now have the skeleton. The best next move is not to rush into every advanced feature. Pick one part that felt most surprising and read its full original chapter again.
