# Intermediate 60-minute hands-on

::: warning AI-generated appendix
This appendix was drafted with GPT-5.5 from the original chibivue book content. Treat this route as a guided learning path; the original chapters and implementation code remain the source of truth.
:::

This route is for readers who already know Vue, TypeScript, or framework internals. Instead of following the book from the first render, it follows the update path: state changes, work is scheduled, components rerender, and compiler output gives the renderer better instructions.

## Goal

By the end, you should be able to trace this path:

```txt
state mutation -> trigger -> scheduler -> component update -> patch -> DOM operation
```

You should also know where compiler transforms fit into that runtime path.

## 0-6 min: choose a working snapshot

Read:

- [Taking a Short Break](/10-minimum-example/100-break)
- [Basic Virtual DOM: key Attribute and Patch Rendering](/20-basic-virtual-dom/010-patch-keyed-children)

Do:

- Open an implementation snapshot around `book/impls/20_basic_virtual_dom/040_scheduler` or later.
- Find `renderer.ts`, `scheduler.ts`, `effect.ts`, and `vnode.ts`.

Checkpoint:

- You have the four files that explain most runtime updates.

## 6-18 min: renderer and keyed patching

Read:

- [key Attribute and Patch Rendering](/20-basic-virtual-dom/010-patch-keyed-children)
- [Bit-Level Representation of VNodes](/20-basic-virtual-dom/020-bit-flags)
- [Patch for Unhandled Props](/20-basic-virtual-dom/040-patch-other-attrs)

Do:

- Find the branch that decides whether a VNode is an element or a component.
- Find the keyed children patch function.
- Find where props are patched after an update.

Checkpoint:

- You can explain which parts of a VNode help the renderer choose a fast path.

## 18-30 min: scheduler and reactivity

Read:

- [Scheduler](/20-basic-virtual-dom/030-scheduler)
- [Reactivity Optimization](/30-basic-reactivity-system/005-reactivity-optimization)
- [computed / watch API](/30-basic-reactivity-system/020-computed-watch)
- [Effect Cleanup and Effect Scope](/30-basic-reactivity-system/040-effect-scope)

Do:

- Find where `trigger` gathers effects.
- Find where component updates are queued instead of run immediately.
- Find where duplicate jobs are avoided.
- Inspect how computed or watch changes the timing of an effect.

Checkpoint:

- You can distinguish "something changed" from "the DOM was updated." The scheduler sits between those events.

## 30-42 min: component update surface

Read:

- [Lifecycle Hooks](/40-basic-component-system/010-lifecycle-hooks)
- [Provide/Inject](/40-basic-component-system/020-provide-inject)
- [Component Proxies and setupContext](/40-basic-component-system/030-component-proxy-setup-context)
- [Slots](/40-basic-component-system/040-component-slot)

Do:

- Find the component instance shape.
- Find how `setup` results are exposed to render.
- Find where lifecycle hooks are called during mount or update.
- Find how slots are normalized before rendering.

Checkpoint:

- You can describe the component instance as the place where runtime state, props, setup state, and render context meet.

## 42-56 min: compiler as runtime preparation

Read:

- [Refactoring Implementation of Transformer for Codegen](/50-basic-template-compiler/010-transform)
- [Implementing Directives (v-bind)](/50-basic-template-compiler/020-v-bind)
- [Eval expression in template](/50-basic-template-compiler/022-transform-expression)
- [Supporting v-on](/50-basic-template-compiler/025-v-on)
- [v-if and Structural Directives](/50-basic-template-compiler/040-v-if-and-structural-directive)
- [Support for v-for](/50-basic-template-compiler/050-v-for)

Do:

- Trace one directive from AST node to generated render code.
- Identify where expressions are prefixed or evaluated against render context.
- Compare `v-if` and `v-for`: one changes branches, the other changes list shape.

Checkpoint:

- You can explain that compiler transforms produce the VNode calls the renderer later patches.

## 56-60 min: pick the next deep dive

Choose one:

- Runtime-heavy: continue with [Static Hoisting](/90-web-application-essentials/040-optimizations/010-static-hoisting), [Patch Flags](/90-web-application-essentials/040-optimizations/020-patch-flags), and [Tree Flattening](/90-web-application-essentials/040-optimizations/030-tree-flattening).
- Compiler-heavy: continue with [Basic SFC Compiler](/60-basic-sfc-compiler/010-script-setup).
- Ecosystem-heavy: continue with [Router](/90-web-application-essentials/010-plugins/010-router), [Store](/90-web-application-essentials/010-plugins/020-store), and [Language Tools](/90-web-application-essentials/010-plugins/040-language-tools).
