# 支持 Props 解构

::: info 关于本章
本章介绍如何实现 Vue 3.5 的响应式 Props 解构功能．\
学习如何在解构 props 的同时保持响应性．
:::

## 什么是响应式 Props 解构？

从 Vue 3.5 开始，你可以在 `<script setup>` 中解构 `defineProps` 的返回值．

```vue
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

这个功能使访问 props 更加简单．

<KawaikoNote variant="question" title="为什么需要特殊处理？">

在普通的 JavaScript 中，解构对象会复制值，并断开与原始对象的连接．\
但是 Vue 的 props 需要保持响应性．\
编译器将解构访问转换为 `__props.xxx` 访问来保持响应性！

</KawaikoNote>

## 工作原理

Props 解构通过以下步骤实现：

1. **模式检测**：检测 `const { ... } = defineProps(...)`
2. **绑定注册**：将每个解构的属性注册为 `PROPS`
3. **默认值处理**：将默认值转换为 `withDefaults` 等效处理
4. **代码转换**：将 props 访问转换为 `__props.xxx`

### 转换示例

```vue
<!-- 输入 -->
<script setup>
const { count, message = 'hello' } = defineProps({
  count: Number,
  message: String
})

console.log(count, message)
</script>
```

```ts
// 输出
export default {
  props: {
    count: Number,
    message: { type: String, default: 'hello' }
  },
  setup(__props) {
    console.log(__props.count, __props.message)

    return (_ctx) => {
      // ...
    }
  }
}
```

## 检测解构模式

检测 `defineProps` 的返回值是否被赋值给 `ObjectPattern`（解构模式）．

```ts
// packages/compiler-sfc/src/compileScript.ts

interface PropsDestructureBindings {
  [key: string]: {
    local: string      // 本地变量名
    default?: string   // 默认值
  }
}

let propsDestructuredBindings: PropsDestructureBindings = Object.create(null)

function processDefineProps(node: Node, declId?: LVal): boolean {
  if (!isCallOf(node, DEFINE_PROPS)) {
    return false
  }

  propsRuntimeDecl = node.arguments[0]

  // 处理解构模式
  if (declId && declId.type === "ObjectPattern") {
    processPropsDestructure(declId)
  } else if (declId) {
    propsIdentifier = scriptSetup!.content.slice(declId.start!, declId.end!)
  }

  return true
}
```

## 处理解构

从 `ObjectPattern` 中提取每个属性并注册为绑定．

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "ObjectProperty") {
      const key = prop.key
      const value = prop.value

      // 获取属性名
      let propKey: string
      if (key.type === "Identifier") {
        propKey = key.name
      } else if (key.type === "StringLiteral") {
        propKey = key.value
      } else {
        continue
      }

      // 处理本地变量名和默认值
      let local: string
      let defaultValue: string | undefined

      if (value.type === "Identifier") {
        // const { count } = defineProps(...)
        local = value.name
      } else if (value.type === "AssignmentPattern") {
        // const { count = 0 } = defineProps(...)
        if (value.left.type === "Identifier") {
          local = value.left.name
          defaultValue = scriptSetup!.content.slice(
            value.right.start!,
            value.right.end!
          )
        } else {
          continue
        }
      } else {
        continue
      }

      // 注册绑定
      propsDestructuredBindings[propKey] = { local, default: defaultValue }
      bindingMetadata[local] = BindingTypes.PROPS
    }
  }
}
```

## 默认值处理

当在解构中指定默认值时，将其合并到 props 定义中．

```ts
function genRuntimeProps(): string | undefined {
  if (!propsRuntimeDecl) return undefined

  let propsString = scriptSetup!.content.slice(
    propsRuntimeDecl.start!,
    propsRuntimeDecl.end!
  )

  // 如果有默认值则合并
  const defaults: Record<string, string> = {}
  for (const key in propsDestructuredBindings) {
    const binding = propsDestructuredBindings[key]
    if (binding.default) {
      defaults[key] = binding.default
    }
  }

  if (Object.keys(defaults).length > 0) {
    // 相当于 withDefaults 的处理
    propsString = mergeDefaults(propsString, defaults)
  }

  return propsString
}

function mergeDefaults(
  propsString: string,
  defaults: Record<string, string>
): string {
  // 实际实现通过操作 AST 来合并默认值
  // 这里是简化示例
  const ast = parseExpression(propsString)
  // ... 合并默认值的处理
  return generate(ast).code
}
```

## 转换 Props 访问

在模板和脚本中，将解构变量的访问转换为 `__props.xxx`．

```ts
function processPropsAccess(source: string): string {
  const s = new MagicString(source)

  // 遍历标识符并转换
  walk(scriptSetupAst, {
    enter(node: Node) {
      if (node.type === "Identifier") {
        const binding = propsDestructuredBindings[node.name]
        if (binding && binding.local === node.name) {
          // 转换为 props 访问
          s.overwrite(node.start!, node.end!, `__props.${node.name}`)
        }
      }
    }
  })

  return s.toString()
}
```

<KawaikoNote variant="surprise" title="编译器的魔法！">

解构在普通 JavaScript 中通常会失去响应性，\
但编译器将其转换为 `__props.xxx` 访问，\
使你可以将解构语法作为语法糖使用！

</KawaikoNote>

## Rest 模式支持

也可以支持 `...rest` 模式．

```vue
<script setup>
const { id, ...attrs } = defineProps(['id', 'class', 'style'])
</script>
```

```ts
function processPropsDestructure(pattern: ObjectPattern) {
  for (const prop of pattern.properties) {
    if (prop.type === "RestElement") {
      // 处理 rest 模式
      if (prop.argument.type === "Identifier") {
        const restName = prop.argument.name
        // rest 需要特殊处理
        // 实际上使用 computed 来获取剩余的 props
        bindingMetadata[restName] = BindingTypes.SETUP_REACTIVE_CONST
      }
    }
    // ...
  }
}
```

## 测试

```vue
<!-- Parent.vue -->
<script setup>
import { ref } from 'chibivue'
import Child from './Child.vue'

const count = ref(0)
const message = ref('Hello')
</script>

<template>
  <Child :count="count" :message="message" />
  <button @click="count++">Increment</button>
</template>
```

```vue
<!-- Child.vue -->
<script setup>
const { count, message = 'default' } = defineProps({
  count: Number,
  message: String
})

// count 和 message 被转换为 __props.count, __props.message
console.log(count, message)
</script>

<template>
  <p>{{ count }} - {{ message }}</p>
</template>
```

## 未来扩展

可以考虑以下功能：

- **别名支持**：支持 `const { count: c } = defineProps(...)`
- **数组模式**：与数组形式的 props 定义组合

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/050_props_destructure)

## 总结

- Props 解构是 Vue 3.5 引入的功能
- 检测解构模式并将每个属性注册为 `PROPS` 绑定
- 默认值合并到 props 定义中
- 将变量访问转换为 `__props.xxx` 以保持响应性

## 参考链接

- [Vue.js - 响应式 Props 解构](https://cn.vuejs.org/guide/components/props.html#reactive-props-destructure) - Vue 官方文档
- [RFC - Reactive Props Destructure](https://github.com/vuejs/rfcs/discussions/502) - Vue RFC
