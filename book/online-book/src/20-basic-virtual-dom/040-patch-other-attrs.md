# Patch for Props that cannot be handled

In this chapter, let's implement a patch for Props that cannot be handled at the moment.
Below are some examples of Props that need to be handled, but try to implement them by referring to the original implementation while filling in the missing parts on your own!
By doing so, it should become more practical!

There is nothing particularly new. It should be possible to implement it sufficiently based on what we have done so far.

What I want to focus on is the implementation of runtime-dom/modules.

## Comparison between old and new

Currently, updates can only be made based on the props of n2.
Let's update based on n1 and n2.

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

Props that exist in n1 but not in n2 should be removed.
Also, if the values are the same even if they exist in both, there is no need to patch, so skip it.

## class / style (Note)

There are multiple ways to bind class and style.

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

To achieve these, the concept of `transform` explained in the Basic Template Compiler section is required.
It can be implemented anywhere as long as it does not deviate from the design of the original Vue, but we will skip it here because we want to follow the design of the original Vue in this book.

## innerHTML / textContent

innerHTML and textContent are a bit special compared to other Props.\
This is because if an element with this Prop has child elements, they need to be unmounted.

For example, consider the following case:

```ts
h('div', { innerHTML: '<p>hello</p>' }, [
  h(SomeComponent, {}, [])
])
```

In this case, the content of the div element will be overwritten by `innerHTML` to `<p>hello</p>`.\
However, `SomeComponent` passed as children already exists in the virtual DOM, and if it is not properly unmounted, the following problems will occur:

- Event listeners will not be removed
- Component lifecycle hooks (such as onUnmounted) will not be called
- It can cause memory leaks

Therefore, when setting innerHTML or textContent, existing child elements need to be unmounted.

### Implementation

First, extend the type definition of `patchProp` to accept `prevChildren` and `unmountChildren`.

`~/packages/runtime-core/renderer.ts`

```ts
export interface RendererOptions<HostNode = RendererNode, HostElement = RendererElement> {
  patchProp(
    el: HostElement,
    key: string,
    prevValue: any,
    nextValue: any,
    prevChildren?: VNode<HostNode>[], // Added
    unmountChildren?: (children: VNode<HostNode>[]) => void, // Added
  ): void;
  // ...
}
```

Next, implement the handling of innerHTML/textContent in the `patchDOMProp` function.

`~/packages/runtime-dom/modules/props.ts`

```ts
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  prevChildren: any,
  unmountChildren: any,
) {
  if (key === 'innerHTML' || key === 'textContent') {
    // Unmount existing child elements if any
    if (prevChildren) {
      unmountChildren(prevChildren)
    }
    el[key] = value == null ? '' : value
    return
  }

  // ... (handling of other props)
}
```

Then, pass `prevChildren` and `unmountChildren` when calling `patchDOMProp` from `patchProp`.

`~/packages/runtime-dom/patchProp.ts`

```ts
export const patchProp: DOMRendererOptions['patchProp'] = (
  el,
  key,
  prevValue,
  nextValue,
  prevChildren,
  unmountChildren,
) => {
  if (key === 'style') {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    patchDOMProp(el, key, nextValue, prevChildren, unmountChildren) // Pass prevChildren, unmountChildren
  } else {
    patchAttr(el, key, nextValue)
  }
}
```

Finally, pass the appropriate arguments when calling `hostPatchProp` in renderer.ts.

`~/packages/runtime-core/renderer.ts` `mountElement` and `patchElement`

```ts
const mountElement = (vnode: VNode, container: RendererElement, anchor: RendererElement | null) => {
  let el: RendererElement
  const { type, props } = vnode
  el = vnode.el = hostCreateElement(type as string)

  mountChildren(vnode.children as VNode[], el, anchor)

  if (props) {
    for (const key in props) {
      hostPatchProp(
        el,
        key,
        null,
        props[key],
        vnode.children as VNode[], // Added
        unmountChildren, // Added
      )
    }
  }

  hostInsert(el, container)
}
```

Now, when innerHTML or textContent is used, existing child elements will be properly unmounted.

Source code up to this point:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/20_basic_virtual_dom/060_other_props)
