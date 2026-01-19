# Patch Flags

## 什麼是 Patch Flags？

Patch Flags 是編譯器生成的優化提示．透過為 VNode 添加標誌，執行時的差分檢測（diffing）演算法可以跳過不必要的檢查，從而提高效能．

<KawaikoNote variant="question" title="為什麼由編譯器來優化？">

撰寫模板的人類知道「這裡是動態的」「這裡是靜態的」，
但傳統的 Virtual DOM 並不知道這些．透過讓編譯器將這些資訊傳遞給執行時，
就可以省去不必要的比較！

</KawaikoNote>

### 優化的機制

在普通的 Virtual DOM 差分檢測中，需要比較所有的屬性和子元素．然而，編譯器在模板解析階段就知道「哪些部分是動態的」．透過將這些資訊作為 Patch Flags 嵌入到 VNode 中，執行時只需檢查可能發生變化的部分．

## PatchFlags 的定義

```ts
export const enum PatchFlags {
  /**
   * 具有動態 textContent 的元素
   */
  TEXT = 1,

  /**
   * 具有動態 class 繫結的元素
   */
  CLASS = 1 << 1,  // 2

  /**
   * 具有動態 style 的元素
   */
  STYLE = 1 << 2,  // 4

  /**
   * 具有 class/style 以外的動態 props 的元素
   */
  PROPS = 1 << 3,  // 8

  /**
   * 具有動態鍵的 props 的元素
   */
  FULL_PROPS = 1 << 4,  // 16

  /**
   * hydration 時需要處理 props
   */
  NEED_HYDRATION = 1 << 5,  // 32

  /**
   * 子元素順序不變的 Fragment
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
   * 具有動態插槽的元件
   */
  DYNAMIC_SLOTS = 1 << 10,  // 1024

  /**
   * 開發用：根部有註解的 Fragment
   */
  DEV_ROOT_FRAGMENT = 1 << 11,  // 2048

  // 特殊標誌（負整數）

  /**
   * 快取的靜態 VNode
   */
  CACHED = -1,

  /**
   * 退出優化模式的提示
   */
  BAIL = -2,
}
```

## 透過位元運算進行組合

Patch Flags 被設計為位元標誌，可以組合多個標誌．

```ts
// 組合標誌
const flag = PatchFlags.TEXT | PatchFlags.CLASS;  // 3 (0b11)

// 檢查標誌
if (flag & PatchFlags.TEXT) {
  // TEXT 標誌已設置
}

if (flag & PatchFlags.CLASS) {
  // CLASS 標誌已設置
}
```

<KawaikoNote variant="funny" title="位元運算的魔法">

`1 << 1` 是 `2`，`1 << 2` 是 `4`...只需移動位元就能建立獨立的標誌．
用 `|`（OR）組合，用 `&`（AND）檢查．簡單但超高效！

</KawaikoNote>

## 從模板生成的範例

### 動態文字

```vue
<template>
  <p>{{ message }}</p>
</template>
```

生成的程式碼：
```js
// patchFlag = 1 (TEXT)
createVNode("p", null, toDisplayString(message), 1 /* TEXT */)
```

### 動態類別

```vue
<template>
  <div :class="dynamicClass">Content</div>
</template>
```

生成的程式碼：
```js
// patchFlag = 2 (CLASS)
createVNode("div", { class: dynamicClass }, "Content", 2 /* CLASS */)
```

### 多個動態屬性

```vue
<template>
  <div :class="cls" :style="styles">{{ text }}</div>
</template>
```

生成的程式碼：
```js
// patchFlag = 7 (TEXT | CLASS | STYLE)
createVNode("div",
  { class: cls, style: styles },
  toDisplayString(text),
  7 /* TEXT, CLASS, STYLE */
)
```

### 動態 props

```vue
<template>
  <input :value="inputValue" :disabled="isDisabled">
</template>
```

生成的程式碼：
```js
// patchFlag = 8 (PROPS)
// dynamicProps 明確指定可能變化的 props
createVNode("input",
  { value: inputValue, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]
)
```

## 在執行時的應用

### patchElement 中的優化

```ts
function patchElement(n1: VNode, n2: VNode) {
  const el = n2.el = n1.el;
  const { patchFlag, dynamicProps } = n2;

  if (patchFlag > 0) {
    // 優化路徑：根據標誌只更新必要的部分

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
      // 只更新文字內容
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children as string);
      }
    }
  } else if (patchFlag === PatchFlags.FULL_PROPS) {
    // 檢查所有 props
    patchProps(el, n1.props, n2.props);
  } else {
    // 無標誌：完整 diff
    patchProps(el, n1.props, n2.props);
    patchChildren(n1, n2, el);
  }
}
```

### Fragment 的優化

```ts
function patchFragment(n1: VNode, n2: VNode) {
  const { patchFlag } = n2;

  if (patchFlag & PatchFlags.STABLE_FRAGMENT) {
    // 子元素順序不變：簡單更新
    patchBlockChildren(n1.children, n2.children);
  } else if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
    // keyed 子元素：基於 key 的 diff
    patchKeyedChildren(n1.children, n2.children);
  } else {
    // unkeyed：完整 diff
    patchUnkeyedChildren(n1.children, n2.children);
  }
}
```

## 特殊標誌

### CACHED (-1)

表示靜態 VNode 已被快取．

```js
const _hoisted_1 = createVNode("div", null, "Static", -1 /* CACHED */);
```

快取的 VNode 可以跳過差分檢測．

### BAIL (-2)

退出優化模式的提示．當使用者使用手寫的 render 函式等編譯器優化無法應用的情況下使用．

## dynamicProps

與 `patchFlag` 一起使用的 `dynamicProps` 陣列明確指定哪些 props 是動態的．

```ts
// 動態 props 是 value 和 disabled
createVNode("input",
  { type: "text", value: val, disabled: isDisabled },
  null,
  8 /* PROPS */,
  ["value", "disabled"]  // dynamicProps
)
```

這樣，由於 `type` 是靜態的，可以跳過比較，只檢查 `value` 和 `disabled`．

## 與 Block Tree 的協作

Patch Flags 與 Block Tree 優化協同工作．Block 擁有 `dynamicChildren` 陣列，只追蹤動態子節點．

```ts
const block = openBlock();
const vnode = createBlock("div", null, [
  createVNode("p", null, "static"),  // 不包含在 dynamicChildren 中
  createVNode("p", null, toDisplayString(msg), 1 /* TEXT */)  // 包含
]);
// block.dynamicChildren = [只有動態的 p]
```

更新 Block 時只需遍歷 `dynamicChildren`，因此可以跳過靜態子節點的比較．

## 優化的效果

### 優化前（無標誌）
```
比較所有 props: O(n)
比較所有子元素: O(m)
總計: O(n + m)
```

### 優化後（有標誌）
```
只比較動態 props: O(k) 其中 k << n
只比較動態子元素: O(l) 其中 l << m
總計: O(k + l)
```

當模板的大部分是靜態的時候，這種優化會產生顯著的效果．

## 總結

Patch Flags 的實作由以下要素組成：

1. **位元標誌**：高效地表示多個動態元素
2. **編譯器整合**：在模板解析時自動生成
3. **執行時優化**：根據標誌跳過不必要的比較
4. **dynamicProps**：明確追蹤動態 props
5. **Block Tree 協作**：只高效更新動態子節點

Patch Flags 是大幅提升 Vue 3 Virtual DOM 效能的重要優化技術．透過編譯器和執行時的協作，最大限度地發揮了基於模板的框架的優勢．

<KawaikoNote variant="surprise" title="Patch Flags 完成！">

這項技術源於「既然能解析模板，那也能提供優化提示」的想法．
請親身體驗 JSX 所沒有的模板編譯器的優勢！

</KawaikoNote>

到此為止的原始碼：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/050_patch_flags)
