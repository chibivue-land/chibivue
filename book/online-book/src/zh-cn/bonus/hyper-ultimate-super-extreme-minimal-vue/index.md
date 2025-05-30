# chibivue？哪里小了！？太大了，我处理不了！

## 它很大...

对于那些这样想的人，我真诚地道歉。

在拿起这本书之前，您可能想象的是更小的东西。

请允许我稍作辩解，即使是我也没有打算把它做得这么大。

当我继续工作时，我发现它很有趣，并想，"哦，我下一步应该添加这个功能吗？"就这样变成了这样。

## 明白了。让我们设定一个时间限制。

导致它变得太大的因素之一是"没有时间限制"。

所以，在这个附录中，我将尝试在"**15 分钟**"内实现它。

当然，我也会将解释限制在一页内。

此外，不仅是页面，"实现本身将包含在一个文件中"也是我将尝试实现的目标。

但是，即使是一个文件，在一个文件中写 100,000 行也是没有意义的，所以我将目标是在少于 150 行内实现它。

标题是"**Hyper Ultimate Super Extreme Minimal Vue**"。

::: info 关于名称

我想很多人认为这个名字相当幼稚。

我也这么认为。

但是，这个名字有一个合适的理由。

在强调它极其小的同时，我想要一个缩写，所以就变成了这个词序。

缩写是"HUSEM Vue (Balloon Vue)"。

"HU-SEN" [fuːsen] 在日语中意思是"气球"。

虽然我现在将以一种非常草率的方式实现它，但我将这种草率比作一个"气球"，即使针碰到它也会爆炸。

:::

## 你只是要实现一个响应式系统，对吧？

不，不是这样的。这次，我将尝试列出将在 15 分钟内实现的内容。

- create app api
- Virtual DOM
- patch rendering
- Reactivity System
- template compiler
- sfc compiler (vite-plugin)

我将实现这些东西。

换句话说，SFC 将工作。

至于源代码，我假设以下内容将工作：

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
