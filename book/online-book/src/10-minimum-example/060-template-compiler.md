# Understanding the Template Compiler

## Actually, we have everything we need for the operation so far (?)

So far, we have implemented the Reactivity System, Virtual DOM, and Component.
Although these are very small and not practical, it is not an exaggeration to say that we have understood the overall configuration elements necessary for operation.
Although the functionality of each element itself is insufficient, it feels like we have gone through it superficially.

From this chapter, we will implement the template functionality to make it closer to Vue.js. However, these are only for improving DX and do not affect the runtime.(Strictly speaking, compiler optimization may have an impact, but since it is not the main point, we will assume it does not.)\
To be more specific, we will extend the developer interface for improving DX and "eventually convert it to the internal implementation we have made so far".

## Developer interface we want to achieve this time

At the moment, the developer interface looks like this.

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

Currently, the View part is constructed using the h function. We want to be able to write the template in the template option to make it closer to raw HTML.\
However, it is difficult to implement various things all at once, so let's start with a limited set of features. \
For now, let's divide it into the following tasks:

1. Be able to render simple tags, messages, and static attributes.

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

2. Be able to render more complex HTML.

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

3. Be able to use what is defined in the setup function.

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

We will further divide each of them into smaller parts, but let's roughly divide them into these three steps.
Let's start with step 1.

## What the Compiler Does

Now, the developer interface we are aiming for looks like this.

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

First of all, let's talk about what a compiler is.
When writing software, you will soon hear the word "compiler".
"Compile" means translation, and in the field of software, it is often used to mean translating from higher-level descriptions to lower-level descriptions.\
Do you remember this word from the beginning of this book?

> For convenience, we will call the closer to raw JS "low-level developer interface".
> And, it is important to note that "when starting implementation, start from the low-level part".
> The reason for this is that in many cases, high-level descriptions are converted to low-level descriptions and run.
> In other words, 1 and 2 are ultimately converted to the form of 3 internally.
> The implementation of this conversion is called a "compiler".

So, why do we need this thing called a compiler? One of the major purposes is to "improve the development experience".
At the very least, if a low-level interface that works is provided, it is possible to develop using only those functions.
However, it can be cumbersome and troublesome to consider various parts that are not related to the functionality, and the description may be difficult to understand. Therefore, we will redevelop only the interface part with the user's feelings in mind.

In this regard, what Vue.js aims for is to "write like raw HTML and use Vue's provided features (directives, etc.) to write views conveniently".
And, the ultimate goal is SFC.\
Recently, with the popularity of jsx/tsx, Vue also provides these as options for the developer interface. However, this time, let's try to implement Vue's original template.

I have explained it in a long article, but in the end, what I want to do this time is to implement the ability to translate (compile) code like this:

```ts
const app = createApp({ template: `<p class="hello">Hello World</p>` })
```

into this:

```ts
const app = createApp({
  render() {
    return h('p', { class: 'hello' }, ['Hello World'])
  },
})
```

To narrow down the scope a little more, it is this part:

```ts
;`<p class="hello">Hello World</p>`
// ↓
h('p', { class: 'hello' }, ['Hello World'])
```

Let's implement it step by step in several phases.

