# 初心者向け 30 分ハンズオン

::: warning AI 生成による付録
この付録は chibivue 本編の内容をもとに GPT-5.5 で草案化したものです．学習ルートとして利用し，正確な実装や詳しい説明は本編と実装コードを参照してください．
:::

このルートの目的は，小さく 1 周することです．アプリを作り，ボタンを描画し，状態を更新し，なぜコンパイラが欲しくなるのかを見るところまで進みます．[15 分で Vue を作る](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/) の勢いをベースにしつつ，少しだけ余白を持たせています．

## ゴール

最後に，次の流れを説明できれば OK です．

```txt
createApp -> render function -> VNode -> patch -> reactive state -> effect -> rerender
```

すべての edge case を理解する必要はありません．部品同士がどう接続されているかを見るのが目的です．

## 0-5 分: 小さな全体像を作る

読む:

- [chibivue、デカくないですか...?](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/)
- [プロジェクトのセットアップ](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#プロジェクトのセットアップ-0-5-min)

手を動かす:

- chibivue の playground project を作る，または既存のものを開く．
- 小さな Vue 風 API を export するファイル，たとえば `packages/index.ts` を見つける．
- このルートでは，すべての機能が雑でもよい，という前提を置く．

チェックポイント:

- public API，renderer，reactivity，compiler のコードがどこに置かれるかを把握できている．1 ファイルにまとまっていても構いません．

## 5-10 分: createApp と h

読む:

- [createApp](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#createapp-1-min)
- [h 関数と仮想 DOM](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#h-関数と仮想-dom-0-5-min)
- 余裕があれば本編: [初めてのレンダリングと createApp API](/ja/10-minimum-example/010-create-app-api)

手を動かす:

- `setup` と `render` を受け取る `createApp` を書く，または読む．
- plain object を返す `h` 関数を書く，または読む．
- VNode には demo に必要なものだけを入れる．tag，event，children で十分です．

チェックポイント:

- なぜ Vue が毎回 DOM を直接書き換えるのではなく，まず object として表現するのかを説明できる．

## 10-17 分: VNode を DOM に反映する

読む:

- [patch rendering](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl#patch-rendering-2-min)
- 余裕があれば本編: [小さい仮想 DOM](/ja/10-minimum-example/040-minimum-virtual-dom)

手を動かす:

- VNode から実 DOM 要素を作る．
- click handler を登録する．
- `mount` で取得した container に挿入する．

チェックポイント:

- render function が VNode を作り，`patch` がそれをブラウザに見える形にする，と説明できる．

## 17-23 分: 状態を reactive にする

読む:

- [実装](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl) の reactivity section
- 余裕があれば本編: [小さいリアクティビティシステムを実装してみる](/ja/10-minimum-example/035-try-implementing-a-minimum-reactivity-system)

手を動かす:

- dependency store を見る．どの effect がどの property に依存しているかを確認する．
- click handler から state を更新する．
- state が変わったときに render effect がもう一度走ることを確認する．

チェックポイント:

- `track` は「誰がこれを読んだかを覚える」，`trigger` は「これを気にしていた処理をもう一度走らせる」と言える．

## 23-28 分: 手書き render を template に置き換える

読む:

- [実装](/ja/bonus/hyper-ultimate-super-extreme-minimal-vue/15-min-impl) の compiler と SFC section
- 余裕があれば本編: [テンプレートコンパイラを理解する](/ja/10-minimum-example/060-template-compiler)，[SFC のパース](/ja/10-minimum-example/091-parse-sfc)

手を動かす:

- 小さな template が render function になる流れを見る．
- compiler はあえて狭く考える．button 1 個，event 1 個，interpolation 1 個で十分です．

チェックポイント:

- compiler は別世界の魔法ではなく，runtime がすでに実行できる render function を作るものだと説明できる．

## 28-30 分: ループを閉じる

声に出すかメモする:

- `h` はどんな object を返すのか．
- 誰が `patch` を呼ぶのか．
- なぜ `render` がもう一度走るのか．
- この小さな実装で SFC を扱うために，なぜ Vite plugin が必要なのか．

次のルート:

- 手応えがあれば [初心者向け 1 時間ハンズオン](./beginner-60-min-hands-on) に進む．
- コードが濃すぎると感じたら，[初めてのレンダリングと createApp API](/ja/10-minimum-example/010-create-app-api) をゆっくり読んでから戻る．
