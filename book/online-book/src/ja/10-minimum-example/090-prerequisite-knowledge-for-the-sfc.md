# Single File Component で開発したい (周辺知識編)

## SFC はどうやって実現されている？

ここからはいよいよ SFC (Single File Component) の対応をやっていきます．  
さて，どのように対応していきましょう．\
SFC はテンプレートと同様，開発時に使われるものでランタイム上には存在しません．  
テンプレートの開発を終えたみなさんにとっては何をどのようにコンパイルすればいいかは簡単な話だと思います．

以下のような SFC を

```vue
<script>
export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },
}
</script>

<template>
  <div class="container" style="text-align: center">
    <h2>message: {{ state.message }}</h2>
    <img
      width="150px"
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
      alt="Vue.js Logo"
    />
    <p><b>chibivue</b> is the minimal Vue.js</p>

    <button @click="changeMessage">click me!</button>
  </div>
</template>

<style>
.container {
  height: 100vh;
  padding: 16px;
  background-color: #becdbe;
  color: #2c3e50;
}
</style>
```

以下のような JS のコードに変換すれば良いのです．

```ts
export default {
  setup() {
    const state = reactive({ message: 'Hello, chibivue!' })
    const changeMessage = () => {
      state.message += '!'
    }

    return { state, changeMessage }
  },

  render(_ctx) {
    return h('div', { class: 'container', style: 'text-align: center' }, [
      h('h2', `message: ${_ctx.state.message}`),
      h('img', {
        width: '150px',
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png',
      }),
      h('p', [h('b', 'chibivue'), ' is the minimal Vue.js']),
      h('button', { onClick: _ctx.changeMessage }, 'click me!'),
    ])
  },
}
```

えっスタイルは！？ と思った方もいるかもしれませんが，一旦そのことは忘れて template と script について考えてみましょう．\
script setup についても minimum example では触れません．

## どのタイミングでいつどうやってコンパイルするの？

結論から言ってしまうと，「ビルドツールが依存を解決するときにコンパイラを噛ませる」です．
多くの場合 SFC は他のファイルから import して使います．
この時に，`.vue` というファイルが解決される際にコンパイルをして，結果を App にバインドさせるようなプラグインを書きます．

```ts
import App from './App.vue' // App.vueが読み込まれるときにコンパイル

const app = createApp(App)
app.mount('#app')
```

さまざまなビルドツールがありますが，今回は Vite のプラグインを書いてみます．

Vite のプラグインを書いたことのない方も少ないと思うので，まずは簡単なサンプルコードでプラグインの実装に慣れてみましょう．\
とりあえず簡単な Vue のプロジェクトを作ってみます．

```sh
pwd # ~
nlx create-vite
## ✔ Project name: … plugin-sample
## ✔ Select a framework: › Vue
## ✔ Select a variant: › TypeScript

cd plugin-sample
ni
```

作った PJ の vite.config.ts を見てみましょう．

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```

何やら @vitejs/plugin-vue を plugin に追加しているのがわかるかと思います．  
実は，Vite で Vue の PJ を作るとき，SFC が使えているのはこれのおかげなのです．  
このプラグインには SFC のコンパイラが Vite のプラグインの API に沿って実装されていて，Vue ファイルを JS ファイルにコンパイルしています．  
このプロジェクトで簡単なプラグインを作ってみましょう．

```ts
import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), myPlugin()],
})

function myPlugin(): Plugin {
  return {
    name: 'vite:my-plugin',

    transform(code, id) {
      if (id.endsWith('.sample.js')) {
        let result = ''

        for (let i = 0; i < 100; i++) {
          result += `console.log("HelloWorld from plugin! (${i})");\n`
        }

        result += code

        return { code: result }
      }
    },
  }
}
```

myPlugin という名前で作ってみました．  
簡単なので説明しなくても読める方も多いと思いますが一応説明しておきます．

プラグインは Vite が要求する形式に合わせます．いろんなオプションがありますが，今回は簡単なサンプルなので transform オプションのみを使用しました．  
他は公式ドキュメント等を眺めてもらえるのがいいかと思います．https://vitejs.dev/guide/api-plugin.html

transform では `code` と `id` を受け取ることができます．code はファイルの内容，id はファイル名と思ってもらって良いです．\
戻り値として，code というプロパティに成果物を突っ込みます．  
あとは id によってファイルの種類ごとに処理を書いたり，code をいじってファイルの内容を書き換えたりすれば OK です．  
今回は，`*.sample.js`というファイルに対して，ファイルの内容の先頭に console を 100 個数仕込むように書き換えてみました．  
では実際に，適当な plugin.sample.js を実装をして確認してみます．

```sh
pwd # ~/plugin-sample
touch src/plugin.sample.js
```

`~/plugin-sample/src/plugin.sample.js`

```ts
function fizzbuzz(n) {
  for (let i = 1; i <= n; i++) {
    i % 3 === 0 && i % 5 === 0
      ? console.log('fizzbuzz')
      : i % 3 === 0
        ? console.log('fizz')
        : i % 5 === 0
          ? console.log('buzz')
          : console.log(i)
  }
}

fizzbuzz(Math.floor(Math.random() * 100) + 1)
```

`~/plugin-sample/src/main.ts`

```ts
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import './plugin.sample.js' // 追加

createApp(App).mount('#app')
```

ブラウザで確認してみましょう．

```sh
pwd # ~/plugin-sample
nr dev
```

![sample_vite_plugin_console](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_console.png)

![sample_vite_plugin_source](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/sample_vite_plugin_source.png)

ちゃんとソースコードが改変されていることがわかります．

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler)