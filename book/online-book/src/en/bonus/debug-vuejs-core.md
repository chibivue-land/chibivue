# Debugging the original source code

There may be times when you want to run and test the actual source code of Vue.js.  
As part of the approach in this book, we strongly recommend reading and understanding the original source code, as well as conducting source code reading and test plays.

Therefore, we will introduce several methods for debugging the original source code that are not covered in the main text.

(We will introduce them in an easy-to-understand order.)

## Utilizing SFC Playground

This is the easiest method. It is widely known and even linked from the official documentation.

https://play.vuejs.org

In this playground, you can not only write Vue components and check their behavior, but also check the compilation results of SFC.  
It is convenient because you can quickly check it in the browser. (Of course, you can also share it.)

<video src="https://github.com/Ubugeeei/Ubugeeei/assets/71201308/8281e589-fdaf-4206-854e-25a66dfaac05" controls />

## Utilizing vuejs/core tests

Next, let's try running the tests of [vuejs/core](https://github.com/vuejs/core).
Naturally, you need to clone the source code of [vuejs/core](https://github.com/vuejs/core).

```bash
git clone https://github.com/vuejs/core.git vuejs-core
# NOTE: It is recommended to make it easy to understand since the repository name is `core`
```

Then,

```bash
cd vuejs-core
ni
nr test
```

You can run the tests, so feel free to modify the source code you are interested in and run the tests.

There are several test commands other than `test`, so if you are interested, please check `package.json`.

You can read and understand the test code, modify the code and run the tests, or add test cases. There are various ways to use it.

<img width="590" alt="Screenshot 2024-01-07 0 31 29" src="https://github.com/Ubugeeei/Ubugeeei/assets/71201308/3c862bd5-1d94-4d2a-a9fa-8755872098ed">

## Running the vuejs/core source code

Next, this is the most convenient but still the method of actually modifying and running the vuejs/core source code.

Regarding this, we have prepared projects that can be HMR with vite for both SFC and standalone, so please try using them.
This project is in the repository of [chibivue](https://github.com/Ubugeeei/chibivue), so please clone it.

```bash
git clone https://github.com/Ubugeeei/chibivue.git
```

Once cloned, run the script to create the project.

At this time, you should be asked for the **absolute path** of the local vuejs/core source code, so please enter it.

```bash
cd chibi-vue
ni
nr setup:vue

# 💁 input your local vuejs/core absolute path:
#   e.g. /Users/ubugeeei/oss/vuejs-core
#   >
```

This will create a Vue project in the chibivue repository that points to the local vuejs/core source code.

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/5d57c022-c411-4452-9e7e-c27623ec28b4" controls/>

Then, when you want to start, you can start it with the following command and check the operation while modifying the vuejs/core source code.

```bash
nr dev:vue
```

Of course, HMR on the playground side,

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/a2ad46d8-4b07-4ac5-a887-f71507c619a6" controls/>

Even if you modify the vuejs/core code, HMR will work.

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/72f38910-19b8-4171-9ed7-74d1ba223bc8" controls/>

---

Also, if you want to check it in standalone, you can also use HMR by changing the index.html to load standalone-vue.js.

<video src="https://github.com/Ubugeeei/work-log/assets/71201308/c57ab5c2-0e62-4971-b1b4-75670d3efeec" controls/>
