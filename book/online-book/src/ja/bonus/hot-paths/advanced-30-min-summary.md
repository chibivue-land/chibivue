# 上級者向け 30 分サマリ

::: warning AI 生成による付録
この付録は chibivue 本編の内容をもとに GPT-5.5 で草案化したものです．学習ルートとして利用し，正確な実装や詳しい説明は本編と実装コードを参照してください．
:::

これは，ソースコードを読む前に本全体を 1 回で俯瞰したい人向けの圧縮 map です．1 checkpoint あたり 1 分くらいで眺めてください．明らかなら先に進み，曖昧ならリンク先の章を開きます．

## 30 checkpoints

1. [この本は 1 行の rendering から始まる](/ja/00-introduction/010-about): Vue を完全 clone することではなく，考え方を手で再構築することが目的です．
2. [Vue の core pieces](/ja/00-introduction/030-vue-core-components): runtime，renderer，reactivity，compiler，SFC tooling は別の関心事です．
3. [Project setup](/ja/00-introduction/040-setup-project): package boundary は学習 path を見えるようにします．
4. [createApp](/ja/10-minimum-example/010-create-app-api): app API は mount を包み，user に 1 つの entry point を渡します．
5. [Package architecture](/ja/10-minimum-example/015-package-architecture): runtime-core は platform neutral，runtime-dom は browser operation を担当します．
6. [h と VNode](/ja/10-minimum-example/020-simple-h-function): render output は DOM ではなく data structure です．
7. [Events and attributes](/ja/10-minimum-example/025-event-handler-and-attrs): DOM patching には platform specific な prop handling が必要です．
8. [Minimum reactivity](/ja/10-minimum-example/035-try-implementing-a-minimum-reactivity-system): Proxy read は track，Proxy write は trigger です．
9. [Minimum Virtual DOM](/ja/10-minimum-example/040-minimum-virtual-dom): patch は old VNode と new VNode を比べて DOM を更新します．
10. [Minimum components](/ja/10-minimum-example/050-minimum-component): component VNode は instance を作り，render を実行することで mount されます．
11. [Props](/ja/10-minimum-example/051-component-props): parent data は normalize された入力として child component に渡ります．
12. [Emits](/ja/10-minimum-example/052-component-emits): child event は，命名規則に沿った parent handler として扱えます．
13. [Template compiler overview](/ja/10-minimum-example/060-template-compiler): template は render function になります．
14. [Compiler implementation](/ja/10-minimum-example/061-template-compiler-impl): parse，transform，codegen が compiler pipeline の中心です．
15. [Template binding](/ja/10-minimum-example/080-template-binding): compiler output は render context から値を読む必要があります．
16. [SFC parse](/ja/10-minimum-example/091-parse-sfc): `.vue` file は script，template，style block に分解されます．
17. [SFC template/script/style](/ja/10-minimum-example/092-compile-sfc-template): Vite plugin が SFC transform を development に接続します．
18. [Keyed patching](/ja/20-basic-virtual-dom/010-patch-keyed-children): stable key によって renderer は child を移動し，再利用できます．
19. [Shape flags](/ja/20-basic-virtual-dom/020-bit-flags): bit flag は繰り返しの type check を安くします．
20. [Scheduler](/ja/20-basic-virtual-dom/030-scheduler): reactive change は work を queue に積み，update を batch できます．
21. [ref, computed, watch](/ja/30-basic-reactivity-system/010-ref-api): reactivity は object から value container と user-facing effect に広がります．
22. [Reactive proxy handlers](/ja/30-basic-reactivity-system/030-reactive-proxy-handlers): collection，ref，readonly，shallow value には handler の nuance が必要です．
23. [Effect cleanup and scope](/ja/30-basic-reactivity-system/040-effect-scope): effect には rerun だけでなく lifecycle management が必要です．
24. [Component lifecycle](/ja/40-basic-component-system/010-lifecycle-hooks): component instance は user hook を呼ぶ場所を runtime に与えます．
25. [Provide/Inject and setup context](/ja/40-basic-component-system/020-provide-inject): component tree には構造化された dependency と context の channel が必要です．
26. [Slots](/ja/40-basic-component-system/040-component-slot): children は lazy render function として渡せます．
27. [Template transforms](/ja/50-basic-template-compiler/010-transform): directive は syntax を VNode data に変える compiler plugin です．
28. [Structural directives](/ja/50-basic-template-compiler/040-v-if-and-structural-directive): `v-if`，`v-for`，fragment，comment，slot は generated tree の形を決めます．
29. [SFC compiler macros](/ja/60-basic-sfc-compiler/010-script-setup): `script setup`，`defineProps`，`defineEmits`，scoped CSS，type-based macros は compile-time convenience です．
30. [Application essentials and optimizations](/ja/90-web-application-essentials/010-plugins/010-router): router，store，SSR，built-ins，static hoisting，patch flags，tree flattening，Vapor Mode は，同じ core ideas がどう拡張されるかを見せます．

## サマリ後に読む source path

止まらずに 1 回流して読むなら，この順番がおすすめです．

```txt
packages/reactivity -> packages/runtime-core -> packages/runtime-dom -> packages/compiler-core -> packages/compiler-sfc
```

その後で [本家のソースコードをデバッグする](/ja/bonus/debug-vuejs-core) を読み，chibivue の簡略化された選択と `vuejs/core` を比較してください．
