# 理解模板編譯器

## 實際上，到目前為止我們已經擁有了運行所需的一切（？）

到目前為止，我們已經實現了響應式系統、虛擬 DOM 和組件。
雖然這些都非常小且不實用，但可以毫不誇張地說，我們已經理解了運行所需的整體配置元素。
雖然每個元素本身的功能都不足，但感覺我們已經表面上過了一遍。

從本章開始，我們將實現模板功能，使其更接近 Vue.js。但是，這些只是為了改善 DX，不會影響執行時。（嚴格來說，編譯器最佳化可能會有影響，但由於這不是重點，我們假設它沒有影響。）\
更具體地說，我們將擴展開發者介面以改善 DX，並「最終將其轉換為我們迄今為止製作的內部實現」。

## 這次我們想要實現的開發者介面

目前，開發者介面看起來像這樣。

```ts
const MyComponent: Component = {
  props: { someMessage: { type: String } },

  setup(props: any, { emit }: any) {
    return () =>
      h('div', {}, [
        h('p', {}, [`someMessage: ${props.someMessage}`]),
        h('button', { onClick: () => emit('click:change-message') }, [
          'change message',
        ]),
      ])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })
    const changeMessage = () => {
      state.message += '!'
    }

    return () =>
      h('div', { id: 'my-app' }, [
        h(
          MyComponent,
          {
            'some-message': state.message,
            'onClick:change-message': changeMessage,
          },
          [],
        ),
      ])
  },
})
```

目前，View 部分是使用 h 函式建構的。我們希望能夠在 template 選項中編寫模板，使其更接近原始 HTML。\
但是，一次實現各種東西是困難的，所以讓我們從有限的功能集開始。\
現在，讓我們將其分為以下任務：

1. 能夠渲染簡單的標籤、訊息和靜態屬性。

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

2. 能夠渲染更複雜的 HTML。

```ts
const app = createApp({
  template: `
    <div>
      <p>hello</p>
      <button> click me! </button>
    </div>
  `,
})
```

3. 能夠使用在 setup 函式中定義的內容。

```ts
const app = createApp({
  setup() {
    const count = ref(0)
    const increment = () => {
      count.value++
    }

    return { count, increment }
  },

  template: `
    <div>
      <p>count: {{ count }}</p>
      <button v-on:click="increment"> click me! </button>
    </div>
  `,
})
```

我們將進一步將每個任務分為更小的部分，但讓我們大致分為這三個步驟。
讓我們從步驟 1 開始。

## 編譯器的作用

現在，我們的目標開發者介面看起來像這樣。

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

首先，讓我們談談什麼是編譯器。
在編寫軟體時，您很快就會聽到「編譯器」這個詞。
「編譯」意味著翻譯，在軟體領域，它通常用於表示從高級描述翻譯到低級描述。\
您還記得本書開頭的這個詞嗎？

> 為了方便起見，我們將更接近原始 JS 的稱為「低級開發者介面」。
> 而且，重要的是要注意「開始實現時，從低級部分開始」。
> 這樣做的原因是，在許多情況下，高級描述被轉換為低級描述並執行。
> 換句話說，1 和 2 最終在內部轉換為 3 的形式。
> 這種轉換的實現稱為「編譯器」。

那麼，為什麼我們需要這個叫做編譯器的東西呢？主要目的之一是「改善開發體驗」。
至少，如果提供了一個有效的低級介面，就可以僅使用這些函式進行開發。
但是，考慮與功能無關的各種部分可能會很麻煩和困難，描述可能難以理解。因此，我們將僅重新開發介面部分，考慮使用者的感受。

在這方面，Vue.js 的目標是「像原始 HTML 一樣編寫，並使用 Vue 提供的功能（指令等）方便地編寫視圖」。
而且，最終目標是 SFC。\
最近，隨著 jsx/tsx 的流行，Vue 也提供這些作為開發者介面的選項。但是，這次，讓我們嘗試實現 Vue 的原始模板。

我已經用長篇文章解釋了它，但最終，我這次想要做的是實現將這樣的程式碼翻譯（編譯）的能力：

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

轉換為這樣：

```ts
const app = createApp({
  render() {
    return h('p', { class: 'hello' }, ['Hello World'])
  },
})
```

為了進一步縮小範圍，就是這部分：

```ts
;`<p class="hello">Hello World</p>`
// ↓
h('p', { class: 'hello' }, ['Hello World'])
```

讓我們分幾個階段逐步實現它。
