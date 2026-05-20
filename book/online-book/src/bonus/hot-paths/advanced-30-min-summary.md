# Advanced 30-minute summary

::: warning AI-generated appendix
This appendix was drafted with GPT-5.5 from the original chibivue book content. Treat this route as a guided learning path; the original chapters and implementation code remain the source of truth.
:::

This is a compressed map for readers who want the whole book in one pass before reading source code. Spend about one minute per checkpoint. If a checkpoint is obvious, move on. If it is fuzzy, open the linked chapter.

## 30 checkpoints

1. [The book starts from one line of rendering](/00-introduction/010-about): the point is not to clone Vue perfectly, but to rebuild the ideas by hand.
2. [Vue's core pieces](/00-introduction/030-vue-core-components): runtime, renderer, reactivity, compiler, and SFC tooling are separate concerns.
3. [Project setup](/00-introduction/040-setup-project): package boundaries make the learning path visible.
4. [createApp](/10-minimum-example/010-create-app-api): the app API wraps mounting and gives users one entry point.
5. [Package architecture](/10-minimum-example/015-package-architecture): runtime-core stays platform-neutral; runtime-dom owns browser operations.
6. [h and VNode](/10-minimum-example/020-simple-h-function): render output is a data structure, not DOM.
7. [Events and attributes](/10-minimum-example/025-event-handler-and-attrs): DOM patching needs platform-specific prop handling.
8. [Minimum reactivity](/10-minimum-example/035-try-implementing-a-minimum-reactivity-system): Proxy read means track; Proxy write means trigger.
9. [Minimum Virtual DOM](/10-minimum-example/040-minimum-virtual-dom): patch compares old and new VNodes to update the DOM.
10. [Minimum components](/10-minimum-example/050-minimum-component): a component VNode mounts by creating an instance and running render.
11. [Props](/10-minimum-example/051-component-props): parent data crosses into child components through normalized inputs.
12. [Emits](/10-minimum-example/052-component-emits): child events are just conventionally named parent handlers.
13. [Template compiler overview](/10-minimum-example/060-template-compiler): templates become render functions.
14. [Compiler implementation](/10-minimum-example/061-template-compiler-impl): parse, transform, and codegen form the core compiler pipeline.
15. [Template binding](/10-minimum-example/080-template-binding): compiler output must read values from render context.
16. [SFC parse](/10-minimum-example/091-parse-sfc): `.vue` files are split into script, template, and style blocks.
17. [SFC template/script/style](/10-minimum-example/092-compile-sfc-template): a Vite plugin wires SFC transforms into development.
18. [Keyed patching](/20-basic-virtual-dom/010-patch-keyed-children): stable keys let the renderer move and reuse children.
19. [Shape flags](/20-basic-virtual-dom/020-bit-flags): bit flags make repeated type checks cheap.
20. [Scheduler](/20-basic-virtual-dom/030-scheduler): reactive changes enqueue work so repeated updates can be batched.
21. [ref, computed, watch](/30-basic-reactivity-system/010-ref-api): reactivity grows from objects into value containers and user-facing effects.
22. [Reactive proxy handlers](/30-basic-reactivity-system/030-reactive-proxy-handlers): collections, refs, readonly values, and shallow values need handler nuance.
23. [Effect cleanup and scope](/30-basic-reactivity-system/040-effect-scope): effects need lifecycle management, not just reruns.
24. [Component lifecycle](/40-basic-component-system/010-lifecycle-hooks): component instances give the runtime places to call user hooks.
25. [Provide/Inject and setup context](/40-basic-component-system/020-provide-inject): component trees need structured dependency and context channels.
26. [Slots](/40-basic-component-system/040-component-slot): children can be passed as lazy render functions.
27. [Template transforms](/50-basic-template-compiler/010-transform): directives are compiler plugins that turn syntax into VNode data.
28. [Structural directives](/50-basic-template-compiler/040-v-if-and-structural-directive): `v-if`, `v-for`, fragments, comments, and slots shape the generated tree.
29. [SFC compiler macros](/60-basic-sfc-compiler/010-script-setup): `script setup`, `defineProps`, `defineEmits`, scoped CSS, and type-based macros are compile-time conveniences.
30. [Application essentials and optimizations](/90-web-application-essentials/010-plugins/010-router): router, store, SSR, built-ins, static hoisting, patch flags, tree flattening, and Vapor Mode show how the same core ideas scale.

## After the summary

Read one source path without stopping:

```txt
packages/reactivity -> packages/runtime-core -> packages/runtime-dom -> packages/compiler-core -> packages/compiler-sfc
```

Then read [Debugging the original source code](/bonus/debug-vuejs-core) and compare chibivue's simplified choices with `vuejs/core`.
