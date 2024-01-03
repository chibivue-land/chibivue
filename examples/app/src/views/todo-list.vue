<script>
import { ref } from "chibivue";
import { useCounterStore } from "../store/count.store";
const uuid = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
</script>

<script setup>
const newTodo = ref("");
const todos = ref(JSON.parse(localStorage.getItem("todos") ?? "[]"));
const { count: todoMaxLength } = useCounterStore();

const addTodo = () => {
  if (todos.value.length >= todoMaxLength.value) {
    alert("Todo list is full");
    return;
  }
  if (newTodo.value.trim()) {
    todos.value = [
      ...todos.value,
      {
        id: uuid(),
        text: newTodo.value,
        completed: false,
      },
    ];
    localStorage.setItem("todos", JSON.stringify(todos.value));
    newTodo.value = "";
  } else {
    alert("Please enter a todo");
  }
};

const toggleTodoCompletion = (id) => {
  const todo = todos.value.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    localStorage.setItem("todos", JSON.stringify(todos.value));
  }
};

const removeTodo = (id) => {
  todos.value = todos.value.filter((t) => t.id !== id);
  localStorage.setItem("todos", JSON.stringify(todos.value));
};
</script>

<template>
  <div id="pages-todo">
    <h1>todo app</h1>
    <div>
      <p>todo max length: {{ todoMaxLength }} (global counter)</p>
      <label for="new-todo-input" style="display: none"> new todo </label>
      <input
        id="new-todo-input"
        v-model="newTodo"
        type="text"
        placeholder="Enter a new todo"
        class="new-todo-input"
      />
      <button class="create-todo-btn" @click="addTodo">Add Todo</button>
    </div>
    <ul>
      <li v-for="(todo, i) in todos" :key="todo.id">
        <label :for="`todo-${todo.id}-check`" style="display: none"
          >todo check</label
        >
        <input
          class="toggle-todo-completion"
          type="checkbox"
          :id="`todo-${todo.id}-check`"
          :value="todo.completed"
          @change="toggleTodoCompletion(todo.id)"
        />

        <span :class="todo.completed ? 'completed' : ''">{{ todo.text }}</span>
        <button class="delete-todo-btn" @click="removeTodo(todo.id)">
          Delete
        </button>
      </li>
    </ul>
  </div>
</template>

<style>
#pages-todo .new-todo-input {
  font-family: "Hannotate SC";
  border: none;
  padding: 8px;
  width: 240px;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}

.delete-todo-btn {
  font-family: "Hannotate SC";
  border: none;
  padding: 8px;
  background-color: #ff6347;
  color: #fff;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}

.create-todo-btn {
  font-family: "Hannotate SC";
  border: none;
  padding: 8px;
  background-color: #1e90ff;
  color: #fff;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 4px;
}

#pages-todo button:hover {
  opacity: 0.8;
}

#pages-todo ul {
  width: 240px;
  margin: auto;
  margin-top: 24px;
  padding: 0;
}

#pages-todo li {
  align-items: center;
  background-color: #fff;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  list-style: none;
  margin-bottom: 8px;
  padding: 8px 16px;
  width: 240px;
}

#pages-todo li .completed {
  color: grey;
  text-decoration: line-through;
}
</style>
