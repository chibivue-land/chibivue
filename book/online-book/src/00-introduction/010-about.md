# Introduction

## 🎯 Purpose of this book

Thank you for picking up this book!  
I am truly delighted if you have even a slight interest in this book.  
Let me first summarize the purpose of this book.

**☆ Purpose**

- **Deepen understanding of Vue.js**  
  What is Vue.js? How is it structured?
- **Be able to implement basic functions of Vue.js**  
  Actually try implementing basic functionalities.
- **Read the source code of vuejs/core**  
  Understand the relation between implementations and the official code, and grasp how they are really built.

I've provided a rough outline of goals, but it's not necessary to fulfill all of them, nor is it a call to pursue perfection.  
Whether you read it cover-to-cover, or just pick out the parts that interest you, it's up to you.  
I'd be happy if you find even a small part of this book useful!

## 🤷‍♂️ Intended Audience

- **Those who have experience with Vue.js**
- **Can write in TypeScript**

With just these two prerequisites, no other knowledge is needed.  
While you might encounter unfamiliar terms throughout the book, I've tried my best to exclude any prior knowledge and explain things along the way, aiming to make this book self-contained.  
However, if you come across terms that shouldn't be used for Vue.js or TypeScript, I recommend learning from the respective resources first.  
(Basic functionalities are enough! (There's no need to delve deep))

## 🙋‍♀️ What this book (and the author) is conscious of (and wants to achieve)

Before diving in, I'd like to share a few things that I've been especially conscious of while writing this book.  
I hope you keep these in mind as you read, and if there are any areas where I've missed the mark, please let me know.

- **Eliminating the need for prior knowledge**  
  While this might overlap with the "Intended Audience" section mentioned earlier, I strive to make this book as self-contained as possible,  
  minimizing the need for prior knowledge and providing explanations as needed.  
  This is because I want to make the explanations as clear as possible to as many readers as I can.  
  Those with a good deal of experience may find some of the explanations a bit verbose, but I ask for your understanding.

- **Incremental implementation**  
  One of the book's goals is to incrementally implement Vue.js by hand. This means that the book focuses on a hands-on approach,  
  and when it comes to implementation, I emphasize building in small, incremental steps.  
  To be more specific, it's about "minimizing non-working states."  
  Instead of having something that won't work until it's complete, the aim is to keep it functioning at every stage.  
  This reflects my personal approach to coding – writing non-functional code continuously can be disheartening.  
  Even if it's imperfect, always having something in motion makes the process more enjoyable.  
  It's about experiencing little victories like, "Yes! It works up to this point now!"

- **Avoiding biases towards specific frameworks, libraries, or languages**  
  While this book focuses on Vue.js, there are countless excellent frameworks, libraries, and languages out there today.  
  In fact, I have my favorites beyond Vue.js, and I frequently benefit from insights and services built with them.  
  The purpose of this book is purely to "understand Vue.js" and doesn't venture into ranking or judging other tools.

## 💡 Topics and structure of this online book

Since this book has turned out quite voluminous, I've set achievement milestones and divided it into different sections.

- **Minimal Example Section**  
   Here, Vue.js is implemented in its most basic form.  
   Although this section covers the smallest set of features, it will deal with  
   the Virtual DOM, the Reactivity System, the Compiler, and SFC (Single File Components) support.  
   However, these implementations are far from practical and are highly simplified.  
   But, for those wanting a broad overview of Vue.js, this section offers sufficient insight.  
   Being an introductory section, the explanations here are more detailed than in other parts.  
   By the end of this section, readers should be somewhat comfortable reading the official Vue.js source code. Functionally, you can expect the code to do roughly the following...

  ```vue
  <script>
  import { reactive } from 'chibivue'

  export default {
    setup() {
      const state = reactive({ message: 'Hello, chibivue!', input: '' })

      const changeMessage = () => {
        state.message += '!'
      }

      const handleInput = e => {
        state.input = e.target?.value ?? ''
      }

      return { state, changeMessage, handleInput }
    },
  }
  </script>

  <template>
    <div class="container" style="text-align: center">
      <h2>{{ state.message }}</h2>
      <img
        width="150px"
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Vue.js_Logo_2.svg/1200px-Vue.js_Logo_2.svg.png"
        alt="Vue.js Logo"
      />
      <p><b>chibivue</b> is the minimal Vue.js</p>

      <button @click="changeMessage">click me!</button>

      <br />

      <label>
        Input Data
        <input @input="handleInput" />
      </label>

      <p>input value: {{ state.input }}</p>
    </div>
  </template>

  <style>
  .container {
    height: 100vh;
    padding: 16px;
    background-color: #becdbe;
    color: #2c3e50;
  }
  </style>
  ```

  ```ts
  import { createApp } from 'chibivue'
  import App from './App.vue'

  const app = createApp(App)

  app.mount('#app')
  ```

- **Basic Virtual DOM Section**  
  In this section, we will implement a fairly practical patch rendering functionality for the Virtual DOM. While we won't be implementing features like "suspense" or other optimizations, it will be proficient enough to handle basic rendering tasks. We will also implement the scheduler here.

- **Basic Reactivity System Section**  
  Although we implemented the reactive API in the Minimal Example section, in this section we will implement other APIs. Starting from basic APIs like ref, watch, and computed, we'll also delve into more advanced APIs like effectScope and the shallow series.

- **Basic Component System Section**  
  Here, we will undertake the basic implementations related to the Component System. In fact, since we'll have already set the base for the Component System in the Basic Virtual DOM section, here we'll focus on other aspects of the Component System. This includes features like props/emit, provide/inject, extensions to the Reactivity System, and lifecycle hooks.

- **Basic Template Compiler Section**  
  In addition to a compiler for the Virtual DOM system implemented in the Basic Virtual DOM section, we will implement directives like v-on, v-bind, and v-for. Generally, this will involve the component's template option, and we won't cover SFC (Single File Components) here.

- **Basic SFC Compiler Section**  
  In this section, we will craft a fairly practical SFC compiler. Leveraging the template compiler from the Basic Template Compiler section, the primary focus here will be on implementing the script compiler. Specifically, we'll implement the script's default exports and the script setup of SFCs. By the end of this section, the feel should be quite close to the usual Vue experience.

- **Web Application Essentials Section**  
  By the time we finish the Basic SFC Compiler section, we'll have a somewhat practical set of Vue.js features. However, to develop a web application, there's still a lot missing. For instance, we'll need tools to manage global state and routers. In this section, we'll develop such external plugins, aiming to make our toolkit even more practical from a "web application development" perspective.

## 🧑‍🏫 About opinions and questions on this book

I intend to respond to questions and feedback about this book to the best of my ability. Feel free to reach out on Twitter (either through DMs or directly on the timeline). Since I've made the repository public, you can also post issues there. I'm aware that my own understanding isn't perfect, so I appreciate any feedback. If you find any explanations unclear or challenging, please don't hesitate to ask. My goal is to spread clear and correct explanations to as many people as possible, and I hope we can build this together 👍.

https://twitter.com/ubugeeei

## 🦀 About the Discord Server

We have created a Discord Server for this book! (2024/01/01)  
Here, we share announcements, provide support for questions and tips related to this online book.  
We also welcome casual conversations, so let's have fun communicating with other chibivue users.  
Currently, most of the conversations are in Japanese as there are many Japanese speakers, but non-Japanese speakers are also welcome to join without hesitation! (It's completely fine to use your native language)

### What we do roughly

- Self-introduction (optional)
- Announcements related to chibivue (such as updates)
- Sharing tips
- Answering questions
- Responding to requests
- Casual conversations
- ubugeeei mutters to himself when working on chibivue (heckling is welcome)

### How to join

Here is the invitation link 👉 https://discord.gg/aVHvmbmSRy

You can also join from the Discord button on the top right of this book's header.

### Eligibility to join

Anyone interested in chibivue (or ubugeeei, or this community)!  
(Please refrain from joining solely for promotional purposes)

### What we would like you to do when joining

Please make sure to read general/rules thoroughly.
Other than that, there are no specific requirements.

## About the Author

**ubugeeei**

<img src="/ubugeeei.jpg" alt="ubugeeei" width="200">

Vue.js member and core staff of the Vue.js Japan User Group.\
Involved in the development of Vapor Mode from its inception (November 2023).\
Became an external collaborator for vuejs/core-vapor in December 2023.\
In April 2024, joined the Vue.js organization and became a member of the Vapor Team.

https://ublog.dev/

<div align="center">

## Sponsors

<a href="https://github.com/sponsors/ubugeeei">
  <img src="https://raw.githubusercontent.com/ubugeeei/sponsors/main/sponsors.png" alt="ubugeeei's sponsors" />
</a>

If you'd like to support my work, I would greatly appreciate it!

https://github.com/sponsors/ubugeeei

</div>