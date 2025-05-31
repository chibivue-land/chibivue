# 编译样式块

## 虚拟模块

让我们也支持样式．\
在 Vite 中，你可以通过使用 `.css` 扩展名来导入 CSS 文件．

```js
import 'app.css'
```

我们将通过使用 Vite 的虚拟模块来实现这一点．\
虚拟模块允许你将不存在的文件保存在内存中，就像它们存在一样．\
你可以使用 `load` 和 `resolveId` 选项来实现虚拟模块．

```ts
export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'

  return {
    name: 'my-plugin', // 必需，在警告和错误中显示
    resolveId(id) {
      if (id === virtualModuleId) {
        return virtualModuleId
      }
    },
    load(id) {
      if (id === virtualModuleId) {
        return `export const msg = "from virtual module"`
      }
    },
  }
}
```

使用这种机制，我们将把 SFC 的样式块作为虚拟 CSS 文件加载．\
如前所述，在 Vite 中，导入带有 `.css` 扩展名的文件就足够了，所以我们将考虑创建一个名为 `${SFC 文件名}.css` 的虚拟模块．

## 实现包含 SFC 样式块内容的虚拟模块

对于这个示例，让我们考虑一个名为 "App.vue" 的文件，并为其样式部分实现一个名为 "App.vue.css" 的虚拟模块．\
过程很简单：当加载名为 `**.vue.css` 的文件时，我们将使用 `fs.readFileSync` 从不带 `.css` 的文件路径（即原始 Vue 文件）检索 SFC，解析它以提取样式标签的内容，并将该内容作为代码返回．

```ts
export default function vitePluginChibivue(): Plugin {
  //  ,
  //  ,
  //  ,
  return {
    //  ,
    //  ,
    //  ,
    resolveId(id) {
      // 这个 ID 是一个不存在的路径，但我们在 load 中虚拟处理它，所以我们返回 ID 以表明它可以被加载
      if (id.match(/\.vue\.css$/)) return id

      // 对于这里没有返回的 ID，如果文件实际存在，文件将被解析，如果不存在，将抛出错误
    },
    load(id) {
      // 处理加载 .vue.css 时（当声明 import 并加载时）
      if (id.match(/\.vue\.css$/)) {
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8') // 正常检索 SFC 文件
        const { descriptor } = parse(content, { filename }) // 解析 SFC

        // 连接内容并将其作为结果返回
        const styles = descriptor.styles.map(it => it.content).join('\n')
        return { code: styles }
      }
    },

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")
      outputs.push(`import '${id}.css'`) // 为 ${id}.css 声明导入语句
      //  ,
      //  ,
      //  ,
    },
  }
}
```

现在，让我们在浏览器中检查．

![load_virtual_css_module](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module.png)

看起来样式被正确应用了．

在浏览器中，你可以看到 CSS 被导入，并且虚拟生成了一个 `.vue.css` 文件．

![load_virtual_css_module2](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module2.png)  
![load_virtual_css_module3](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module3.png)

现在你可以使用 SFC 了！

到此为止的源代码：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler4)
