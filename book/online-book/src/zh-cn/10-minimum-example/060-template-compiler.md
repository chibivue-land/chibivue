# 理解模板编译器

## 实际上，到目前为止我们已经拥有了运行所需的一切（？）

到目前为止，我们已经实现了响应式系统、虚拟 DOM 和组件。
虽然这些都非常小且不实用，但可以毫不夸张地说，我们已经理解了运行所需的整体配置元素。
虽然每个元素本身的功能都不足，但感觉我们已经表面上过了一遍。

从本章开始，我们将实现模板功能，使其更接近 Vue.js。但是，这些只是为了改善 DX，不会影响运行时。（严格来说，编译器优化可能会有影响，但由于这不是重点，我们假设它没有影响。）\
更具体地说，我们将扩展开发者接口以改善 DX，并"最终将其转换为我们迄今为止制作的内部实现"。

## 这次我们想要实现的开发者接口

目前，开发者接口看起来像这样。

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

目前，View 部分是使用 h 函数构建的。我们希望能够在 template 选项中编写模板，使其更接近原始 HTML。\
但是，一次实现各种东西是困难的，所以让我们从有限的功能集开始。\
现在，让我们将其分为以下任务：

1. 能够渲染简单的标签、消息和静态属性。

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

2. 能够渲染更复杂的 HTML。

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

3. 能够使用在 setup 函数中定义的内容。

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

我们将进一步将每个任务分为更小的部分，但让我们大致分为这三个步骤。
让我们从步骤 1 开始。

## 编译器的作用

现在，我们的目标开发者接口看起来像这样。

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

首先，让我们谈谈什么是编译器。
在编写软件时，您很快就会听到"编译器"这个词。
"编译"意味着翻译，在软件领域，它通常用于表示从高级描述翻译到低级描述。\
您还记得本书开头的这个词吗？

> 为了方便起见，我们将更接近原始 JS 的称为"低级开发者接口"。
> 而且，重要的是要注意"开始实现时，从低级部分开始"。
> 这样做的原因是，在许多情况下，高级描述被转换为低级描述并运行。
> 换句话说，1 和 2 最终在内部转换为 3 的形式。
> 这种转换的实现称为"编译器"。

那么，为什么我们需要这个叫做编译器的东西呢？主要目的之一是"改善开发体验"。
至少，如果提供了一个有效的低级接口，就可以仅使用这些函数进行开发。
但是，考虑与功能无关的各种部分可能会很麻烦和困难，描述可能难以理解。因此，我们将仅重新开发接口部分，考虑用户的感受。

在这方面，Vue.js 的目标是"像原始 HTML 一样编写，并使用 Vue 提供的功能（指令等）方便地编写视图"。
而且，最终目标是 SFC。\
最近，随着 jsx/tsx 的流行，Vue 也提供这些作为开发者接口的选项。但是，这次，让我们尝试实现 Vue 的原始模板。

我已经用长篇文章解释了它，但最终，我这次想要做的是实现将这样的代码翻译（编译）的能力：

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

转换为这样：

```ts
const app = createApp({
  render() {
    return h('p', { class: 'hello' }, ['Hello World'])
  },
})
```

为了进一步缩小范围，就是这部分：

```ts
;`<p class="hello">Hello World</p>`
// ↓
h('p', { class: 'hello' }, ['Hello World'])
```

让我们分几个阶段逐步实现它。
