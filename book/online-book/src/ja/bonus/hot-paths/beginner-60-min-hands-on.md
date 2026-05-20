# 初心者向け 1 時間ハンズオン

::: warning AI 生成による付録
この付録は chibivue 本編の内容をもとに GPT-5.5 で草案化したものです．学習ルートとして利用し，正確な実装や詳しい説明は本編と実装コードを参照してください．
:::

このルートでは，本編の Minimum Example を全部吸収しようとしすぎず，大きな流れだけを 1 時間でなぞります．application API，renderer，reactivity，component，template compiler，SFC support に一度ずつ触ります．

## ゴール

最後に，なぜ chibivue が package に分かれているのか，そして `.vue` file がどう DOM update につながるのかを説明できれば OK です．

## 0-8 分: project の形を見る

読む:

- [本書の進め方と環境構築](/ja/00-introduction/040-setup-project)
- [パッケージの設計](/ja/10-minimum-example/015-package-architecture)

手を動かす:

- `book/impls` 以下の implementation snapshot で，`packages/runtime-core`，`packages/runtime-dom`，`packages/reactivity`，`packages/compiler-core`，`packages/compiler-dom`，`packages/compiler-sfc` を探す．
- それぞれの package が何を担当しているか，1 文でメモする．

チェックポイント:

- runtime のコードと compiler のコードを見分けられる．

## 8-18 分: 最初の render

読む:

- [初めてのレンダリングと createApp API](/ja/10-minimum-example/010-create-app-api)
- [HTML要素をレンダリングできるようにしよう](/ja/10-minimum-example/020-simple-h-function)
- [イベントハンドラや属性に対応してみる](/ja/10-minimum-example/025-event-handler-and-attrs)

手を動かす:

- `createApp(...).mount(...)` が renderer に届くまでを追う．
- element が作られる場所を探す．
- props や event handler が反映される場所を探す．

チェックポイント:

- 1 つの button が render function から実 DOM になるまでを追える．

## 18-28 分: 最初の reactivity

読む:

- [リアクティビティシステムの前程知識](/ja/10-minimum-example/030-prerequisite-knowledge-for-the-reactivity-system)
- [小さいリアクティビティシステムを実装してみる](/ja/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

手を動かす:

- active effect がどこに保存されているかを見る．
- property の read がどこで track されるかを見る．
- property の write がどこで effect を trigger するかを見る．

チェックポイント:

- reactive state には Proxy と effect function の両方が必要だと説明できる．

## 28-40 分: VNode と component

読む:

- [小さい仮想 DOM](/ja/10-minimum-example/040-minimum-virtual-dom)
- [コンポーネント指向で開発したい](/ja/10-minimum-example/050-minimum-component)
- [Props の実装](/ja/10-minimum-example/051-component-props)
- [Emit の実装](/ja/10-minimum-example/052-component-emits)

手を動かす:

- element VNode と component VNode を比べる．
- component の `setup` が呼ばれる場所を探す．
- props が component に入るところ，emit が外へ出るところを探す．

チェックポイント:

- component も VNode として表現される理由を説明できる．

## 40-52 分: template compiler

読む:

- [テンプレートコンパイラを理解する](/ja/10-minimum-example/060-template-compiler)
- [テンプレートコンパイラを実装する](/ja/10-minimum-example/061-template-compiler-impl)
- [データバインディング](/ja/10-minimum-example/080-template-binding)

手を動かす:

- template string，parse result，generated render function の pipeline を追う．
- `{{ count }}` のような interpolation がどこで code になるかを見る．

チェックポイント:

- compiler が何を生成し，なぜ runtime がそれを実行できるのかを説明できる．

## 52-60 分: SFC support

読む:

- [SFC で開発したい (周辺知識編)](/ja/10-minimum-example/090-prerequisite-knowledge-for-the-sfc)
- [SFC のパース](/ja/10-minimum-example/091-parse-sfc)
- [SFC の template block](/ja/10-minimum-example/092-compile-sfc-template)
- [SFC の script block](/ja/10-minimum-example/093-compile-sfc-script)
- [SFC の style block](/ja/10-minimum-example/094-compile-sfc-style)

手を動かす:

- SFC の 3 つの block を見分ける．
- どの block が render code になるかを見る．
- どの block が component options になるかを見る．
- どの block が CSS になるかを見る．

チェックポイント:

- `.vue` file は，runtime が見る前に分解されて変換される authoring format だと説明できる．

## ここで切り上げる

ここまでで骨格は見えています．次にやるべきことは，焦ってすべての advanced feature に進むことではありません．一番驚いた箇所を 1 つ選んで，本編の章をゆっくり読み直すのがおすすめです．
