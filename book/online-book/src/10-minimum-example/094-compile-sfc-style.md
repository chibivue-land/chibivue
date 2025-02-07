# Compile Style Blocks

## Virtual Modules

Let's also support styles. \
In Vite, you can import CSS files by using the `.css` extension.

```js
import 'app.css'
```

We will implement this by using Vite's virtual modules. \
Virtual modules allow you to keep non-existent files in memory as if they exist. \
You can use the `load` and `resolveId` options to implement virtual modules.

```ts
export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'

  return {
    name: 'my-plugin', // Required, displayed in warnings and errors
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

Using this mechanism, we will load the style block of an SFC as a virtual CSS file.  
As mentioned earlier, in Vite, importing a file with the `.css` extension is sufficient, so we will consider creating a virtual module named `${SFC file name}.css`.

## Implementing a Virtual Module with the Content of the SFC Style Block

For this example, let's consider a file named "App.vue" and implement a virtual module named "App.vue.css" for its style section.  
The process is straightforward: when a file named `**.vue.css` is loaded, we will retrieve the SFC using `fs.readFileSync` from the file path without the `.css` (i.e., the original Vue file), parse it to extract the content of the style tag, and return that content as the code.


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
      // This ID is a non-existent path, but we handle it virtually in load, so we return the ID to indicate that it can be loaded
      if (id.match(/\.vue\.css$/)) return id

      // For IDs that are not returned here, if the file actually exists, the file will be resolved, and if it does not exist, an error will be thrown
    },
    load(id) {
      // Handling when .vue.css is loaded (when import is declared and loaded)
      if (id.match(/\.vue\.css$/)) {
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8') // Retrieve the SFC file normally
        const { descriptor } = parse(content, { filename }) // Parse the SFC

        // Join the content and return it as the result
        const styles = descriptor.styles.map(it => it.content).join('\n')
        return { code: styles }
      }
    },

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")
      outputs.push(`import '${id}.css'`) // Declare the import statement for ${id}.css
      //  ,
      //  ,
      //  ,
    },
  }
}
```

Now, let's check in the browser.

![load_virtual_css_module](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module.png)

It seems that the styles are applied correctly.

In the browser, you can see that the CSS is imported and a `.vue.css` file is generated virtually.

![load_virtual_css_module2](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module2.png)  
![load_virtual_css_module3](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module3.png)

Now you can use SFC!

Source code up to this point:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler4)
