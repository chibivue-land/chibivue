# Patch Flags

## 什么是 Patch Flags？

Patch Flags 是编译器生成的优化提示．通过为 VNode 添加标志，运行时的差分检测（diffing）算法可以跳过不必要的检查，从而提高性能．

<KawaikoNote variant="question" title="为什么由编译器来优化？">

编写模板的人类知道「这里是动态的」「这里是静态的」，
但传统的 Virtual DOM 并不知道这些．通过让编译器将这些信息传递给运行时，
就可以省去不必要的比较！

</KawaikoNote>

### 优化的机制

在普通的 Virtual DOM 差分检测中，需要比较所有的属性和子元素．然而，编译器在模板解析阶段就知道「哪些部分是动态的」．通过将这些信息作为 Patch Flags 嵌入到 VNode 中，运行时只需检查可能发生变化的部分．

## PatchFlags 的定义

```ts
export const enum PatchFlags {
  /**
   * 具有动态 textContent 的元素
   */
  TEXT = 1,

  /**
   * 具有动态 class 绑定的元素
   */
  CLASS = 1 << 1,  // 2

  /**
   * 具有动态 style 的元素
   */
  STYLE = 1 << 2,  // 4

  /**
   * 具有 class/style 以外的动态 props 的元素
   */
  PROPS = 1 << 3,  // 8

  /**
   * 具有动态键的 props 的元素
   */
  FULL_PROPS = 1 << 4,  // 16

  /**
   * hydration 时需要处理 props
   */
  NEED_HYDRATION = 1 << 5,  // 32

  /**
   * 子元素顺序不变的 Fragment
   */
  STABLE_FRAGMENT = 1 << 6,  // 64

  /**
   * 具有 keyed 子元素的 Fragment
   */
  KEYED_FRAGMENT = 1 << 7,  // 128

  /**
   * 具有非 keyed 子元素的 Fragment
   */
  UNKEYED_FRAGMENT = 1 << 8,  // 256

  /**
   * 需要 props 以外的 patch（ref、指令等）
   */
  NEED_PATCH = 1 << 9,  // 512

  /**
   * 具有动态插槽的组件
   */
  DYNAMIC_SLOTS = 1 << 10,  // 1024

  /**
   * 开发用：根部有注释的 Fragment
   */
  DEV_ROOT_FRAGMENT = 1 << 11,  // 2048

  // 特殊标志（负整数）

  /**
   * 缓存的静态 VNode
   */
  CACHED = -1,

  /**
   * 退出优化模式的提示
   */
  BAIL = -2,
}
```

## 通过位运算进行组合

Patch Flags 被设计为位标志，可以组合多个标志．

```ts
// 组合标志
const flag = PatchFlags.TEXT | PatchFlags.CLASS;  // 3 (0b11)

// 检查标志
if (flag & PatchFlags.TEXT) {
  // TEXT 标志已设置
}

if (flag & PatchFlags.CLASS) {
  // CLASS 标志已设置
}
```

<KawaikoNote variant="funny" title="位运算的魔法">

`1 << 1` 是 `2`，`1 << 2` 是 `4`...只需移动位就能创建独立的标志．
用 `|`（OR）组合，用 `&`（AND）检查．简单但超高效！

</KawaikoNote>

## 从模板生成的示例

### 动态文本

```vue
<template>
  <p>{{ message }}</p>
</template>
```

生成的代码：
```js
// patchFlag = 1 (TEXT)
createVNode("p", null, toDisplayString(message), 1 /* TEXT */)
```

### 动态类

```vue
<template>
  <div :class="dynamicClass">Content</div>
</template>
```

生成的代码：
```js
// patchFlag = 2 (CLASS)
createVNode("div", { class: dynamicClass }, "Content", 2 /* CLASS */)
```

### 多个动态属性

```vue
<template>
  <div :class="cls" :style="styles">{{ text }}</div>
</template>
```

生成的代码：
```js
// patchFlag = 7 (TEXT | CLASS | STYLE)
createVNode("div",
  { class: cls, style: styles },
  toDisplayString(text),
  7 /* TEXT, CLASS, STYLE */
)
```

### 动态 props

```vue
<template>
  <input :value="inputValue" :disabled="isDisabled">
</template>
```

生成的代码：
```js
// patchFlag = 8 (PROPS)
// dynamicProps 明确指定可能变化的 props
createVNode("input",
  { value: inputValue, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]
)
```

## 在运行时的应用

### patchElement 中的优化

```ts
function patchElement(n1: VNode, n2: VNode) {
  const el = n2.el = n1.el;
  const { patchFlag, dynamicProps } = n2;

  if (patchFlag > 0) {
    // 优化路径：根据标志只更新必要的部分

    if (patchFlag & PatchFlags.CLASS) {
      // 只更新 class
      if (n1.props?.class !== n2.props?.class) {
        hostSetClass(el, n2.props?.class);
      }
    }

    if (patchFlag & PatchFlags.STYLE) {
      // 只更新 style
      hostPatchStyle(el, n1.props?.style, n2.props?.style);
    }

    if (patchFlag & PatchFlags.PROPS) {
      // 只更新指定的 props
      for (const key of dynamicProps!) {
        const prev = n1.props?.[key];
        const next = n2.props?.[key];
        if (prev !== next) {
          hostPatchProp(el, key, prev, next);
        }
      }
    }

    if (patchFlag & PatchFlags.TEXT) {
      // 只更新文本内容
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children as string);
      }
    }
  } else if (patchFlag === PatchFlags.FULL_PROPS) {
    // 检查所有 props
    patchProps(el, n1.props, n2.props);
  } else {
    // 无标志：完整 diff
    patchProps(el, n1.props, n2.props);
    patchChildren(n1, n2, el);
  }
}
```

### Fragment 的优化

```ts
function patchFragment(n1: VNode, n2: VNode) {
  const { patchFlag } = n2;

  if (patchFlag & PatchFlags.STABLE_FRAGMENT) {
    // 子元素顺序不变：简单更新
    patchBlockChildren(n1.children, n2.children);
  } else if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
    // keyed 子元素：基于 key 的 diff
    patchKeyedChildren(n1.children, n2.children);
  } else {
    // unkeyed：完整 diff
    patchUnkeyedChildren(n1.children, n2.children);
  }
}
```

## 特殊标志

### CACHED (-1)

表示静态 VNode 已被缓存．

```js
const _hoisted_1 = createVNode("div", null, "Static", -1 /* CACHED */);
```

缓存的 VNode 可以跳过差分检测．

### BAIL (-2)

退出优化模式的提示．当用户使用手写的 render 函数等编译器优化无法应用的情况下使用．

## dynamicProps

与 `patchFlag` 一起使用的 `dynamicProps` 数组明确指定哪些 props 是动态的．

```ts
// 动态 props 是 value 和 disabled
createVNode("input",
  { type: "text", value: val, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]  // dynamicProps
)
```

这样，由于 `type` 是静态的，可以跳过比较，只检查 `value` 和 `disabled`．

## 与 Block Tree 的协作

Patch Flags 与 Block Tree 优化协同工作．Block 拥有 `dynamicChildren` 数组，只追踪动态子节点．

```ts
const block = openBlock();
const vnode = createBlock("div", null, [
  createVNode("p", null, "static"),  // 不包含在 dynamicChildren 中
  createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 包含
]);
// block.dynamicChildren = [只有动态的 p]
```

更新 Block 时只需遍历 `dynamicChildren`，因此可以跳过静态子节点的比较．

## 优化的效果

### 优化前（无标志）
```
比较所有 props: O(n)
比较所有子元素: O(m)
总计: O(n + m)
```

### 优化后（有标志）
```
只比较动态 props: O(k) 其中 k << n
只比较动态子元素: O(l) 其中 l << m
总计: O(k + l)
```

当模板的大部分是静态的时候，这种优化会产生显著的效果．

## 总结

Patch Flags 的实现由以下要素组成：

1. **位标志**：高效地表示多个动态元素
2. **编译器集成**：在模板解析时自动生成
3. **运行时优化**：根据标志跳过不必要的比较
4. **dynamicProps**：明确追踪动态 props
5. **Block Tree 协作**：只高效更新动态子节点

Patch Flags 是大幅提升 Vue 3 Virtual DOM 性能的重要优化技术．通过编译器和运行时的协作，最大限度地发挥了基于模板的框架的优势．

<KawaikoNote variant="surprise" title="Patch Flags 完成！">

这项技术源于「既然能解析模板，那也能提供优化提示」的想法．
请亲身体验 JSX 所没有的模板编译器的优势！

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/050_patch_flags)
