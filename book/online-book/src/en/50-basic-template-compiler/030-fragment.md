# Implementing Fragment

## Issues with the current implementation

Let's try running the following code in a playground:

```ts
import { createApp, defineComponent } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

You may encounter an error like this:

![fragment_error.png](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/book/images/fragment_error.png)

Looking at the error message, it seems to be related to the Function constructor.

In other words, the code generation seems to be successful up to a certain point, so let's see what code is actually generated.

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode } = ChibiVue

    return _createVNode("header", null, "header")"\n  "_createVNode("main", null, "main")"\n  "_createVNode("footer", null, "footer")
   }
}
```

The code after the `return` statement is incorrect. The current code generation implementation does not handle cases where the root is an array (i.e., not a single node).

We will fix this issue.

## What code should be generated?

Even though we are making modifications, what kind of code should be generated?

In conclusion, the code should look like this:

```ts
return function render(_ctx) {
  with (_ctx) {
    const { createVNode: _createVNode, Fragment: _Fragment } = ChibiVue

    return _createVNode(_Fragment, null, [
      [
        _createVNode('header', null, 'header'),
        '\n  ',
        _createVNode('main', null, 'main'),
        '\n  ',
        _createVNode('footer', null, 'footer'),
      ],
    ])
  }
}
```

This `Fragment` is a symbol defined in Vue.

In other words, Fragment is not represented as an AST like FragmentNode, but simply as a tag of ElementNode.

We will implement the processing for Fragment in the renderer, similar to Text.

## Implementation

The Fragment symbol will be implemented in runtime-core/vnode.ts.

Let's add it as a new type in VNodeTypes.

```ts
export type VNodeTypes = Component | typeof Text | typeof Fragment | string

export const Fragment = Symbol()
```

Implement the renderer.

Add a branch for fragment in the patch function.

```ts
if (type === Text) {
  processText(n1, n2, container, anchor)
} else if (shapeFlag & ShapeFlags.ELEMENT) {
  processElement(n1, n2, container, anchor, parentComponent)
} else if (type === Fragment) {
  // Here
  processFragment(n1, n2, container, anchor, parentComponent)
} else if (shapeFlag & ShapeFlags.COMPONENT) {
  processComponent(n1, n2, container, anchor, parentComponent)
} else {
  // do nothing
}
```

Note that inserting or removing elements should generally be implemented with anchor as a marker.

As the name suggests, an anchor indicates the start and end positions of a fragment.

The starting element is represented by the existing `el` property in VNode, but currently there is no property to represent the end. Let's add it.

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  // .
  anchor: HostNode | null // fragment anchor // Added
  // .
  // .
}
```

Set the anchor during mount.

Pass the fragment's end as the anchor in mount/patch.

```ts
const processFragment = (
  n1: VNode | null,
  n2: VNode,
  container: RendererElement,
  anchor: RendererNode | null,
  parentComponent: ComponentInternalInstance | null,
) => {
  const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
  const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

  if (n1 == null) {
    hostInsert(fragmentStartAnchor, container, anchor)
    hostInsert(fragmentEndAnchor, container, anchor)
    mountChildren(
      n2.children as VNode[],
      container,
      fragmentEndAnchor,
      parentComponent,
    )
  } else {
    patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
  }
}
```

Be careful when the elements of the fragment change during updates.

```ts
const move = (
  vnode: VNode,
  container: RendererElement,
  anchor: RendererElement | null,
) => {
  const { type, children, el, shapeFlag } = vnode

  // .

  if (type === Fragment) {
    hostInsert(el!, container, anchor)
    for (let i = 0; i < (children as VNode[]).length; i++) {
      move((children as VNode[])[i], container, anchor)
    }
    hostInsert(vnode.anchor!, container, anchor) // Insert the anchor
    return
  }
  // .
  // .
  // .
}
```

During unmount, also rely on the anchor to remove elements.

```ts
const remove = (vnode: VNode) => {
  const { el, type, anchor } = vnode
  if (type === Fragment) {
    removeFragment(el!, anchor!)
  }

  // .
  // .
  // .
}

const removeFragment = (cur: RendererNode, end: RendererNode) => {
  let next
  while (cur !== end) {
    next = hostNextSibling(cur)! // ※ Add this to nodeOps!
    hostRemove(cur)
    cur = next
  }
  hostRemove(end)
}
```

## Testing

The code we wrote earlier should work correctly.

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

const App = defineComponent({
  template: `<header>header</header>
<main>main</main>
<footer>footer</footer>`,
})

const app = createApp(App)

app.mount('#app')
```

Currently, we cannot use directives like v-for, so we cannot write a description that uses a fragment in the template and changes the number of elements.

Let's simulate the behavior by writing the compiled code and see how it works.

```ts
import { Fragment, createApp, defineComponent, h, ref } from 'chibivue'

// const App = defineComponent({
//   template: `<header>header</header>
//   <main>main</main>
//   <footer>footer</footer>`,
// });

const App = defineComponent({
  setup() {
    const list = ref([0])
    const update = () => {
      list.value = [...list.value, list.value.length]
    }
    return () =>
      h(Fragment, {}, [
        h('button', { onClick: update }, 'update'),
        ...list.value.map(i => h('div', {}, i)),
      ])
  },
})

const app = createApp(App)

app.mount('#app')
```

It seems to be working correctly!

Source code up to this point: [GitHub](https://github.com/Ubugeeei/chibivue/tree/main/book/impls/50_basic_template_compiler/030_fragment)
