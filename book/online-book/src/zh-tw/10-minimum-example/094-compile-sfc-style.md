# 編譯樣式區塊

## 虛擬模組

讓我們也支援樣式．\
在 Vite 中，你可以通過使用 `.css` 副檔名來匯入 CSS 檔案．

```js
import 'app.css'
```

我們將通過使用 Vite 的虛擬模組來實現這一點．\
虛擬模組允許你將不存在的檔案保存在記憶體中，就像它們存在一樣．\
你可以使用 `load` 和 `resolveId` 選項來實現虛擬模組．

```ts
export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'

  return {
    name: 'my-plugin', // 必需，在警告和錯誤中顯示
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

使用這種機制，我們將把 SFC 的樣式區塊作為虛擬 CSS 檔案載入．\
如前所述，在 Vite 中，匯入帶有 `.css` 副檔名的檔案就足夠了，所以我們將考慮創建一個名為 `${SFC 檔案名}.css` 的虛擬模組．

## 實現包含 SFC 樣式區塊內容的虛擬模組

對於這個範例，讓我們考慮一個名為 "App.vue" 的檔案，並為其樣式部分實現一個名為 "App.vue.css" 的虛擬模組．\
過程很簡單：當載入名為 `**.vue.css` 的檔案時，我們將使用 `fs.readFileSync` 從不帶 `.css` 的檔案路徑（即原始 Vue 檔案）檢索 SFC，解析它以提取樣式標籤的內容，並將該內容作為程式碼返回．

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
      // 這個 ID 是一個不存在的路徑，但我們在 load 中虛擬處理它，所以我們返回 ID 以表明它可以被載入
      if (id.match(/\.vue\.css$/)) return id

      // 對於這裡沒有返回的 ID，如果檔案實際存在，檔案將被解析，如果不存在，將拋出錯誤
    },
    load(id) {
      // 處理載入 .vue.css 時（當宣告 import 並載入時）
      if (id.match(/\.vue\.css$/)) {
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8') // 正常檢索 SFC 檔案
        const { descriptor } = parse(content, { filename }) // 解析 SFC

        // 連接內容並將其作為結果返回
        const styles = descriptor.styles.map(it => it.content).join('\n')
        return { code: styles }
      }
    },

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")
      outputs.push(`import '${id}.css'`) // 為 ${id}.css 宣告匯入語句
      //  ,
      //  ,
      //  ,
    },
  }
}
```

現在，讓我們在瀏覽器中檢查．

![load_virtual_css_module](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module.png)

看起來樣式被正確應用了．

在瀏覽器中，你可以看到 CSS 被匯入，並且虛擬生成了一個 `.vue.css` 檔案．

![load_virtual_css_module2](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module2.png)  
![load_virtual_css_module3](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module3.png)

現在你可以使用 SFC 了！

到此為止的原始碼：  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler4)
