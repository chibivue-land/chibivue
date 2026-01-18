# 支持 script setup

::: info 关于本章
本章介绍如何实现 Vue 3 的 `<script setup>` 语法．\
学习 script setup 的工作原理，以更简洁的方式编写组件．
:::

## 什么是 script setup？

`<script setup>` 是 Vue 3.2 引入的编译时语法糖．与传统的 Options API 或 Composition API 相比，它可以更简洁地编写组件．

```vue
<!-- 传统写法 -->
<script>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

export default {
  components: { MyComponent },
  setup() {
    const count = ref(0)
    const increment = () => count.value++
    return { count, increment }
  }
}
</script>

<!-- script setup 写法 -->
<script setup>
import { ref } from 'chibivue'
import MyComponent from './MyComponent.vue'

const count = ref(0)
const increment = () => count.value++
</script>
```

<KawaikoNote variant="surprise" title="简洁多了！">

使用 script setup，不需要 `export default` 或 `return`，导入的组件也会自动注册．\
代码变得非常干净！

</KawaikoNote>

## 实现概述

script setup 的编译包含以下步骤：

1. **导入分析和提升**：提取 import 语句并移动到文件顶部
2. **绑定分析**：跟踪变量声明和函数定义
3. **宏处理**：处理 defineProps，defineEmits 等（后续章节介绍）
4. **代码转换**：转换为 setup 函数并生成 return 语句

## compileScript 函数

`compileScript` 函数是编译 SFC 脚本部分的核心函数．

```ts
// packages/compiler-sfc/src/compileScript.ts

export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  let { script, scriptSetup, source } = sfc

  // 使用 Babel 解析
  const scriptAst = _parse(script?.content ?? "", { sourceType: "module" }).program
  const scriptSetupAst = _parse(scriptSetup?.content ?? "", { sourceType: "module" }).program

  // 没有 script setup 时使用传统处理
  if (!scriptSetup) {
    if (!script) {
      throw new Error(`SFC contains no <script> tags.`)
    }
    return { ...script, bindings: analyzeScriptBindings(scriptAst.body) }
  }

  // 初始化元数据
  const bindingMetadata: BindingMetadata = {}
  const userImports: Record<string, ImportBinding> = Object.create(null)
  const setupBindings: Record<string, BindingTypes> = Object.create(null)

  const s = new MagicString(source)
  // ... 转换处理
}
```

## 导入提升

script setup 内的 import 语句需要移动（提升）到生成代码的开头．

```ts
// 1.2 walk import declarations of <script setup>
for (const node of scriptSetupAst.body) {
  if (node.type === "ImportDeclaration") {
    // 将导入移动到文件顶部
    hoistNode(node)

    // 移除重复导入
    for (let i = 0; i < node.specifiers.length; i++) {
      const specifier = node.specifiers[i]
      const local = specifier.local.name
      const imported = getImportedName(specifier)
      const source = node.source.value

      const existing = userImports[local]
      if (existing) {
        if (existing.source === source && existing.imported === imported) {
          removeSpecifier(i)
        }
      } else {
        registerUserImport(source, local, imported, true)
      }
    }
  }
}
```

<KawaikoNote variant="question" title="为什么需要提升？">

在生成的代码中，import 语句需要放在 `setup()` 函数外部．\
提升将 `<script setup>` 内的导入移动到正确的位置．

</KawaikoNote>

## 绑定分析

为了正确解析模板中引用的变量，我们需要分析脚本中的绑定．

```ts
function walkDeclaration(
  node: Declaration,
  bindings: Record<string, BindingTypes>,
  userImportAliases: Record<string, string> = {},
) {
  if (node.type === "VariableDeclaration") {
    const isConst = node.kind === "const"

    for (const { id, init } of node.declarations) {
      if (id.type === "Identifier") {
        let bindingType
        if (isConst && isStaticNode(init!)) {
          bindingType = BindingTypes.LITERAL_CONST
        } else if (isCallOf(init, userImportAliases["reactive"])) {
          bindingType = BindingTypes.SETUP_REACTIVE_CONST
        } else if (isCallOf(init, userImportAliases["ref"])) {
          bindingType = BindingTypes.SETUP_REF
        } else if (isConst) {
          bindingType = BindingTypes.SETUP_MAYBE_REF
        } else {
          bindingType = BindingTypes.SETUP_LET
        }
        registerBinding(bindings, id, bindingType)
      }
    }
  } else if (node.type === "FunctionDeclaration") {
    bindings[node.id!.name] = BindingTypes.SETUP_CONST
  }
}
```

绑定类型决定了变量在模板中的引用方式：

| 类型 | 描述 | 模板引用 |
|------|------|---------|
| `SETUP_REF` | 用 ref() 创建 | 自动添加 `.value` |
| `SETUP_REACTIVE_CONST` | 用 reactive() 创建 | 直接引用 |
| `SETUP_CONST` | 常量 | 直接引用 |
| `SETUP_LET` | let/var 变量 | 直接引用 |

## 内联模板

使用 script setup 时，模板可以内联到 setup 函数内部．

```ts
// 10. generate return statement
let returned
if (options.inlineTemplate) {
  if (sfc.template) {
    const { code, preamble } = compileTemplate({
      source: sfc.template.content.trim(),
      compilerOptions: { inline: true, bindingMetadata },
    })

    if (preamble) {
      s.prepend(preamble)
    }
    returned = code
  } else {
    returned = `() => {}`
  }
}
s.appendRight(endOffset, `\nreturn ${returned}\n`)
```

生成代码示例：

```ts
// 输入
// <script setup>
// import { ref } from 'chibivue'
// const count = ref(0)
// </script>
// <template>
//   <p>{{ count }}</p>
// </template>

// 输出
import { ref } from 'chibivue'

export default {
  setup(__props) {
    const count = ref(0)

    return (_ctx) => {
      return h('p', count.value)
    }
  }
}
```

## 与 Vite 插件集成

Vite 插件检测并编译 script setup．

```ts
// packages/@extensions/vite-plugin-chibivue/src/script.ts

export function resolveScript(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
): SFCScriptBlock | null {
  if (!descriptor.script && !descriptor.scriptSetup) return null

  return options.compiler.compileScript(descriptor, {
    inlineTemplate: isUseInlineTemplate(descriptor),
  })
}

export function isUseInlineTemplate(descriptor: SFCDescriptor): boolean {
  return !!descriptor.scriptSetup
}
```

## 测试

```vue
<script setup>
import { ref, computed } from 'chibivue'

const count = ref(0)
const double = computed(() => count.value * 2)

const increment = () => {
  count.value++
}
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ double }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

<KawaikoNote variant="base" title="实现完成！">

script setup 的基本实现完成了！\
与传统写法相比，现在可以更简洁地编写组件．\
下一章我们将学习如何实现 `defineProps` 和 `defineEmits` 宏．

</KawaikoNote>

到此为止的源代码：
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/60_basic_sfc_compiler/010_script_setup)

## 总结

- `<script setup>` 是更简洁编写 Composition API 的语法糖
- `compileScript` 处理核心转换逻辑
- 导入提升和绑定分析是重要步骤
- 模板被内联到 setup 函数内部

## 参考链接

- [Vue.js - script setup](https://cn.vuejs.org/api/sfc-script-setup.html) - Vue 官方文档
- [RFC: script setup](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0040-script-setup.md) - Vue RFC
