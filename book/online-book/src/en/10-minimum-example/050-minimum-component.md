# I want to develop using a component-based approach.

## Thinking based on organizing existing implementations

So far, we have implemented createApp API, Reactivity System, and Virtual DOM system in a small scale.
With the current implementation, we can dynamically change the UI using the Reactivity System and perform efficient rendering using the Virtual DOM system. However, as a developer interface, everything is written in createAppAPI.
In reality, I want to divide the files more and implement generic components for reusability.
First, let's review the parts that are currently messy in the existing implementation. Please take a look at the render function in renderer.ts.

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const componentRender = rootComponent.setup!()

  let n1: VNode | null = null
  let n2: VNode = null!

  const updateComponent = () => {
    const n2 = componentRender()
    patch(n1, n2, container)
    n1 = n2
  }

  const effect = new ReactiveEffect(updateComponent)
  effect.run()
}
```

In the render function, information about the root component is directly defined.
In reality, n1, n2, updateComponent, and effect exist for each component.
In fact, from now on, I want to define the component (in a sense, the constructor) on the user side and instantiate it.
And I want the instance to have properties such as n1, n2, and updateComponent.
So, let's think about encapsulating these as a component instance.

Let's define something called `ComponentInternalInstance` in `~/packages/runtime-core/component.ts`. This will be the type of the instance.

```ts
export interface ComponentInternalInstance {
  type: Component // The original user-defined component (old rootComponent (actually not just the root component))
  vnode: VNode // To be explained later
  subTree: VNode // Old n1
  next: VNode | null // Old n2
  effect: ReactiveEffect // Old effect
  render: InternalRenderFunction // Old componentRender
  update: () => void // Old updateComponent
  isMounted: boolean
}

export type InternalRenderFunction = {
  (): VNodeChild
}
```

The vnode, subTree, and next properties that this instance has are a bit complicated,
but from now on, we will implement it so that ConcreteComponent can be specified as the type of VNode.
In instance.vnode, we will keep the VNode itself.
And subTree and next will hold the rendering result VNode of that component. (This is the same as before with n1 and n2)

In terms of image,

```ts
const MyComponent = {
  setup() {
    return h('p', {}, ['hello'])
  },
}

const App = {
  setup() {
    return h(MyComponent, {}, [])
  },
}
```

You can use it like this,
and if you let the instance be instance of MyComponent, instance.vnode will hold the result of `h(MyComponent, {}, [])`, and instance.subTree will hold the result of `h("p", {}, ["hello"])`.

For now, let's implement it so that you can specify a component as the first argument of the h function.
However, it's just a matter of receiving an object that defines the component as the type.
In `~/packages/runtime-core/vnode.ts`

```ts
export type VNodeTypes = string | typeof Text | object // Add object;
```

In `~/packages/runtime-core/h.ts`

```ts
export function h(
  type: string | object, // Add object
  props: VNodeProps
) {..}
```

Let's also make sure that VNode has a component instance.

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  component: ComponentInternalInstance | null // Add
}
```

As a result, the renderer also needs to handle components. Implement `processComponent` similar to `processElement` and `processText` for handling components, and also implement `mountComponent` and `patchComponent` (or `updateComponent`).

First, let's start with an overview and detailed explanation.

```ts
const patch = (n1: VNode | null, n2: VNode, container: RendererElement) => {
  const { type } = n2
  if (type === Text) {
    processText(n1, n2, container)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container)
  } else if (typeof type === 'object') {
    // Add branching
    processComponent(n1, n2, container)
  } else {
    // do nothing
  }
}

const processComponent = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
) => {
  if (n1 == null) {
    mountComponent(n2, container)
  } else {
    updateComponent(n1, n2)
  }
}

const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  // TODO:
}

const updateComponent = (n1: VNode, n2: VNode) => {
  // TODO:
}
```

Now, let's take a look at `mountComponent`. There are three things to do.

1. Create an instance of the component.
2. Execute the `setup` function and store the result in the instance.
3. Create a `ReactiveEffect` and store it in the instance.

First, let's implement a function in `component.ts` to create an instance of the component (similar to a constructor).

```ts
export function createComponentInstance(
  vnode: VNode,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const instance: ComponentInternalInstance = {
    type,
    vnode,
    next: null,
    effect: null!,
    subTree: null!,
    update: null!,
    render: null!,
    isMounted: false,
  }

  return instance
}
```

Although the type of each property is non-null, we initialize them with null when creating the instance (following the design of the original Vue.js).

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))
  // TODO: setup component
  // TODO: setup effect
}
```

Next is the `setup` function. We need to move the code that was previously written directly in the `render` function to here and store the result in the instance instead of using variables.

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))

  const component = initialVNode.type as Component
  if (component.setup) {
    instance.render = component.setup() as InternalRenderFunction
  }

  // TODO: setup effect
}
```

Finally, let's combine the code for creating the effect into a function called `setupRenderEffect`. Again, the main task is to move the code that was previously implemented directly in the `render` function to here, while utilizing the state of the instance.

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
  const instance: ComponentInternalInstance = (initialVNode.component =
    createComponentInstance(initialVNode))

  const component = initialVNode.type as Component
  if (component.setup) {
    instance.render = component.setup() as InternalRenderFunction
  }

  setupRenderEffect(instance, initialVNode, container)
}

const setupRenderEffect = (
  instance: ComponentInternalInstance,
  initialVNode: VNode,
  container: RendererElement,
) => {
  const componentUpdateFn = () => {
    const { render } = instance

    if (!instance.isMounted) {
      // mount process
      const subTree = (instance.subTree = normalizeVNode(render()))
      patch(null, subTree, container)
      initialVNode.el = subTree.el
      instance.isMounted = true
    } else {
      // patch process
      let { next, vnode } = instance

      if (next) {
        next.el = vnode.el
        next.component = instance
        instance.vnode = next
        instance.next = null
      } else {
        next = vnode
      }

      const prevTree = instance.subTree
      const nextTree = normalizeVNode(render())
      instance.subTree = nextTree

      patch(prevTree, nextTree, hostParentNode(prevTree.el!)!) // ※ 1
      next.el = nextTree.el
    }
  }

  const effect = (instance.effect = new ReactiveEffect(componentUpdateFn))
  const update = (instance.update = () => effect.run()) // Register to instance.update
  update()
}
```

※ 1: Please implement a function called `parentNode` in `nodeOps` that retrieves the parent Node.

```ts
parentNode: (node) => {
    return node.parentNode;
},
```

I think it's not particularly difficult, although it's a bit long.
In the `setupRenderEffect` function, a function for updating is registered as the `update` method of the instance, so in `updateComponent`, we just need to call that function.

```ts
const updateComponent = (n1: VNode, n2: VNode) => {
  const instance = (n2.component = n1.component)!
  instance.next = n2
  instance.update()
}
```

Finally, since the implementation that was defined in the `render` function so far is no longer needed, we will remove it.

```ts
const render: RootRenderFunction = (rootComponent, container) => {
  const vnode = createVNode(rootComponent, {}, [])
  patch(null, vnode, container)
}
```

Now we can render components. Let's try creating a `playground` component as an example.
In this way, we can divide the rendering into components.

```ts
import { createApp, h, reactive } from 'chibivue'

const CounterComponent = {
  setup() {
    const state = reactive({ count: 0 })
    const increment = () => state.count++

    return () =>
      h('div', {}, [
        h('p', {}, [`count: ${state.count}`]),
        h('button', { onClick: increment }, ['increment']),
      ])
  },
}

const app = createApp({
  setup() {
    return () =>
      h('div', { id: 'my-app' }, [
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
        h(CounterComponent, {}, []),
      ])
  },
})

app.mount('#app')
```

Source code up to this point:
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/050_component_system)

## Communication between components

Now that we can use components and make them reusable, we want to make them more convenient by using Props and Emits to communicate between components.
From here, we will proceed with the implementation to enable communication between components using Props/Emit.

## Props

Let's start with props.
Let's think about the final developer interface.
Let's consider that props are passed as the first argument to the `setup` function.

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
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
        h(MyComponent, { message: state.message }, []),
      ])
  },
})
```

Based on this, let's think about the information we want to have in `ComponentInternalInstance`.
We need the definition of props specified as `props: { message: { type: String } }`, and a property to actually hold the props value, so we add the following:

```ts
export type Data = Record<string, unknown>

export interface ComponentInternalInstance {
  // .
  // .
  // .
  propsOptions: Props // Holds an object like `props: { message: { type: String } }`

  props: Data // Holds the actual data passed from the parent (in this case, it will be something like `{ message: "hello" }`)
}
```

Create a new file called `~/packages/runtime-core/componentProps.ts` with the following content:

```ts
export type Props = Record<string, PropOptions | null>

export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: null | undefined | object
}

export type PropType<T> = { new (...args: any[]): T & {} }
```

Add it to the options when implementing the component.

```ts
export type ComponentOptions = {
  props?: Record<string, any> // Added
  setup?: () => Function
  render?: Function
}
```

When generating an instance with `createComponentInstance`, set the propsOptions to the instance when generating the instance.

```ts
export function createComponentInstance(
  vnode: VNode
): ComponentInternalInstance {
  const type = vnode.type as Component;

  const instance: ComponentInternalInstance = {
    // .
    // .
    // .
    propsOptions: type.props || {},
    props: {},
```

Let's think about how to form the `instance.props`.
At the time of component mounting, filter the props held by the vnode based on the propsOptions.
Convert the filtered object into a reactive object using the `reactive` function, and assign it to `instance.props`.

Implement a function called `initProps` in `componentProps.ts` that performs this series of steps.

```ts
export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const props: Data = {}
  setFullProps(instance, rawProps, props)
  instance.props = reactive(props)
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]
      if (options && options.hasOwnProperty(key)) {
        props[key] = value
      }
    }
  }
}
```

Actually execute `initProps` at the time of mounting, and pass props to the `setup` function as an argument.

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode));

    // init props
    const { props } = instance.vnode;
    initProps(instance, props);

    const component = initialVNode.type as Component;
    if (component.setup) {
      instance.render = component.setup(
        instance.props // Pass props to setup
      ) as InternalRenderFunction;
    }
    // .
    // .
    // .
```

```ts
export type ComponentOptions = {
  props?: Record<string, any>
  setup?: (props: Record<string, any>) => Function // Receive props
  render?: Function
}
```

At this point, props should be passed to the child component, so let's check it in the playground.

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props: { message: string }) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
  },
}

const app = createApp({
  setup() {
    const state = reactive({ message: 'hello' })

    return () =>
      h('div', { id: 'my-app' }, [
        h(MyComponent, { message: state.message }, []),
      ])
  },
})
```

However, this is not enough, as the rendering is not updated when props are changed.

```ts
const MyComponent = {
  props: { message: { type: String } },

  setup(props: { message: string }) {
    return () => h('div', { id: 'my-app' }, [`message: ${props.message}`])
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
        h(MyComponent, { message: state.message }, []),
        h('button', { onClick: changeMessage }, ['change message']),
      ])
  },
})
```

To make this component work, we need to implement `updateProps` in `componentProps.ts` and execute it when the component updates.

`~/packages/runtime-core/componentProps.ts`

```ts
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const { props } = instance
  Object.assign(props, rawProps)
}
```

`~/packages/runtime-core/renderer.ts`

```ts
const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement
  ) => {
    const componentUpdateFn = () => {
      const { render } = instance;
      if (!instance.isMounted) {
        const subTree = (instance.subTree = normalizeVNode(render()));
        patch(null, subTree, container);
        initialVNode.el = subTree.el;
        instance.isMounted = true;
      } else {
        let { next, vnode } = instance;

        if (next) {
          next.el = vnode.el;
          next.component = instance;
          instance.vnode = next;
          instance.next = null;
          updateProps(instance, next.props); // here
```

If the screen is updated, it's OK.
Now, you can pass data to the component using props! Great job!

![props](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/props.png)

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/050_component_system2)

As a side note, although it's not necessary, let's implement the ability to receive props in kebab-case, just like in the original Vue.
At this point, create a directory called `~/packages/shared` and create a file called `general.ts` in it.
This is the place to define general functions, not only for `runtime-core` and `runtime-dom`.
Following the original Vue, let's implement `hasOwn` and `camelize`.

`~/packages/shared/general.ts`

```ts
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol,
): key is keyof typeof val => hasOwnProperty.call(val, key)

const camelizeRE = /-(\w)/g
export const camelize = (str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
}
```

Let's use `camelize` in `componentProps.ts`.

```ts
export function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const { props } = instance
  // -------------------------------------------------------------- here
  Object.entries(rawProps ?? {}).forEach(([key, value]) => {
    props[camelize(key)] = value
  })
}

function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
) {
  const options = instance.propsOptions

  if (rawProps) {
    for (let key in rawProps) {
      const value = rawProps[key]
      // -------------------------------------------------------------- here
      // kebab -> camel
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        props[camelKey] = value
      }
    }
  }
}
```

Now you should be able to handle kebab-case as well. Let's check it in the playground.

```ts
const MyComponent = {
  props: { someMessage: { type: String } },

  setup(props: { someMessage: string }) {
    return () => h('div', {}, [`someMessage: ${props.someMessage}`])
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
        h(MyComponent, { 'some-message': state.message }, []),
        h('button', { onClick: changeMessage }, ['change message']),
      ])
  },
})
```

## Emits

Continuing from props, let's implement emits.
The implementation of emits is relatively simple, so it will be finished quickly.

In terms of the developer interface, emits will be received from the second argument of the setup function.

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

Similar to props, let's create a file called `~/packages/runtime-core/componentEmits.ts` and implement it there.

`~/packages/runtime-core/componentEmits.ts`

```ts
export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) {
  const props = instance.vnode.props || {}
  let args = rawArgs

  let handler =
    props[toHandlerKey(event)] || props[toHandlerKey(camelize(event))]

  if (handler) handler(...args)
}
```

`~/packages/shared/general.ts`

```ts
export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)

export const toHandlerKey = (str: string) => (str ? `on${capitalize(str)}` : ``)
```

`~/packages/runtime-core/component.ts`

```ts
export interface ComponentInternalInstance {
  // .
  // .
  // .
  emit: (event: string, ...args: any[]) => void
}

export function createComponentInstance(
  vnode: VNode,
): ComponentInternalInstance {
  const type = vnode.type as Component

  const instance: ComponentInternalInstance = {
    // .
    // .
    // .
    emit: null!, // to be set immediately
  }

  instance.emit = emit.bind(null, instance)
  return instance
}
```

You can pass this to the setup function.

`~/packages/runtime-core/componentOptions.ts`

```ts
export type ComponentOptions = {
  props?: Record<string, any>
  setup?: (
    props: Record<string, any>,
    ctx: { emit: (event: string, ...args: any[]) => void },
  ) => Function // To receive ctx.emit
  render?: Function
}
```

```ts
const mountComponent = (initialVNode: VNode, container: RendererElement) => {
    const instance: ComponentInternalInstance = (initialVNode.component =
      createComponentInstance(initialVNode));

    const { props } = instance.vnode;
    initProps(instance, props);

    const component = initialVNode.type as Component;
    if (component.setup) {
      // Pass emit
      instance.render = component.setup(instance.props, {
        emit: instance.emit,
      }) as InternalRenderFunction;
    }
```

Let's test the functionality with an example of the developer interface we assumed earlier!  
If it works properly, you can now communicate between components using props/emit!

Source code up to this point:  
[chibivue (GitHub)](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/10_minimum_example/050_component_system3)
