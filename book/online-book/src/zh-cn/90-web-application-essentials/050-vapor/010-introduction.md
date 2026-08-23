# Vapor 模式

## 什么是 Vapor 模式？

Vapor 模式是 Vue.js 的一种新的编译策略，通过直接进行 DOM 操作而不使用虚拟 DOM 来提高性能。

在传统的 Vue.js 中，当组件的状态发生变化时，会重新生成虚拟 DOM，进行差异检测（diffing），然后更新实际的 DOM。在 Vapor 模式中，消除了虚拟 DOM 的开销，当响应式值发生变化时，只直接执行必要的 DOM 操作。

## 详细资源

关于 Vapor 模式的详细解释，请参阅以下仓库：

**[reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)**

该仓库提供了 Vue.js Vapor 模式内部实现的深入解释。

## chibivue 中的 Vapor 实现

chibivue 在 `runtime-vapor` 包中提供了最小的 Vapor 实现。
让我们看一个简单的实现来理解基本概念。

### 基本思想

Vapor 模式的核心包括两点：

1. **将模板直接转换为 DOM**：生成实际的 DOM 元素而不是虚拟 DOM 节点
2. **将响应式值的变化直接反映到 DOM**：无需差异检测，只更新变化的部分

### template 函数

首先，让我们看看从 HTML 字符串创建 DOM 元素的 `template` 函数：

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

这个函数接收一个 HTML 字符串并返回一个实际的 DOM 元素。它直接操作 DOM，而不经过虚拟 DOM。

### setText 函数

`setText` 函数用于更新文本内容：

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

当响应式值发生变化时，会调用这个函数，直接更新 DOM 的文本内容。

### on 函数

`on` 函数用于注册事件监听器：

```ts
export const on = (
  element: Element,
  event: string,
  callback: () => void
): void => {
  element.addEventListener(event, callback);
};
```

### Vapor 组件

Vapor 模式中的组件与普通的 Vue 组件形式不同：

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
  // 生命周期钩子
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook;
  [LifecycleHooks.MOUNTED]: LifecycleHook;
  // ...
}
```

Vapor 组件是一个接收实例并返回 VaporNode（实际的 DOM 元素）的函数。

### 编译结果对比

传统的基于虚拟 DOM 的编译结果：

```ts
// 输入: <div>{{ count }}</div>
// 虚拟 DOM 输出
function render(_ctx) {
  return h("div", null, _ctx.count);
}
```

Vapor 模式的编译结果：

```ts
// 输入: <div>{{ count }}</div>
// Vapor 输出
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
- 模板被预先生成为 DOM 元素（使用 `template` 函数）
- 响应式值的更新在 `effect` 内直接操作 DOM
- 没有虚拟 DOM 生成和差异检测的成本

## 总结

Vapor 模式是一种通过消除虚拟 DOM 开销来提高性能的新方法。chibivue 的 `runtime-vapor` 包提供了这个概念的最小实现。

有关更详细的实现和 Vue.js 官方的 Vapor 模式，请参阅 [reading-vuejs-core-vapor](https://github.com/ubugeeei/reading-vuejs-core-vapor)。
