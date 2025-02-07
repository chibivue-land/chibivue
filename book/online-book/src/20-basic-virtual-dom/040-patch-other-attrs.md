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

innerHTML and textContent are a bit special compared to other Props.
This is because if an element with this Prop has child elements, they need to be unmounted.

TODO: Write
