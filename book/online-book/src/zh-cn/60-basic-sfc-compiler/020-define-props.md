# 支持 defineProps

::: info 关于本章
本章介绍如何实现 `<script setup>` 中使用的 `defineProps` 宏。\
学习编译器宏的工作原理以及 props 声明的处理方式。
:::

## 什么是 defineProps？

`defineProps` 是一个编译器宏，用于在 `<script setup>` 内声明组件的 props。

```vue
<script setup>
// 运行时声明
const props = defineProps({
  title: String,
  count: {
    type: Number,
    default: 0
  }
})

console.log(props.title)
</script>
```

<KawaikoNote variant="question" title="什么是编译器宏？">

`defineProps` 不是普通函数。它是**编译器宏**。\
它在编译时会被特殊处理，在运行时会被擦除。\
这就是为什么不需要导入就可以使用！

</KawaikoNote>

## 实现概述

defineProps 的处理包含以下步骤：

1. **检测宏调用**：在 AST 中找到 `defineProps()` 调用
2. **提取参数**：获取 props 定义对象
3. **删除代码**：删除原始的 `defineProps()` 调用
4. **添加到选项**：作为 `props` 选项添加到输出
5. **注册绑定**：将 props 注册为 `PROPS` 类型

## processDefineProps 函数

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_PROPS = "defineProps"

let propsRuntimeDecl: Node | undefined
let propsIdentifier: string | undefined

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  // 保存参数（props 定义对象）
  propsRuntimeDecl = node.arguments[0]

  // 如果赋值给变量，保存标识符
  // const props = defineProps(...) 中的 "props" 部分
  if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST 遍历

遍历 `<script setup>` 的主体来检测 `defineProps`。

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  // 表达式语句（单独调用 defineProps()）
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr)) {
      // 删除宏调用
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  // 变量声明（const props = defineProps(...)）
  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        if (processDefineProps(init, declId)) {
          // 删除声明
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## 注册 Props 绑定

作为 props 声明的变量会被注册到绑定元数据中，以便从模板中引用。

```ts
// 7. analyze binding metadata
if (propsRuntimeDecl) {
  for (const key of getObjectExpressionKeys(propsRuntimeDecl as ObjectExpression)) {
    bindingMetadata[key] = BindingTypes.PROPS
  }
}
```

通过注册为 `BindingTypes.PROPS`，模板编译器可以正确处理对 props 的访问。

## 处理 Props 标识符

当赋值给变量如 `const props = defineProps(...)` 时，需要使该变量可访问。

```ts
// 9. finalize setup() argument signature
let args = `__props`
if (propsIdentifier) {
  // 添加 const props = __props;
  s.prependLeft(startOffset, `\nconst ${propsIdentifier} = __props;\n`)
}
```

## 添加到选项

最终，props 定义作为组件选项输出。

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  let declCode = scriptSetup.content
    .slice(propsRuntimeDecl.start!, propsRuntimeDecl.end!)
    .trim()
  runtimeOptions += `\n  props: ${declCode},`
}

s.prependLeft(
  startOffset,
  `\nexport default {\n${runtimeOptions}\nsetup(${args}) {\n`
)
```

## 转换结果示例

```vue
<!-- 输入 -->
<script setup>
const props = defineProps({
  title: String,
  count: Number
})
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

```ts
// 输出
export default {
  props: {
    title: String,
    count: Number
  },
  setup(__props) {
    const props = __props;

    return (_ctx) => {
      return h('h1', _ctx.title)
    }
  }
}
```

<KawaikoNote variant="funny" title="简单！">

`defineProps` 看起来复杂，但做的事情很简单：
1. 将参数移动到 `props` 选项
2. 删除 `defineProps()` 调用
3. 如果有变量，替换为对 `__props` 的引用

</KawaikoNote>

## 测试

```vue
<script setup>
import { computed } from 'chibivue'

const props = defineProps({
  firstName: String,
  lastName: String
})

const fullName = computed(() => `${props.firstName} ${props.lastName}`)
</script>

<template>
  <div>
    <p>First: {{ firstName }}</p>
    <p>Last: {{ lastName }}</p>
    <p>Full: {{ fullName }}</p>
  </div>
</template>
```

父组件：

```vue
<script setup>
import ChildComponent from './ChildComponent.vue'
</script>

<template>
  <ChildComponent firstName="John" lastName="Doe" />
</template>
```

<KawaikoNote variant="base" title="实现完成！">

defineProps 的实现完成了！\
现在你理解了编译器宏的基本机制。\
下一章我们将学习如何实现 `defineEmits` 宏。

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/020_define_props)

## 总结

- `defineProps` 是编译器宏，在编译时处理
- 遍历 AST 检测 `defineProps()` 调用
- 参数转换为 `props` 选项，调用本身被删除
- Props 注册为 `BindingTypes.PROPS` 以便模板访问

## 参考链接

- [Vue.js - defineProps](https://cn.vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 官方文档
