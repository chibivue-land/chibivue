# 支持 defineEmits

::: info 关于本章
本章介绍如何实现 `<script setup>` 中使用的 `defineEmits` 宏。\
学习子组件向父组件发送事件的机制。
:::

## 什么是 defineEmits？

`defineEmits` 是一个编译器宏，用于在 `<script setup>` 内声明组件发出的事件。

```vue
<script setup>
const emit = defineEmits(['change', 'update'])

function handleClick() {
  emit('change', 'new value')
}
</script>
```

<KawaikoNote variant="question" title="与 defineProps 有什么区别？">

`defineProps` 处理从父到子的数据流（Props Down），\
`defineEmits` 处理从子到父的事件流（Events Up）。\
它们是 Vue 双向数据流的两个轮子！

</KawaikoNote>

## 实现概述

defineEmits 的处理与 defineProps 非常相似：

1. **检测宏调用**：在 AST 中找到 `defineEmits()` 调用
2. **提取参数**：获取事件定义数组或对象
3. **删除代码**：删除原始的 `defineEmits()` 调用
4. **添加到选项**：作为 `emits` 选项添加到输出
5. **提供 emit 函数**：从 setup 的上下文中获取 `emit`

## processDefineEmits 函数

```ts
// packages/compiler-sfc/src/compileScript.ts

const DEFINE_EMITS = "defineEmits"

let emitsRuntimeDecl: Node | undefined
let emitIdentifier: string | undefined

function processDefineEmits(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_EMITS)) {
    return false
  }

  // 保存事件定义
  emitsRuntimeDecl = node.arguments[0]

  // 如果赋值给变量，保存标识符
  // const emit = defineEmits(...) 中的 "emit" 部分
  if (declId) {
    emitIdentifier =
      declId.type === "Identifier"
        ? declId.name
        : scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## AST 遍历

与 defineProps 类似，遍历 `<script setup>` 的主体来检测 `defineEmits`。

```ts
// 2.2 process <script setup> body
for (const node of scriptSetupAst.body) {
  if (node.type === "ExpressionStatement") {
    const expr = node.expression
    if (processDefineProps(expr) || processDefineEmits(expr)) {
      s.remove(node.start! + startOffset, node.end! + startOffset)
    }
  }

  if (node.type === "VariableDeclaration" && !node.declare) {
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      const init = decl.init
      if (init) {
        const declId = decl.id.type === "VoidPattern" ? undefined : decl.id
        const isDefineProps = processDefineProps(init, declId)
        const isDefineEmits = processDefineEmits(init, declId)
        if (isDefineProps || isDefineEmits) {
          s.remove(node.start! + startOffset, node.end! + startOffset)
        }
      }
    }
  }
}
```

## 设置 emit 函数

从 `defineEmits` 获取的 emit 函数从 setup 函数的第二个参数（SetupContext）中获取。

```ts
// 9. finalize setup() argument signature
let args = `__props`

const destructureElements: string[] = []
if (emitIdentifier) {
  destructureElements.push(
    emitIdentifier === `emit` ? `emit` : `emit: ${emitIdentifier}`
  )
}

if (destructureElements.length) {
  args += `, { ${destructureElements.join(", ")} }`
}
```

这会生成如下代码：

```ts
// 对于 const emit = defineEmits(['change'])
setup(__props, { emit }) {
  // ...
}

// 对于 const emitFn = defineEmits(['change'])
setup(__props, { emit: emitFn }) {
  // ...
}
```

## 添加到选项

```ts
// 11. finalize default export
let runtimeOptions = ``
if (propsRuntimeDecl) {
  runtimeOptions += `\n  props: ${...},`
}
if (emitsRuntimeDecl) {
  runtimeOptions += `\n  emits: ${scriptSetup.content
    .slice(emitsRuntimeDecl.start!, emitsRuntimeDecl.end!)
    .trim()},`
}
```

## 转换结果示例

```vue
<!-- 输入 -->
<script setup>
const emit = defineEmits(['update', 'delete'])

function handleUpdate(value) {
  emit('update', value)
}
</script>

<template>
  <button @click="handleUpdate('new')">Update</button>
</template>
```

```ts
// 输出
export default {
  emits: ['update', 'delete'],
  setup(__props, { emit }) {
    function handleUpdate(value) {
      emit('update', value)
    }

    return (_ctx) => {
      return h('button', { onClick: _ctx.handleUpdate.bind(_ctx, 'new') }, 'Update')
    }
  }
}
```

<KawaikoNote variant="funny" title="与 defineProps 对称！">

`defineEmits` 的实现与 `defineProps` 几乎相同：
1. 检测宏调用
2. 将参数移动到 `emits` 选项
3. 如果有变量，转换为从 SetupContext 获取

容易记住！

</KawaikoNote>

## 测试

子组件：

```vue
<script setup>
const props = defineProps({
  modelValue: String
})

const emit = defineEmits(['update:modelValue'])

function updateValue(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<template>
  <input :value="modelValue" @input="updateValue" />
</template>
```

父组件：

```vue
<script setup>
import { ref } from 'chibivue'
import CustomInput from './CustomInput.vue'

const text = ref('')
</script>

<template>
  <CustomInput v-model="text" />
  <p>输入值: {{ text }}</p>
</template>
```

<KawaikoNote variant="base" title="实现完成！">

defineEmits 的实现完成了！\
现在可以使用 props 和 emits 两个编译器宏了。\
下一章我们将学习如何实现 scoped CSS。

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/030_define_emits)

## 总结

- `defineEmits` 是声明子到父事件发送的宏
- 处理模式与 `defineProps` 非常相似
- emit 函数从 SetupContext 解构获取
- 作为 `emits` 选项添加到组件

## 参考链接

- [Vue.js - defineEmits](https://cn.vuejs.org/api/sfc-script-setup.html#defineprops-defineemits) - Vue 官方文档
