# Reactivity Optimization

::: info About this chapter
This chapter explains the [alien-signals](https://github.com/stackblitz/alien-signals)-based reactivity system optimization that will be introduced in Vue 3.6.\
chibivue's implementation has also been updated based on this algorithm.
:::

## Background

Vue.js's Reactivity System underwent significant performance optimizations in Vue 3.4. However, Vue 3.5 switched to a pull-based algorithm similar to Preact, changing the direction of the Reactivity System.

To further research push-pull based implementations, Johnson Chu , a core contributor to Vue, developed [alien-signals](https://github.com/stackblitz/alien-signals) as an independent project.

alien-signals is a signal library reimplemented based on Vue 3.4's Reactivity System, featuring:

- **Lightweight**: Minimal memory footprint
- **Fast**: Performance improvements
- **Memory efficient**: Reduced memory usage

These achievements will be ported to Vue's core Reactivity System in Vue 3.6.

Reference: [vuejs/core#12349](https://github.com/vuejs/core/pull/12349)

## Push-Pull Reactivity Algorithm

Let's briefly explain the Push-Pull algorithm adopted by alien-signals.

### Push-based vs Pull-based

There are two main approaches to reactivity systems:

**Push-based**

When a dependency changes, all dependent computed values are immediately updated.

```
signal changes → immediately update all computeds → execute effects
```

Pros: Always guarantees the latest value
Cons: Even unused computeds are updated

**Pull-based**

Computed values are only calculated when needed (at read time).

```
signal changes → (do nothing) → read computed in effect → calculate at that point
```

Pros: Only necessary calculations are performed
Cons: Overhead at read time

### Push-Pull (Hybrid)

The Push-Pull algorithm adopted by alien-signals and Vue 3.6 combines the advantages of both:

1. **Push phase**: When a signal changes, set a "dirty" flag on dependent computeds
2. **Pull phase**: When a computed is read, recalculate if dirty

```
signal changes → propagate dirty flag → read computed in effect → recalculate if dirty
```

This approach provides:
- Avoiding unnecessary calculations (advantage of Pull)
- Efficient dependency tracking (advantage of Push)

<KawaikoNote variant="funny" title="Best of Both Worlds!">

The Push-Pull algorithm is a clever approach that combines the best of both Push and Pull.\
The strategy of "propagate only the dirty flag when changes occur, and do the actual calculation when needed" thoroughly eliminates unnecessary computations!

</KawaikoNote>

## Basic API of alien-signals

alien-signals provides a very simple API:

```ts
import { signal, computed, effect } from 'alien-signals'

// signal: Create a reactive value
const count = signal(1)

// Read value
console.log(count()) // 1

// Update value
count(2)

// computed: Create a derived value
const double = computed(() => count() * 2)
console.log(double()) // 4

// effect: Register a side effect
effect(() => {
  console.log(`Count is: ${count()}`)
})

count(3) // "Count is: 3" is printed
```

Compared to Vue's `ref` and `reactive`:

| alien-signals | Vue |
|--------------|-----|
| `signal(value)` | `ref(value)` |
| `signal()` for reading | `.value` for reading |
| `signal(newValue)` for writing | `.value = newValue` for writing |
| `computed(() => ...)` | `computed(() => ...)` |
| `effect(() => ...)` | `watchEffect(() => ...)` |

## Implementation Overview

::: warning
This chapter does not fully port the alien-signals implementation, but explains its concepts and basic mechanisms.\
For a complete understanding, please refer to the [alien-signals source code](https://github.com/stackblitz/alien-signals) or the [Vue 3.6 PR](https://github.com/vuejs/core/pull/12349).
:::

<KawaikoNote variant="base" title="Check out Johnson's explanation!">

If you want to learn more about the alien-signals algorithm, we recommend reading the explanation written by the author, Johnson Chu!\
[https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30](https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30)

</KawaikoNote>

### Doubly Linked List

One of the important optimizations in alien-signals is managing dependencies using a doubly linked list.

The traditional Vue implementation used Set to manage dependencies:

```ts
// Traditional implementation
class Dep {
  subscribers = new Set<ReactiveEffect>()

  track() {
    if (activeEffect) {
      this.subscribers.add(activeEffect)
    }
  }

  trigger() {
    this.subscribers.forEach(effect => effect.run())
  }
}
```

alien-signals uses linked lists:

```ts
// alien-signals style
interface Link {
  dep: Dep
  sub: Subscriber
  prevDep: Link | undefined  // Reference to previous dep of same subscriber
  nextDep: Link | undefined  // Reference to next dep of same subscriber
  prevSub: Link | undefined  // Reference to previous subscriber of same dep
  nextSub: Link | undefined  // Reference to next subscriber of same dep
}
```

This structure provides:
- Reduced memory usage (avoiding Set overhead)
- O(1) addition/removal of dependencies
- Reduced GC pressure

### Version Management

Another important optimization is dirty checking using version numbers:

```ts
let globalVersion = 0

function triggerRef(ref: Ref) {
  globalVersion++
  ref.version = globalVersion
  // Propagate dirty to subscribers
}

function computedGetter(computed: ComputedRef) {
  if (computed.globalVersion !== globalVersion) {
    // One of the dependencies may have been updated
    if (checkDirty(computed)) {
      // Recalculate if actually dirty
      computed.value = computed.getter()
    }
    computed.globalVersion = globalVersion
  }
  return computed.value
}
```

Using a global version provides:
- Efficient determination of whether a computed really needs recalculation
- Avoiding unnecessary dependency traversal

## Implementation in chibivue

chibivue implements the Reactivity System based on this alien-signals algorithm.

Main files:
- `packages/reactivity/dep.ts` - Dependency management
- `packages/reactivity/effect.ts` - Effect implementation
- `packages/reactivity/ref.ts` - Ref implementation
- `packages/reactivity/computed.ts` - Computed implementation

Basic structure:

```ts
// packages/reactivity/dep.ts
export interface Link {
  dep: Dep
  sub: Subscriber
  version: number
  prevDep: Link | undefined
  nextDep: Link | undefined
  prevSub: Link | undefined
  nextSub: Link | undefined
}

export class Dep {
  version = 0
  link: Link | undefined = undefined
  subs: Link | undefined = undefined

  track(): Link | undefined {
    // Register activeEffect as subscriber
  }

  trigger(): void {
    // Notify all subscribers
  }
}
```

```ts
// packages/reactivity/effect.ts
export class ReactiveEffect<T = any> implements Subscriber {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined

  run(): T {
    // Execute effect function and collect dependencies
  }
}
```

The following chapters will build on this optimized Reactivity System.

<KawaikoNote variant="base" title="Moving Forward">

Did you understand the concepts of alien-signals?\
Linked lists and version management might feel difficult at first, but you'll naturally understand them as you write code.\
Let's implement ref and computed on top of this optimized mechanism in the next chapter!

</KawaikoNote>

## Summary

- Vue 3.6 will introduce an optimized Reactivity System based on alien-signals
- Push-Pull algorithm enables efficient dirty checking and lazy evaluation
- Doubly linked list for dependency management improves memory efficiency
- Version number-based dirty checking avoids unnecessary recalculations

From the next chapter, we will implement APIs like ref and computed on top of this optimized Reactivity System.

## References

- [stackblitz/alien-signals](https://github.com/stackblitz/alien-signals) - Official alien-signals repository
- [Detailed explanation of alien-signals algorithm](https://gist.github.com/johnsoncodehk/59e79a0cfa5bb3421b5d166a08e42f30) - Detailed explanation by the author Johnson Chu
- [vuejs/core#12349](https://github.com/vuejs/core/pull/12349) - Vue 3.6 port PR
- [Mastering Vue 3.6's Alien Signals](https://medium.com/@revanthkumarpatha/mastering-vue-3-6s-alien-signals-practical-examples-and-use-cases-7df02a159d8a) - Medium article
