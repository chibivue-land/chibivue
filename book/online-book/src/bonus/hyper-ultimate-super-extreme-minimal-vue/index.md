# chibivue？ どこが chibi なんだ！？デカすぎてやってらんないよ！？

## 大きいじゃん......

そう思った方、誠に申し訳ございません。

この本を手に取る前はもっと小さいものを想像していたかもしれません。

少し言い訳させていただきますと、僕自身もこんなに大きくやるつもりはなかったんです。

やってくうちについ楽しくて、「お、次はこの辺機能追加してみるか」とやっていったところ今のようになってしまいました。

## わかりました。制限時間を設けましょう。

大きくなりすぎてしまった要因の一つとして、「時間に制限がなかった」という点が挙げられます。

そこで、この付録では 「**15 分**」で実装してみます。

説明ももちろん 1 ページだけに収めます。

さらに、ページのみならず、「実装自体も 1 ファイルに収める」ことを目標にやってみます。

ただ 1 ファイルといっても 1 ファイルに 10 万行書いてしまっては意味がないですから、150 行いないくらいを目標に実装していきます。

題して、「**Hyper Ultimate Super Extreme Minimal Vue**」

::: info 名前の由来について

なんとも幼稚な名前だなと思った方が多いと思います。

僕もそう思います。

ただ、この名前にはちゃんとした由来があります。

とにかく小さいということを強調しつつ、略称は欲しかったので、この語順になってます。

その略称というのが「HUSEM Vue (風船 Vue)」 です。

これからとっても雑な実装をしていきますが、その雑さを「風船」に例えています。
少しでも針が触れると破裂してしまうようなイメージです。

:::

## どうせ リアクティブシステムをちょろっと実装するだけなんでしょ？

いいえ、そうではありません。今回 15 分で対応するものをいかに列挙してみます。

- create app api
- Virtual DOM
- patch rendering
- Reactivity System
- template compiler
- sfc compiler (vite-plugin)

これくらいものを実装していきます。

つまり、SFC が動きます。

ソースコードとしては、以下のようなものが動作する想定をしています。

```vue
<script>
import { reactive } from 'hyper-ultimate-super-extreme-minimal-vue'

export default {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++
    return { state, increment }
  },
}
</script>

<template>
  <button @click="increment">state: {{ state.count }}</button>
</template>
```

```ts
import { createApp } from 'hyper-ultimate-super-extreme-minimal-vue'

// @ts-ignore
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```
