# 対応できていない Props のパッチ

このチャプターでは、現時点で対応できていない Props のパッチを実装していきましょう。  
以下にはいくつか例として対応対象を挙げますが、各自で足りてない所を本家の実装を読みながら実装してみましょう！  
そうすればより実用的なものにグレードアップするはずです！

特に新しいことは出てきません。今までやってきたことで十分実装できるはずです。

注目したいのは、runtime-dom/modules の実装です。

## 新旧の比較

現状だと n2 の props を元にしか更新ができていません。  
n1 と n2 を元に更新しましょう。

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

n1 に存在していて n2n に存在しない props は削除です。  
また、両者に存在していても値が変わっていなければ patch する必要はないのでスキップします。

## class / style (注意)

class と style には複数のバインディング方法があります。

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

これらを実現するには、Basic Template Compiler 部門で説明する `transform` という概念が必要になります。  
本家 Vue の設計に則らなければどこに実装してもいいのですが、本書では本家 Vue の設計に則りたいためここではスキップします。

## innerHTML / textContent

innerHTML と textContent については他の Props と比べて少し特殊です。
というのもこの Prop を持つ要素が子要素を持っていた場合、unmount する必要があります。

TODO: 書く
