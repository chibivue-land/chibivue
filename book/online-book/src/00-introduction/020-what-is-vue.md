# What is Vue.js?

## A quick recap about Vue.js

Let's get straight to the point.  
But before that, let's quickly recap what Vue.js is all about.

## What's Vue.js again?

Vue.js is a "friendly, high-performance, and versatile framework for building web user interfaces."  
This is stated on the official documentation's homepage.  
For this, I believe it's clearer to directly quote the official words without adding my own interpretation, so I've cited them below:

> Vue (pronounced /vjuː/, like view) is a JavaScript framework for building user interfaces. It builds on top of standard HTML, CSS, and JavaScript and provides a declarative and component-based programming model that helps you efficiently develop user interfaces, be they simple or complex.

> Declarative Rendering: Vue extends standard HTML with a template syntax that allows us to declaratively describe HTML output based on JavaScript state.

> Reactivity: Vue automatically tracks JavaScript state changes and efficiently updates the DOM when changes happen.

> Here's a minimal example:
>
> ```ts
> import { createApp } from 'vue'
>
> createApp({
>   data() {
>     return {
>       count: 0,
>     }
>   },
> }).mount('#app')
> ```
>
> ```html
> <div id="app">
>   <button @click="count++">Count is: {{ count }}</button>
> </div>
> ```

[reference source](https://vuejs.org/guide/introduction.html#what-is-vue)

For declarative rendering and reactivity, we will delve into them in detail in their respective chapters, so a high-level understanding is fine for now.

Also, the term "framework" has come up here, and Vue.js promotes itself as a "progressive framework." For more on that, I believe it's best to refer directly to the following section of the documentation:

https://vuejs.org/guide/introduction.html#the-progressive-framework

## The difference between the official documentation and this book

The official documentation focuses on "how to use Vue.js," with an abundance of tutorials and guides provided.

However, this book takes a slightly different approach, focusing on "how Vue.js is implemented." We'll write actual code to create a mini version of Vue.js.

Also, this book isn't an official publication and may not be exhaustive. There might be some errors or omissions, so I'd appreciate any feedback or corrections.
