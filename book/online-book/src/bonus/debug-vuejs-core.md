# 本家のソースコードをデバッグする

実際に本家の Vue.js のコードを動かして動作を確かめたい場合があるかと思います。  
この本の方針としても是非とも本家のソースコード読みながら理解できるようになってほしいところもあり、ソースコードリーディングやテストプレイを強く推奨しています。

そこで、本編では触れていない本家のソースコードのデバッグ方法をいくつか紹介します。

(手軽な順番で紹介していきます。)

## SFC Playground を活用する

これは最も手軽な方法です。公式ドキュメントからもリンクされているほど、広く知られている方法です。

https://play.vuejs.org

このプレイグラウンドでは Vue のコンポーネントを記述しながら動作を確認することはもちろん、SFC のコンパイル結果を確認できます。  
サクッとブラウザ上で確認できるので便利です。(もちろん共有もできます。)

<video src="https://github.com/Ubugeeei/Ubugeeei/assets/71201308/8281e589-fdaf-4206-854e-25a66dfaac05" controls />

## vuejs/core のテストを活用する

続いては [vuejs/core](https://github.com/vuejs/core) のテストを実行してみる方法です。
当然ですが、これはもちろん [vuejs/core](https://github.com/vuejs/core) のソースコードを clone してくる必要があります。

```bash
git clone https://github.com/vuejs/core.git vuejs-core
# NOTE: `core` というリポジトリ名になっているので、わかりやすくしておくのがおすすめです
```

あとは、

```bash
cd vuejs-core
ni
nr test
```

でテストを実行する事ができるので、適宜気になるソースコードをいじってみてテストを実行してみましょう。

`test` 以外にもいくつかテストコマンドがあるので、気になる方は `package.json` を見てみてください。

テストコードを読んで把握するもよし、実際にコードをいじってテストを走らせるもよし、テストケースを追加してみるもよし、色々な使い方ができます。

<img width="590" alt="スクリーンショット 2024-01-07 0 31 29" src="https://github.com/Ubugeeei/Ubugeeei/assets/71201308/3c862bd5-1d94-4d2a-a9fa-8755872098ed">

## vuejs/core のソースコードを実際に動かしてみる

続いては、一番手軽ではないのですがやはり vuejs/core のソースコードを実際にいじりながら動作させる方法です。

こちらに関しては, SFC, standalone ともに vite で HMR できるプロジェクトを用意しているので、ぜひそちらを使ってみてください。
このプロジェクトは [chibivue](https://github.com/Ubugeeei/chibivue) のリポジトリにあるので clone してください。

```bash
git clone https://github.com/Ubugeeei/chibivue.git
```

clone できたら、プロジェクトを作成するスクリプトを実行します。

この際、ローカルにある vuejs/core のソースコードの**絶対パス**を求められるはずなので、入力してください。

```bash
cd chibi-vue
ni
nr setup:vue

# 💁 input your local vuejs/core absolute path:
#   e.g. /Users/ubugeeei/oss/vuejs-core
#   >
```

これで chibivue のリポジトリ内に ローカルの vuejs/core を指すような vue のプロジェクトが作成されます。

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/5d57c022-c411-4452-9e7e-c27623ec28b4" controls/>

あとは起動したい時に以下のコマンドで起動して、vuejs/core のソースコードをいじりながら動作を確認する事ができます。

```bash
nr dev:vue
```

playground 側の HMR はもちろん、

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/a2ad46d8-4b07-4ac5-a887-f71507c619a6" controls/>

vuejs/core のコードをいじっても HMR が効きます。

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/72f38910-19b8-4171-9ed7-74d1ba223bc8" controls/>

---

また、standalone で確認したい際は index.html で standalone-vue.js の方を読み込むように変更するとこちらも HMR で確認できます。

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/c57ab5c2-0e62-4971-b1b4-75670d3efeec" controls/>
