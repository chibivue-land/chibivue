<script>
import { ref, computed } from 'chibivue'

export default {
  setup() {
    const firstName = ref('Vue')
    const lastName = ref('chibivue')

    // Computed with getter and setter
    const fullName = computed({
      get: () => `${firstName.value} ${lastName.value}`,
      set: (val) => {
        const parts = val.split(' ')
        firstName.value = parts[0] || ''
        lastName.value = parts[1] || ''
      },
    })

    const updateFullName = () => {
      fullName.value = 'Hello World'
    }

    return { firstName, lastName, fullName, updateFullName }
  },
}
</script>

<template>
  <div class="container">
    <h2>computed (with setter) Example</h2>

    <div>
      <label>
        First Name:
        <input :value="firstName" @input="firstName = $event.target.value" />
      </label>
    </div>

    <div>
      <label>
        Last Name:
        <input :value="lastName" @input="lastName = $event.target.value" />
      </label>
    </div>

    <p>Full Name (computed): {{ fullName }}</p>

    <button @click="updateFullName">Set fullName = "Hello World"</button>
  </div>
</template>

<style>
.container {
  padding: 16px;
}
label {
  display: block;
  margin: 8px 0;
}
</style>
