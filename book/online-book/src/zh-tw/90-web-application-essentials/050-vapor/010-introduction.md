# Vapor 模式

## 什麼是 Vapor 模式？

Vapor 模式是 Vue.js 的一種新的編譯策略，通過直接進行 DOM 操作而不使用虛擬 DOM 來提高性能。

在傳統的 Vue.js 中，當組件的狀態發生變化時，會重新生成虛擬 DOM，進行差異檢測（diffing），然後更新實際的 DOM。在 Vapor 模式中，消除了虛擬 DOM 的開銷，當響應式值發生變化時，只直接執行必要的 DOM 操作。

## 詳細資源

關於 Vapor 模式的詳細解釋，請參閱以下倉庫：

**[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)**

該倉庫提供了 Vue.js Vapor 模式內部實現的深入解釋。

## chibivue 中的 Vapor 實現

chibivue 在 `runtime-vapor` 套件中提供了最小的 Vapor 實現。
讓我們看一個簡單的實現來理解基本概念。

### 基本思想

Vapor 模式的核心包括兩點：

1. **將模板直接轉換為 DOM**：生成實際的 DOM 元素而不是虛擬 DOM 節點
2. **將響應式值的變化直接反映到 DOM**：無需差異檢測，只更新變化的部分

### template 函數

首先，讓我們看看從 HTML 字符串創建 DOM 元素的 `template` 函數：

```ts
export type VaporNode = Element & { __is_vapor: true };

export const template = (tmp: string): VaporNode => {
  const container = document.createElement("div");
  container.innerHTML = tmp;
  const el = container.firstElementChild as VaporNode;
  el.__is_vapor = true;
  return el;
};
```

這個函數接收一個 HTML 字符串並返回一個實際的 DOM 元素。它直接操作 DOM，而不經過虛擬 DOM。

### setText 函數

`setText` 函數用於更新文本內容：

```ts
export const setText = (
  target: Element,
  format: string,
  ...values: any[]
): void => {
  const fmt = (): string => {
    let text = format;
    for (let i = 0; i < values.length; i++) {
      text = text.replace("{}", values[i]);
    }
    return text;
  };

  if (!target) return;

  if (!values.length) {
    target.textContent = fmt();
    return;
  }

  if (!format && values.length) {
    target.textContent = values.join("");
    return;
  }

  target.textContent = fmt();
};
```

當響應式值發生變化時，會調用這個函數，直接更新 DOM 的文本內容。

### on 函數

`on` 函數用於註冊事件監聽器：

```ts
export const on = (
  element: Element,
  event: string,
  callback: () => void
): void => {
  element.addEventListener(event, callback);
};
```

### Vapor 組件

Vapor 模式中的組件與普通的 Vue 組件形式不同：

```ts
export type VaporComponent = (self: VaporComponentInternalInstance) => VaporNode;

export interface VaporComponentInternalInstance {
  __is_vapor: true;
  uid: number;
  type: VaporComponent;
  parent: ComponentInternalInstance | VaporComponentInternalInstance | null;
  appContext: AppContext;
  provides: Data;
  isMounted: boolean;
  // 生命週期鉤子
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  // ...
}
```

Vapor 組件是一個接收實例並返回 VaporNode（實際的 DOM 元素）的函數。

### 編譯結果對比

傳統的基於虛擬 DOM 的編譯結果：

```ts
// 輸入: <div>{{ count }}</div>
// 虛擬 DOM 輸出
function render(_ctx) {
  return h("div", null, _ctx.count);
}
```

Vapor 模式的編譯結果：

```ts
// 輸入: <div>{{ count }}</div>
// Vapor 輸出
const t0 = template("<div></div>");

function render(_ctx) {
  const el = t0();
  effect(() => {
    setText(el, _ctx.count);
  });
  return el;
}
```

在 Vapor 模式中：
- 模板被預先生成為 DOM 元素（使用 `template` 函數）
- 響應式值的更新在 `effect` 內直接操作 DOM
- 沒有虛擬 DOM 生成和差異檢測的成本

## 總結

Vapor 模式是一種通過消除虛擬 DOM 開銷來提高性能的新方法。chibivue 的 `runtime-vapor` 套件提供了這個概念的最小實現。

有關更詳細的實現和 Vue.js 官方的 Vapor 模式，請參閱 [reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)。
