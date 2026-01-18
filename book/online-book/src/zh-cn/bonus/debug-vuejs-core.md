# 调试原始源代码

有时您可能想要运行和测试 Vue.js 的实际源代码．  
作为本书方法的一部分，我们强烈建议阅读和理解原始源代码，以及进行源代码阅读和测试实验．

因此，我们将介绍几种调试原始源代码的方法，这些方法在正文中没有涉及．

（我们将按照易于理解的顺序介绍它们．）

## 利用 SFC Playground

这是最简单的方法．它广为人知，甚至在官方文档中也有链接．

https://play.vuejs.org

在这个 playground 中，您不仅可以编写 Vue 组件并检查它们的行为，还可以检查 SFC 的编译结果．  
它很方便，因为您可以在浏览器中快速检查它．（当然，您也可以分享它．）

<video src="https://github.com/ubugeeei/ubugeeei/assets/71201308/8281e589-fdaf-4206-854e-25a66dfaac05" controls />

## 利用 vuejs/core 测试

接下来，让我们尝试运行 [vuejs/core](https://github.com/vuejs/core) 的测试．
当然，您需要克隆 [vuejs/core](https://github.com/vuejs/core) 的源代码．

```bash
git clone https://github.com/vuejs/core.git vuejs-core
# NOTE: 建议使其易于理解，因为仓库名称是 `core`
```

然后，

```bash
cd vuejs-core
ni
pnpm test
```

您可以运行测试，所以请随意修改您感兴趣的源代码并运行测试．

除了 `test` 之外还有几个其他的测试命令，如果您感兴趣，请检查 `package.json`．

您可以阅读和理解测试代码，修改代码并运行测试，或添加测试用例．有各种使用方法．

<img width="590" alt="Screenshot 2024-01-07 0 31 29" src="https://github.com/ubugeeei/ubugeeei/assets/71201308/3c862bd5-1d94-4d2a-a9fa-8755872098ed">

## 运行 vuejs/core 源代码

接下来，这是最方便但仍然是实际修改和运行 vuejs/core 源代码的方法．

关于这一点，我们已经准备了可以与 vite 进行 HMR 的项目，包括 SFC 和独立版本，所以请尝试使用它们．
这个项目在 [chibivue](https://github.com/chibivue-land/chibivue) 的仓库中，所以请克隆它．

```bash
git clone https://github.com/chibivue-land/chibivue.git
```

克隆后，运行脚本来创建项目．

此时，您应该被要求输入本地 vuejs/core 源代码的**绝对路径**，所以请输入它．

```bash
cd chibivue
ni
pnpm setup:vue

# 💁 input your local vuejs/core absolute path:
#   e.g. /Users/ubugeeei/oss/vuejs-core
#   >
```

这将在 chibivue 仓库中创建一个指向本地 vuejs/core 源代码的 Vue 项目．

<video src="https://github.com/ubugeeei/work-log/assets/71201308/5d57c022-c411-4452-9e7e-c27623ec28b4" controls/>

然后，当您想要启动时，您可以使用以下命令启动它，并在修改 vuejs/core 源代码的同时检查操作．

```bash
pnpm dev:vue
```

当然，playground 端的 HMR，

<video src="https://github.com/ubugeeei/work-log/assets/71201308/a2ad46d8-4b07-4ac5-a887-f71507c619a6" controls/>

即使您修改 vuejs/core 代码，HMR 也会工作．

<video src="https://github.com/ubugeeei/work-log/assets/71201308/72f38910-19b8-4171-9ed7-74d1ba223bc8" controls/>

---

另外，如果您想在独立模式下检查它，您也可以通过将 index.html 更改为加载 standalone-vue.js 来使用 HMR．

<video src="https://github.com/ubugeeei/work-log/assets/71201308/c57ab5c2-0e62-4971-b1b4-75670d3efeec" controls/>
