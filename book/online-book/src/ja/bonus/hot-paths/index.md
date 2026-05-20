# Hot Paths

::: warning AI 生成による付録
この付録は chibivue 本編の内容をもとに GPT-5.5 で草案化したものです．学習ルートとして利用し，正確な実装や詳しい説明は本編と実装コードを参照してください．
:::

chibivue は段階的に実装できるように作られていますが，そのぶん全体はかなり大きくなっています．この付録では，本編を最初から最後まで読む前に，短時間で要点をつかむためのルートを用意します．

それぞれのルートには，読む場所，手を動かす場所，いったん切り上げる場所を置いています．速すぎると感じたら，リンク先の本編に戻ってからまたこのルートに戻ってきてください．

## ルート

| ルート | 所要時間 | 対象 | つかめること |
| --- | --- | --- | --- |
| [初心者向け 30 分ハンズオン](./beginner-30-min-hands-on) | 30 分 | まず小さく動かしたい人 | `createApp`，VNode レンダリング，リアクティビティ，小さなコンパイラのつながり |
| [初心者向け 1 時間ハンズオン](./beginner-60-min-hands-on) | 60 分 | まとまった 1 セッションで進めたい初心者 | 最初のレンダリングから SFC までの Minimum Example 全体 |
| [中級者向け 1 時間ハンズオン](./intermediate-60-min-hands-on) | 60 分 | Vue や TypeScript に慣れている人 | コンポーネント更新を支える runtime と compiler のホットパス |
| [上級者向け 30 分サマリ](./advanced-30-min-summary) | 30 分 | ソースリーディング前に全体地図がほしい人 | 本全体を 30 個のチェックポイントで俯瞰すること |

## 使い方

1. ルートと本編の章を横に並べて読む．
2. 各セクションは時間で区切る．全部を完璧に理解するより，全体像を保つことを優先する．
3. 実装と照らしたくなったら `book/impls` 以下のスナップショットを見る．
4. ルートを終えたら，気になった本編の章を 1 つ選んでゆっくり読み直す．ホットパスは地図であって，本編の代わりではありません．

## 対応する本編

- [Getting Started](/ja/00-introduction/010-about)
- [Minimum Example](/ja/10-minimum-example/010-create-app-api)
- [Basic Virtual DOM](/ja/20-basic-virtual-dom/010-patch-keyed-children)
- [Basic Reactivity System](/ja/30-basic-reactivity-system/005-reactivity-optimization)
- [Basic Component System](/ja/40-basic-component-system/010-lifecycle-hooks)
- [Basic Template Compiler](/ja/50-basic-template-compiler/010-transform)
- [Basic SFC Compiler](/ja/60-basic-sfc-compiler/010-script-setup)
- [Web Application Essentials](/ja/90-web-application-essentials/010-plugins/010-router)
- [15 分で Vue を作る](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/)
