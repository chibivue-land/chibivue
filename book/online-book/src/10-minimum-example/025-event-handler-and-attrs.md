# Let’s work on supporting event handlers and attributes.

## Since it's lonely just to display

Since we have the opportunity, let's implement props so that we can use click events and styles.

Regarding this part, although it is okay to implement it directly in renderVNode, let's try to proceed while considering the design following the original.

Please pay attention to the runtime-dom directory of the original Vue.js.

https://github.com/vuejs/core/tree/main/packages/runtime-dom/src

What I want you to pay particular attention to is the `modules` directory and the `patchProp.ts` file.

Inside the modules directory, there are files for manipulating classes, styles, and other props.
https://github.com/vuejs/core/tree/main/packages/runtime-dom/src/modules

These are all combined into a function called patchProp in patchProp.ts and mixed into nodeOps.

Instead of explaining in words, I will try to do it based on this design.

## Creating the framework for patchProps

First, let's create the framework.

```sh
pwd # ~
touch packages/runtime-dom/patchProp.ts
```

Contents of `runtime-dom/patchProp.ts`

```ts
type DOMRendererOptions = RendererOptions<Node, Element>

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    // patchEvent(el, key, value); // We will implement this later
  } else {
    // patchAttr(el, key, value); // We will implement this later
  }
}
```

Since the type of patchProp is not defined in RendererOptions, let's define it.

```ts
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement
> {
  // Add
  patchProp(el: HostElement, key: string, value: any): void;
  .
  .
  .
```

With this, we need to modify nodeOps to exclude parts other than patchProps.

```ts
// Omit patchProp
export const nodeOps: Omit<RendererOptions, "patchProp"> = {
  createElement: (tagName) => {
    return document.createElement(tagName);
  },
  .
  .
  .
```

Then, when generating the renderer in `runtime-dom/index`, let's change it to pass patchProp together.

```ts
const { render } = createRenderer({ ...nodeOps, patchProp })
```

## Event handlers

Let's implement patchEvent.

```sh
pwd # ~
mkdir packages/runtime-dom/modules
touch packages/runtime-dom/modules/events.ts
```

Implement events.ts.

```ts
interface Invoker extends EventListener {
  value: EventValue
}

type EventValue = Function

export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.addEventListener(event, handler)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
) {
  el.removeEventListener(event, handler)
}

export function patchEvent(
  el: Element & { _vei?: Record<string, Invoker | undefined> },
  rawName: string,
  value: EventValue | null,
) {
  // vei = vue event invokers
  const invokers = el._vei || (el._vei = {})
  const existingInvoker = invokers[rawName]

  if (value && existingInvoker) {
    // patch
    existingInvoker.value = value
  } else {
    const name = parseName(rawName)
    if (value) {
      // add
      const invoker = (invokers[rawName] = createInvoker(value))
      addEventListener(el, name, invoker)
    } else if (existingInvoker) {
      // remove
      removeEventListener(el, name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

function parseName(rawName: string): string {
  return rawName.slice(2).toLocaleLowerCase()
}

function createInvoker(initialValue: EventValue) {
  const invoker: Invoker = (e: Event) => {
    invoker.value(e)
  }
  invoker.value = initialValue
  return invoker
}
```

It's a bit long, but if you split it, it's a very simple code.

addEventListener is simply a function for registering event listeners as the name suggests.
Although you actually need to remove it at the appropriate timing, we will ignore it for now.

In patchEvent, we wrap the listener with a function called invoker and register the listener.
Regarding parseName, it simply converts prop key names such as `onClick` and `onInput` to lowercase by removing "on" (e.g. click, input).
One thing to note is that in order not to add duplicate addEventListeners to the same element, we add an invoker to the element with the name `_vei` (vue event invokers).
By updating existingInvoker.value at the time of patch, we can update the handler without adding duplicate addEventListeners.

Now let's incorporate it into patchProps and try using it in renderVNode.

patchProps

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (el, key, value) => {
  if (isOn(key)) {
    patchEvent(el, key, value)
  } else {
    // patchAttr(el, key, value); // We will implement this later
  }
}
```

renderVNode in runtime-core/renderer.ts

```ts
  const {
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    insert: hostInsert,
  } = options;
  .
  .
  .
  function renderVNode(vnode: VNode | string) {
    if (typeof vnode === "string") return hostCreateText(vnode);
    const el = hostCreateElement(vnode.type);

    // Here
    Object.entries(vnode.props).forEach(([key, value]) => {
      hostPatchProp(el, key, value);
    });
    .
    .
    .
```

Now let's run it in the playground. I will try to display a simple alert.

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', {}, [
      h('p', {}, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

We can now register event handlers with the h function!

![simple_h_function_event](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_event.png)

## Trying to support other props

After this, it's just a matter of doing the same thing with setAttribute.
We will implement this in `modules/attrs.ts`.
I would like you to try it yourself. The answer will be attached at the end of this chapter in the source code, so please check it there.
Once you can make this code work, you have reached the goal.

```ts
import { createApp, h } from 'chibivue'

const app = createApp({
  render() {
    return h('div', { id: 'my-app' }, [
      h('p', { style: 'color: red; font-weight: bold;' }, ['Hello world.']),
      h(
        'button',
        {
          onClick() {
            alert('Hello world!')
          },
        },
        ['click me!'],
      ),
    ])
  },
})

app.mount('#app')
```

![simple_h_function_attr](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/simple_h_function_attr.png)

Now we can handle a wide range of HTML!

Source code up to this point:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/020_simple_h_function)
