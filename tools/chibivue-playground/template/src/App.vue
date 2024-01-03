<script setup>
import { useRouter } from 'chibivue-router'
const router = useRouter()
</script>

<template>
  <div>
    <nav>
      <button @click="router.push('/')">Top</button>
      <button @click="router.push('/store')">Store</button>
    </nav>
    <RouterView />
  </div>
</template>

<style></style>
