# 中級者向け 1 時間ハンズオン

::: warning AI 生成による付録
この付録は chibivue 本編の内容をもとに GPT-5.5 で草案化したものです．学習ルートとして利用し，正確な実装や詳しい説明は本編と実装コードを参照してください．
:::

このルートは，Vue，TypeScript，framework internals にある程度慣れている人向けです．最初の render から順番に読むのではなく，update path を追います．state が変わり，work が schedule され，component が rerender され，compiler output が renderer によりよい指示を渡す，という流れです．

## ゴール

最後に，次の流れを追えれば OK です．

```txt
state mutation -> trigger -> scheduler -> component update -> patch -> DOM operation
```

あわせて，compiler transform が runtime path のどこに効くのかも見える状態を目指します．

## 0-6 分: working snapshot を選ぶ

読む:

- [ちょっと一息](/ja/10-minimum-example/100-break)
- [key属性とパッチレンダリング](/ja/20-basic-virtual-dom/010-patch-keyed-children)

手を動かす:

- `book/impls/20_basic_virtual_dom/040_scheduler` 以降の implementation snapshot を開く．
- `renderer.ts`，`scheduler.ts`，`effect.ts`，`vnode.ts` を探す．

チェックポイント:

- runtime update の大部分を説明する 4 つの file を手元に置けている．

## 6-18 分: renderer と keyed patching

読む:

- [key属性とパッチレンダリング](/ja/20-basic-virtual-dom/010-patch-keyed-children)
- [ビットによるVNodeの表現](/ja/20-basic-virtual-dom/020-bit-flags)
- [対応できていない Props のパッチ](/ja/20-basic-virtual-dom/040-patch-other-attrs)

手を動かす:

- VNode が element なのか component なのかを判断する branch を探す．
- keyed children patch function を探す．
- update 後に props が patch される場所を探す．

チェックポイント:

- VNode のどの情報が renderer の fast path 選択に効くのかを説明できる．

## 18-30 分: scheduler と reactivity

読む:

- [スケジューラ](/ja/20-basic-virtual-dom/030-scheduler)
- [Reactivity の最適化](/ja/30-basic-reactivity-system/005-reactivity-optimization)
- [computed / watch api](/ja/30-basic-reactivity-system/020-computed-watch)
- [Effect のクリーンアップと Effect Scope](/ja/30-basic-reactivity-system/040-effect-scope)

手を動かす:

- `trigger` が effect を集める場所を探す．
- component update が即時実行ではなく queue に積まれる場所を探す．
- duplicate job が避けられる場所を見る．
- computed や watch が effect の timing をどう変えるかを見る．

チェックポイント:

- 「何かが変わった」と「DOM が更新された」を区別できる．その間に scheduler があります．

## 30-42 分: component update の表面積を見る

読む:

- [ライフサイクルフック](/ja/40-basic-component-system/010-lifecycle-hooks)
- [Provide/Inject](/ja/40-basic-component-system/020-provide-inject)
- [コンポーネントの Proxy と setupContext](/ja/40-basic-component-system/030-component-proxy-setup-context)
- [スロット](/ja/40-basic-component-system/040-component-slot)

手を動かす:

- component instance の shape を見る．
- `setup` result が render に公開される場所を見る．
- mount や update の中で lifecycle hook が呼ばれる場所を見る．
- slot が render 前に normalize される場所を見る．

チェックポイント:

- component instance は runtime state，props，setup state，render context が集まる場所だと説明できる．

## 42-56 分: compiler を runtime の準備として見る

読む:

- [Transformer の実装 の Codegen のリファクタ](/ja/50-basic-template-compiler/010-transform)
- [ディレクティブを実装しよう (v-bind)](/ja/50-basic-template-compiler/020-v-bind)
- [template 内での式の評価](/ja/50-basic-template-compiler/022-transform-expression)
- [v-on に対応する](/ja/50-basic-template-compiler/025-v-on)
- [v-if と構造的ディレクティブ](/ja/50-basic-template-compiler/040-v-if-and-structural-directive)
- [v-for に対応する](/ja/50-basic-template-compiler/050-v-for)

手を動かす:

- 1 つの directive が AST node から generated render code になるまでを追う．
- expression が render context に対して評価されるように加工される場所を探す．
- `v-if` と `v-for` を比べる．片方は branch を変え，片方は list shape を変える．

チェックポイント:

- compiler transform は，renderer があとで patch する VNode call を作るものだと説明できる．

## 56-60 分: 次の深掘りを選ぶ

どれか 1 つ選びます．

- runtime 寄り: [Static Hoisting](/ja/90-web-application-essentials/040-optimizations/010-static-hoisting)，[Patch Flags](/ja/90-web-application-essentials/040-optimizations/020-patch-flags)，[Tree Flattening](/ja/90-web-application-essentials/040-optimizations/030-tree-flattening)
- compiler 寄り: [Basic SFC Compiler](/ja/60-basic-sfc-compiler/010-script-setup)
- ecosystem 寄り: [ルーター](/ja/90-web-application-essentials/010-plugins/010-router)，[ストア](/ja/90-web-application-essentials/010-plugins/020-store)，[Language Tools](/ja/90-web-application-essentials/010-plugins/040-language-tools)
