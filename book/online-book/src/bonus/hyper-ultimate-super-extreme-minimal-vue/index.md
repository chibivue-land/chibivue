# chibivue? Where is it chibi!? It's too big, I can't handle it!

## It's big...

To those who thought so, I sincerely apologize.

Before picking up this book, you may have imagined something smaller.

Allow me to make a little excuse, even I didn't intend to make it this big.

As I continued working on it, I found it enjoyable and thought, "Oh, should I add this functionality next?" And that's how it ended up like this.

## Understood. Let's set a time limit.

One of the factors that caused it to become too big was that "there was no time limit".

So, in this appendix, I will try to implement it in "**15 minutes**".

Of course, I will also limit the explanation to just one page.

Furthermore, not only the page, but also the "implementation itself will be contained in one file" is the goal I will try to achieve.

However, even if it's one file, it's meaningless to write 100,000 lines in one file, so I will aim to implement it in less than 150 lines.

The title is "**Hyper Ultimate Super Extreme Minimal Vue**".

::: info About the name

I think many people thought that the name is quite childish.

I think so too.

However, there is a proper reason for this name.

While emphasizing that it is extremely small, I wanted an abbreviation, so it became this word order.

The abbreviation is "HUSEM Vue (Balloon Vue)".

"HU-SEN" [fuːsen] means "balloon" in Japanese.

Although I will be implementing it in a very sloppy way from now on, I am comparing that sloppiness to a "balloon" that will burst if even a needle touches it.

:::

## You're just going to implement a Reactivity System, right?

No, that's not the case. This time, I will try to list what will be implemented in 15 minutes.

- create app api
- Virtual DOM
- patch rendering
- Reactivity System
- template compiler
- sfc compiler (vite-plugin)

I will be implementing these things.

In other words, SFC will work.

As for the source code, I assume that the following will work:

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
