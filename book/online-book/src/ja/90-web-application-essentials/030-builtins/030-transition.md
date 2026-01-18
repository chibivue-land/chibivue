# Transition

## Transition とは

`<Transition>` は，要素やコンポーネントの表示・非表示の切り替え時にアニメーションを適用するための組み込みコンポーネントです．CSS トランジション/アニメーションと連携して，スムーズな UI 遷移を実現します．

主なユースケース：

1. **v-if / v-show との組み合わせ**: 条件付きレンダリング時のアニメーション
2. **動的コンポーネント**: `<component :is>` での切り替えアニメーション
3. **ルート遷移**: ページ間のトランジション効果

## 基本的な使い方

```vue
<template>
  <button @click="show = !show">Toggle</button>
  <Transition name="fade">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

## 実装の概要

### Props の定義

```ts
export interface TransitionProps {
  name?: string;
  type?: "transition" | "animation";
  css?: boolean;
  duration?: number | { enter: number; leave: number };
  enterFromClass?: string;
  enterActiveClass?: string;
  enterToClass?: string;
  appearFromClass?: string;
  appearActiveClass?: string;
  appearToClass?: string;
  leaveFromClass?: string;
  leaveActiveClass?: string;
  leaveToClass?: string;
  mode?: "in-out" | "out-in" | "default";
  appear?: boolean;
  // ライフサイクルフック
  onBeforeEnter?: (el: Element) => void;
  onEnter?: (el: Element, done: () => void) => void;
  onAfterEnter?: (el: Element) => void;
  onEnterCancelled?: (el: Element) => void;
  onBeforeLeave?: (el: Element) => void;
  onLeave?: (el: Element, done: () => void) => void;
  onAfterLeave?: (el: Element) => void;
  onLeaveCancelled?: (el: Element) => void;
  // appear 用フック
  onBeforeAppear?: (el: Element) => void;
  onAppear?: (el: Element, done: () => void) => void;
  onAfterAppear?: (el: Element) => void;
  onAppearCancelled?: (el: Element) => void;
}
```

### TransitionHooks インターフェース

```ts
export interface TransitionHooks<HostElement = Element> {
  mode: string;
  beforeEnter(el: HostElement): void;
  enter(el: HostElement): void;
  leave(el: HostElement, remove: () => void): void;
  clone(vnode: VNode): TransitionHooks<HostElement>;
}
```

レンダラーはこのインターフェースを通じて Transition と連携します．

## CSS クラスのライフサイクル

Transition は以下の CSS クラスを自動的に付与・削除します：

### Enter（要素の表示）

1. **v-enter-from**: 開始状態．要素が挿入される前に追加，1 フレーム後に削除
2. **v-enter-active**: アクティブ状態．トランジション全体で適用
3. **v-enter-to**: 終了状態．開始から 1 フレーム後に追加，トランジション終了時に削除

### Leave（要素の非表示）

1. **v-leave-from**: 開始状態．leave トランジション開始時に追加，1 フレーム後に削除
2. **v-leave-active**: アクティブ状態．トランジション全体で適用
3. **v-leave-to**: 終了状態．開始から 1 フレーム後に追加，トランジション終了時に削除

```
Enter:
┌──────────────────────────────────────────┐
│ v-enter-from → (1 frame) → v-enter-to   │
│ ├─────── v-enter-active ──────────────┤ │
└──────────────────────────────────────────┘

Leave:
┌──────────────────────────────────────────┐
│ v-leave-from → (1 frame) → v-leave-to   │
│ ├─────── v-leave-active ──────────────┤ │
└──────────────────────────────────────────┘
```

## コアロジックの実装

### resolveTransitionProps

Props を解析し，TransitionHooks を生成します．

```ts
export function resolveTransitionProps(
  rawProps: TransitionProps
): TransitionProps & TransitionHooks {
  const {
    name = "v",
    type,
    css = true,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    // ... 他のクラス
    mode = "default",
  } = rawProps;

  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];

  // フック関数を生成
  return {
    ...rawProps,
    mode,
    beforeEnter(el) {
      callHook(onBeforeEnter, [el]);
      addTransitionClass(el, enterFromClass);
      addTransitionClass(el, enterActiveClass);
    },
    enter: makeEnterHook(false),
    leave(el, done) {
      // leave ロジック
    },
    clone(vnode) {
      return resolveTransitionProps(rawProps);
    },
  };
}
```

### CSS クラスの管理

```ts
export interface ElementWithTransition extends HTMLElement {
  _vtc?: Set<string>;
}

export function addTransitionClass(
  el: Element & ElementWithTransition,
  cls: string
): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  (el._vtc || (el._vtc = new Set())).add(cls);
}

export function removeTransitionClass(
  el: Element & ElementWithTransition,
  cls: string
): void {
  cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  const { _vtc } = el;
  if (_vtc) {
    _vtc.delete(cls);
    if (!_vtc.size) {
      el._vtc = undefined;
    }
  }
}
```

`_vtc`（Vue Transition Classes）プロパティで，現在適用されているトランジションクラスを追跡します．

### nextFrame

CSS トランジションを正しく動作させるため，2 フレーム待ってからクラスを変更します．

```ts
function nextFrame(cb: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
```

1 フレーム目でブラウザが初期状態を認識し，2 フレーム目で変更を適用することで，トランジションが確実に発火します．

### Enter フック

```ts
const makeEnterHook = (isAppear: boolean) => {
  return (el: Element, done: () => void) => {
    const hook = isAppear ? onAppear : onEnter;
    const resolve = () => finishEnter(el, isAppear, done);

    callHook(hook, [el, resolve]);

    nextFrame(() => {
      removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
      addTransitionClass(el, isAppear ? appearToClass : enterToClass);
      if (!hasExplicitCallback(hook)) {
        whenTransitionEnds(el, type, enterDuration, resolve);
      }
    });
  };
};
```

1. ユーザー定義フックを呼び出し
2. 2 フレーム後に from クラスを削除，to クラスを追加
3. トランジション終了を検知して完了処理

### Leave フック

```ts
leave(el, done) {
  const resolve = () => finishLeave(el, done);
  addTransitionClass(el, leaveFromClass);
  // 強制リフロー
  forceReflow();
  addTransitionClass(el, leaveActiveClass);

  nextFrame(() => {
    removeTransitionClass(el, leaveFromClass);
    addTransitionClass(el, leaveToClass);
    if (!hasExplicitCallback(onLeave)) {
      whenTransitionEnds(el, type, leaveDuration, resolve);
    }
  });
  callHook(onLeave, [el, resolve]);
}
```

## トランジション終了の検知

### getTransitionInfo

CSS から transition/animation の情報を取得します．

```ts
export function getTransitionInfo(
  el: Element,
  expectedType?: TransitionProps["type"]
): CSSTransitionInfo {
  const styles = window.getComputedStyle(el);

  const transitionDelays = getStyleProperties("transitionDelay").split(", ");
  const transitionDurations = getStyleProperties("transitionDuration").split(", ");
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations);

  const animationDelays = getStyleProperties("animationDelay").split(", ");
  const animationDurations = getStyleProperties("animationDuration").split(", ");
  const animationTimeout = getTimeout(animationDelays, animationDurations);

  // transition と animation のどちらを使用するか決定
  let type: CSSTransitionInfo["type"] = null;
  let timeout = 0;
  let propCount = 0;

  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION;
      timeout = transitionTimeout;
      propCount = transitionDurations.length;
    }
  } else if (expectedType === ANIMATION) {
    // animation の場合
  } else {
    // 自動検出
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0
      ? (transitionTimeout > animationTimeout ? TRANSITION : ANIMATION)
      : null;
  }

  return { type, timeout, propCount, hasTransform };
}
```

### whenTransitionEnds

トランジション終了時にコールバックを実行します．

```ts
export function whenTransitionEnds(
  el: Element & { _endId?: number },
  expectedType: TransitionProps["type"] | undefined,
  explicitTimeout: number | null,
  resolve: () => void
): void {
  const id = (el._endId = ++endId);
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve();
    }
  };

  // 明示的なタイムアウトがあればそれを使用
  if (explicitTimeout) {
    return setTimeout(resolveIfNotStale, explicitTimeout);
  }

  const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
  if (!type) {
    return resolve();
  }

  const endEvent = type + "end"; // "transitionend" or "animationend"
  let ended = 0;

  const onEnd = (e: Event) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };

  // タイムアウトのフォールバック
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);

  el.addEventListener(endEvent, onEnd);
}
```

ポイント：
- `transitionend` / `animationend` イベントを監視
- プロパティの数だけイベントを待つ
- タイムアウトによるフォールバック（イベントが発火しない場合の保険）
- `_endId` で古いトランジションをキャンセル

### forceReflow

CSS トランジションを確実に発火させるため，強制的にリフローを発生させます．

```ts
export function forceReflow(): number {
  return document.body.offsetHeight;
}
```

`offsetHeight` を読み取ることで，ブラウザにスタイルの再計算を強制します．

## Transition コンポーネント本体

```ts
const Transition = (
  props: TransitionProps,
  { slots }: { slots: any }
): VNode | null => {
  const innerProps = resolveTransitionProps(props);
  const children = slots.default && slots.default();

  if (!children || children.length === 0) {
    return null;
  }

  const child = children[0];
  if (child) {
    // VNode に transition フックを設定
    child.transition = innerProps;
  }

  return child;
};
```

Transition 自体は DOM 要素をレンダリングせず，子の VNode に `transition` プロパティを付与するだけです．レンダラーはこのプロパティを見てフックを呼び出します．

## 使用例

### 基本的なフェード

```vue
<template>
  <Transition name="fade">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### スライドアニメーション

```vue
<template>
  <Transition name="slide">
    <p v-if="show">Hello</p>
  </Transition>
</template>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
```

### JavaScript フック

```vue
<template>
  <Transition
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
    :css="false"
  >
    <p v-if="show">Hello</p>
  </Transition>
</template>

<script setup>
function onBeforeEnter(el) {
  el.style.opacity = 0;
}

function onEnter(el, done) {
  // GSAP などのアニメーションライブラリを使用
  gsap.to(el, {
    opacity: 1,
    duration: 0.5,
    onComplete: done,
  });
}

function onLeave(el, done) {
  gsap.to(el, {
    opacity: 0,
    duration: 0.5,
    onComplete: done,
  });
}
</script>
```

### 明示的な duration

```vue
<template>
  <!-- enter: 300ms, leave: 500ms -->
  <Transition name="fade" :duration="{ enter: 300, leave: 500 }">
    <p v-if="show">Hello</p>
  </Transition>
</template>
```

## VNode との連携

### VNode.transition プロパティ

VNode には `transition` プロパティがあり，ここに TransitionHooks が格納されます．

```ts
// packages/runtime-core/src/vnode.ts
export interface VNode<HostNode = any> {
  // ... 他のプロパティ

  // transition
  transition: any | null;
}
```

### Transition コンポーネントでの設定

Transition コンポーネントは，子の VNode に `transition` プロパティを設定します．

```ts
const Transition = (
  props: TransitionProps,
  { slots }: { slots: any }
): VNode | null => {
  const innerProps = resolveTransitionProps(props);
  const children = slots.default && slots.default();

  if (!children || children.length === 0) {
    return null;
  }

  const child = children[0];
  if (child) {
    // VNode に transition フックを設定
    child.transition = innerProps;
  }

  return child;
};
```

### レンダラーでの処理

レンダラーは VNode の `transition` プロパティを検出し，適切なタイミングでフックを呼び出します：

1. **要素の挿入時**: `beforeEnter` → DOM 挿入 → `enter`
2. **要素の削除時**: `leave` → DOM 削除

```ts
// 概念的な処理フロー
const mountElement = (vnode, container, anchor) => {
  const el = createElement(vnode.type);

  // transition がある場合は beforeEnter を呼び出す
  if (vnode.transition) {
    vnode.transition.beforeEnter(el);
  }

  // DOM に挿入
  insert(el, container, anchor);

  // transition がある場合は enter を呼び出す
  if (vnode.transition) {
    vnode.transition.enter(el);
  }
};

const unmountElement = (vnode) => {
  const el = vnode.el;

  // transition がある場合は leave を呼び出す
  if (vnode.transition) {
    vnode.transition.leave(el, () => {
      // leave 完了後に DOM から削除
      remove(el);
    });
  } else {
    remove(el);
  }
};
```

## 処理フロー

```
Transition コンポーネント render
  ↓
resolveTransitionProps で TransitionHooks 生成
  ↓
child.transition = innerProps
  ↓
レンダラー mountElement
  ├── beforeEnter(el)
  │   └── enterFromClass/enterActiveClass を追加
  ├── insert(el, container)
  └── enter(el, done)
      └── nextFrame で
          ├── enterFromClass を削除
          ├── enterToClass を追加
          └── whenTransitionEnds で完了待ち
              └── done() で finishEnter

レンダラー unmountElement
  └── transition.leave(el, remove)
      ├── leaveFromClass 追加
      ├── forceReflow()
      ├── leaveActiveClass 追加
      └── nextFrame で
          ├── leaveFromClass を削除
          ├── leaveToClass を追加
          └── whenTransitionEnds で完了待ち
              └── remove() で DOM 削除
```

## まとめ

Transition の実装は以下の要素で構成されています：

1. **CSS クラス管理**: enter/leave の各フェーズでクラスを付与・削除
2. **nextFrame**: 2 フレーム待機でトランジション発火を保証
3. **forceReflow**: 強制リフローでスタイル再計算
4. **whenTransitionEnds**: transitionend/animationend の監視
5. **JavaScript フック**: CSS を使わないアニメーションのサポート
6. **VNode.transition**: レンダラーがフックを呼び出すためのプロパティ

Transition は CSS トランジション/アニメーションと密接に連携し，ブラウザの描画パイプラインを理解した上で実装されています．

ここまでのソースコード:
[chibivue (GitHub)](https://github.com/chibivue-land/chibivue/tree/main/book/impls/90_web_application_essentials/030_transition)
