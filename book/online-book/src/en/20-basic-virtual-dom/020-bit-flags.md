# Representation of VNode using bits

## Representing the types of VNodes using bits

There are various types of VNodes. For example, the ones currently implemented include:

- component node
- element node
- text node
- whether the child element is text or not
- whether the child element is an array or not

And in the future, more types of VNodes will be implemented. For example, slot, keep-alive, suspense, teleport, etc.

Currently, branching is done using conditions such as `type === Text`, `typeof type === "string"`, `typeof type === "object"`, etc.

Checking these conditions one by one is inefficient, so let's try representing them using bits, following the implementation of the original. In Vue, these bits are called "ShapeFlags". As the name suggests, they represent the shape of the VNode. (Strictly speaking, in Vue, ShapeFlags and symbols such as Text and Fragment are used to determine the type of VNode.)
https://github.com/vuejs/core/blob/main/packages/shared/src/shapeFlags.ts

Bit flags refer to treating each bit of a number as a specific flag.

Let's consider the following VNode as an example:

```ts
const vnode = {
  type: 'div',
  children: [
    { type: 'p', children: ['hello'] },
    { type: 'p', children: ['hello'] },
  ],
}
```

First, the initial value of the flag is 0. (For simplicity, this explanation is given using 8 bits.)

```ts
let shape = 0b0000_0000
```

Now, this VNode is an element and has an array of children, so the ELEMENT flag and the ARRAY_CHILDREN flag are set.

```ts
shape = shape | ShapeFlags.ELEMENT | ELEMENT.ARRAY_CHILDREN // 0x00010001
```

With this, we can represent the information that this VNode is an element and has an array of children using just one number called "shape". We can efficiently manage the types of VNodes by using this in branching in the renderer or other parts of the code.

```ts
if (vnode.shape & ShapeFlags.ELEMENT) {
  // Processing when vnode is an element
}
```

Since we are not implementing all ShapeFlags this time, please try implementing the following as an exercise:

```ts
export const enum ShapeFlags {
  ELEMENT = 1,
  COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
}
```

Here's what you need to do:

- Define the flags in shared/shapeFlags.ts
- Define the shape in runtime-core/vnode.ts
  ```ts
  export interface VNode<HostNode = any> {
    shapeFlag: number
  }
  ```
  Add this and calculate the flag in functions like createVNode.
- Implement branching logic based on the shape in the renderer.

That's it for the explanation of this chapter. Let's start implementing it!
