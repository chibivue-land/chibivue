# 無法處理的 Props 的補丁

在本章中，讓我們為目前無法處理的 Props 實現補丁．
以下是一些需要處理的 Props 示例，但請嘗試透過參考原始實現來實現它們，同時自己填補缺失的部分！
透過這樣做，它應該變得更加實用！

沒有什麼特別新的東西．基於我們到目前為止所做的，應該能夠充分實現它．

我想關注的是 runtime-dom/modules 的實現．

## 新舊比較

目前，更新只能基於 n2 的 props 進行．
讓我們基於 n1 和 n2 進行更新．

```ts
const oldProps = n1.props || {}
const newProps = n2.props || {}
```

存在於 n1 但不存在於 n2 中的 Props 應該被刪除．
另外，如果即使兩者都存在但值相同，也不需要補丁，所以跳過它．

## class / style（注意）

有多種綁定 class 和 style 的方法．

```html
<p class="static property">hello</p>
<p :class="'dynamic property'">hello</p>
<p :class="['dynamic', 'property', 'array']">hello</p>
<p :class="{ dynamic: true, property: true, array: true}">hello</p>
<p class="static property" :class="'mixed dynamic property'">hello</p>
<p style="static: true;" :style="{ mixed-dynamic: 'true' }">hello</p>
```

要實現這些，需要在基礎模板編譯器部分解釋的 `transform` 概念．
只要不偏離原始 Vue 的設計，它可以在任何地方實現，但我們在這裡跳過它，因為我們想在本書中遵循原始 Vue 的設計．

## innerHTML / textContent

innerHTML 和 textContent 與其他 Props 相比有點特殊．
這是因為如果具有此 Prop 的元素有子元素，它們需要被卸載．

TODO: 編寫
