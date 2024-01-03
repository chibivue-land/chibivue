<script setup>
import { useRouter } from 'chibivue-router'
const router = useRouter()
</script>

<template>
  <div id="pages-app">
    <header>
      <nav>
        <button @click="router.push('/')">Top</button>
        <button @click="router.push('/state')">state</button>
        <button @click="router.push('/directive')">directive</button>
        <button @click="router.push('/props-emits')">props/emit</button>
        <button @click="router.push('/compiler-macro')">macro</button>
        <button @click="router.push('/options-api')">options api</button>
        <button @click="router.push('/inline')">inline</button>
        <button @click="router.push('/store-counter')">store</button>
        <button @click="router.push('/todo-app')">todo app</button>
      </nav>
    </header>

    <div id="pages-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
#pages-app {
  height: 100%;
  font-family: 'Hannotate SC';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#pages-content {
  background: #efeeea;
  padding: 20px;
  height: 88%;
}

#pages-app header nav {
  background: #1c273e;
  height: 12%;
  padding: 1rem 2rem;
}

#pages-app header nav button {
  font-family: 'Hannotate SC';
  text-decoration: underline;
  border: none;
  padding: 8px;
  width: 120px;
  background: #92b5a9;
  color: #fff;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}

#pages-app header nav button:hover {
  opacity: 0.8;
}
</style>
