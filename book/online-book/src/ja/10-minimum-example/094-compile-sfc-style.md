# SFC の style block の実装

## 仮想モジュール

スタイルも対応してしまいます．vite では css という拡張子のファイルを import することでスタイルを読み込めるようになっています．

```js
import 'app.css'
```

vite の仮想モジュールという機能を使って SFC から仮想的な CSS ファイルを作り，アウトプットの JS ファイルの import 文に追加する方針で実装してみます．  
仮想モジュール，と聞くとなんだか難しいように聞こえますが，「実際には存在しないファイルをあたかも存在するようにインメモリに保持しておける」と捉えてもらえれば問題ないです．  
vite では`load`と`resolveId`というオプションを使って仮想モジュールを実現することができます．

```ts
export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'

  return {
    name: 'my-plugin', // 必須、警告やエラーで表示されます
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

resolveId に解決したいモジュールの id を任意に設定し，load でその id をハンドリングすることによってモジュールを読み込むことができます．  
上記の例だと，`virtual:my-module`というファイルは実際には存在しませんが，

```ts
import { msg } from 'virtual:my-module'
```

のように書くと`export const msg = "from virtual module"`が load されます．

[参考](https://ja.vitejs.dev/guide/api-plugin.html#%E4%BB%AE%E6%83%B3%E3%83%A2%E3%82%B7%E3%82%99%E3%83%A5%E3%83%BC%E3%83%AB%E3%81%AE%E8%A6%8F%E7%B4%84)

この仕組みを使って SFC の style ブロックを仮想の css ファイルとして読み込むようにしてみます．  
最初に言った通り，vite では css という拡張子のファイルを import すれば良いので，${SFC のファイル名}.css という仮想モジュールを作ることを考えてみます．

## SFC のスタイルブロックの内容で仮想モジュールを実装する

今回は，たとえば「App.vue」というファイルがあったとき，その style 部分を「App.vue.css」という名前の仮想モジュールを実装することを考えてみます．  
やることは単純で，`**.vue.css`という名前のファイルが読み込まれたら`.css`を除いたファイルパス(つまり通常の Vue ファイル)から SFC を`fs.readFileSync`で取得し，  
パースして style タグの内容を取得し，それを code として返します．

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
      // このidは実際には存在しないパスだが、loadで仮想的にハンドリングするのでidを返してあげる (読み込み可能だということにする)
      if (id.match(/\.vue\.css$/)) return id

      // ここでreturnされないidに関しては、実際にそのファイルが存在していたらそのファイルが解決されるし、存在していなければ存在しないというエラーになる
    },
    load(id) {
      // .vue.cssがloadされた (importが宣言され、読み込まれた) ときのハンドリング
      if (id.match(/\.vue\.css$/)) {
        const filename = id.replace(/\.css$/, '')
        const content = fs.readFileSync(filename, 'utf-8') // 普通にSFCファイルを取得
        const { descriptor } = parse(content, { filename }) //  SFCをパース

        // contentをjoinsして結果とする。
        const styles = descriptor.styles.map(it => it.content).join('\n')
        return { code: styles }
      }
    },

    transform(code, id) {
      if (!filter(id)) return

      const outputs = []
      outputs.push("import * as ChibiVue from 'chibivue'")
      outputs.push(`import '${id}.css'`) // ${id}.cssのimport文を宣言しておく
      //  ,
      //  ,
      //  ,
    },
  }
}
```

さて，ブラウザで確認してみましょう．

![load_virtual_css_module](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module.png)

ちゃんとスタイルが当たるようになっているようです．

ブラウザの方でも，css が import され，.vue.css というファイルが仮想的に生成されているのが分かるかと思います．  
![load_virtual_css_module2](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module2.png)  
![load_virtual_css_module3](https://raw.githubusercontent.com/chibivue-land/chibivue/main/book/images/load_virtual_css_module3.png)

これで SFC が使えるようになりました！

ここまでのソースコード:  
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/10_minimum_example/070_sfc_compiler4)
