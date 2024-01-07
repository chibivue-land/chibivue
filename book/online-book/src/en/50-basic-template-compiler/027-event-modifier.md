# Event Modifiers

## What to do this time

Since we implemented the v-on directive last time, let's now implement event modifiers.

Vue.js has modifiers that correspond to preventDefault and stopPropagation.

https://vuejs.org/guide/essentials/event-handling.html

This time, let's aim for the following developer interface.

```ts
import { createApp, defineComponent, ref } from 'chibivue'

const App = defineComponent({
  setup() {
    const inputText = ref('')

    const buffer = ref('')
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      buffer.value = target.value
    }
    const submit = () => {
      inputText.value = buffer.value
      buffer.value = ''
    }

    return { inputText, buffer, handleInput, submit }
  },

  template: `<div>
    <form @submit.prevent="submit">
      <label>
        Input Data
        <input :value="buffer" @input="handleInput" />
      </label>
      <button>submit</button>
    </form>
    <p>inputText: {{ inputText }}</p>
</div>`,
})

const app = createApp(App)

app.mount('#app')
```

In particular, please pay attention to the following part.

```html
<form @submit.prevent="submit"></form>
```

There is a description of `@submit.prevent`. This means that when calling the submit event handler, `preventDefault` is executed.

If you don't include `.prevent`, the page will be reloaded when submitting.

## Implementation of AST and Parser

Since we are adding a new syntax to the template, changes to the Parser and AST are necessary.

First, let's take a look at the AST. It's very simple, just add a property called `modifiers` (an array of strings) to `DirectiveNode`.

```ts
export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  name: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: string[] // Add this
}
```

Let's implement the Parser accordingly.

Actually, it's very easy because it's already included in the regular expression borrowed from the original source.

```ts
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>,
): AttributeNode | DirectiveNode {
  // .
  // .
  // .
  const modifiers = match[3] ? match[3].slice(1).split('.') : [] // Extract modifiers from the match result
  return {
    type: NodeTypes.DIRECTIVE,
    name: dirName,
    exp: value && {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: value.content,
      isStatic: false,
      loc: value.loc,
    },
    loc,
    arg,
    modifiers, // Include in the return
  }
}
```

Yes. With this, the implementation of AST and Parser is complete.

## compiler-dom/transform

Let's review the current compiler architecture a little.

The current configuration is as follows.

![50-027-compiler-architecture](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/50-027-compiler-architecture.drawio.png)

When you understand the roles of compiler-core and compiler-dom again,  
compiler-core provides compiler functionality that does not depend on the DOM, such as generating and transforming AST.

So far, we have implemented v-on directive in compiler-core, but this is just converting the notation `@click="handle"` to an object `{ onClick: handle }`,  
It does not perform any processing that depends on the DOM.

Now, let's take a look at what we want to implement this time.  
This time, we want to generate code that actually executes `e.preventDefault()` or `e.stopPropagation()`.  
These depend heavily on the DOM.

Therefore, we will also implement transformers on the compiler-dom side. We will implement transformers related to the DOM here.

In compiler-core, we need to consider the interaction between the transform in compiler-core and the transform implemented in compiler-dom.  
The interaction is how to implement the transform implemented in compiler-dom while executing the transform in compiler-core.

So first, let's modify the `DirectiveTransform` interface implemented in compiler-core.

```ts
export type DirectiveTransform = (
  dir: DirectiveNode,
  node: ElementNode,
  context: TransformContext,
  augmentor?: (ret: DirectiveTransformResult) => DirectiveTransformResult, // Added
) => DirectiveTransformResult
```

I added `augmentor`.  
Well, this is just a callback function. By allowing callbacks to be received as part of the `DirectiveTransform` interface, we make the transform function extensible.

In compiler-dom, we will implement a transformer that wraps the transformers implemented in compiler-core.

```ts
// Implementation example

// Implementation on the compiler-dom side

import { transformOn as baseTransformOn } from 'compiler-core'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransformOn(dir, node, context, () => {
    /** Implement compiler-dom's own implementation here */
    return {
      /** */
    }
  })
}
```

And if you pass this `transformOn` implemented on the compiler-dom side as an option to the compiler, it will be OK.  
Here is a diagram of the relationship.  
Instead of passing all transformers from compiler-dom, the default implementation is implemented in compiler-core, and the configuration allows additional transformers to be added.

![50-027-new-compiler-architecture](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/50-027-new-compiler-architecture.drawio.png)

With this, compiler-core can execute transformers without depending on the DOM, and compiler-dom can implement processing that depends on the DOM while executing the transformers in compiler-core.

## Implementation of the transformer

Now, let's implement the transformer on the compiler-dom side.

How should we transform it? For now, since there are various types of modifiers even if we simply say "modifier," let's classify them so that we can consider future possibilities.

This time, we will implement the "event modifier". Let's start by extracting it as `eventModifiers`.

```ts
const isEventModifier = makeMap(
  // event propagation management
  `stop,prevent,self`,
)

const resolveModifiers = (modifiers: string[]) => {
  const eventModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (isEventModifier(modifier)) {
      eventModifiers.push(modifier)
    }
  }

  return { eventModifiers }
}
```

Now that we have extracted `eventModifiers`, how should we use it? In conclusion, we will implement a helper function called `withModifiers` on the runtime-dom side and transform it into an expression that calls that function.

```ts
// runtime-dom/runtimeHelpers.ts

export const V_ON_WITH_MODIFIERS = Symbol()
```

```ts
export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const { eventModifiers } = resolveModifiers(modifiers)

    if (eventModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(eventModifiers),
      ])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
    }
  })
}
```

With this, the implementation of the transformer is almost complete.

Now let's implement `withModifiers` on the compiler-dom side.

## Implementation of `withModifiers`

Let's proceed with the implementation in runtime-dom/directives/vOn.ts.

The implementation is very simple.

Implement a guard function for event modifiers and implement it so that it runs as many times as the number of modifiers received in an array.

```ts
const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
}

export const withModifiers = (fn: Function, modifiers: string[]) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event)) return
    }
    return fn(event, ...args)
  }
}
```

That's the end of the implementation.

Let's check the operation! If the input content is reflected on the screen without the page being reloaded when the button is pressed, it's OK!

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier)

## Other Modifiers

Now that we've come this far, let's implement other modifiers.

The basic implementation approach is the same.

Let's classify the modifiers as follows:

```ts
const keyModifiers = []
const nonKeyModifiers = []
const eventOptionModifiers = []
```

Then, generate the necessary maps and classify them with `resolveModifiers`.

The two points to be careful about are:

- The difference between the modifier name and the actual DOM API name
- Implementing a new helper function to execute with specific key events (withKeys)

Please try implementing while reading the actual code!
If you've come this far, you should be able to do it.

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/027_event_modifier2)
