# Reactivity の最適化

::: info この章について
この章では，Vue 3.6 で導入される [alien-signals](https://github.com/stackblitz/alien-signals) ベースの reactivity システムの最適化について解説します．\
chibivue の実装もこのアルゴリズムに基づいて更新されています．
:::

## 背景

Vue.js の Reactivity System は，Vue 3.4 で大幅なパフォーマンス最適化が行われました．しかし，Vue 3.5 では Preact に似た pull-based アルゴリズムへの切り替えが行われ，Reactivity System の方向性が変化しました．

そこで，Vue の中心的なコントリビュータである Johnson Chu 氏（@nicekid1）は，push-pull based な実装をさらに研究するため，独立したプロジェクトとして [alien-signals](https://github.com/stackblitz/alien-signals) を開発しました．

alien-signals は Vue 3.4 の Reactivity System をベースに再実装されたシグナルライブラリで，以下の特徴があります:

- **軽量**: 最小限のメモリ使用量
- **高速**: Vue 3.4 の Reactivity System の約 4 倍（400%）のパフォーマンス
- **メモリ効率**: 約 13% のメモリ使用量削減

これらの成果は，Vue 3.6 で Vue 本体の Reactivity System に移植されることになりました．

参考: [vuejs/core#12349](https://github.com/vuejs/core/pull/12349)

<KawaikoNote variant="surprise" title="パフォーマンス 4 倍！">

alien-signals は Vue 3.4 の Reactivity System をベースに再実装され，なんと**約 4 倍**のパフォーマンス向上を達成しました！\
この成果が Vue 3.6 に組み込まれることで，すべての Vue ユーザーがその恩恵を受けられます．

</KawaikoNote>

## Push-Pull リアクティビティアルゴリズム

alien-signals が採用している Push-Pull アルゴリズムについて簡単に説明します．

### Push-based と Pull-based

リアクティビティシステムには大きく分けて 2 つのアプローチがあります:

**Push-based (プッシュ型)**

依存関係が変更されたとき，即座にすべての依存する computed を更新します．

```
signal 変更 → すべての computed を即時更新 → effect を実行
```

利点: 常に最新の値が保証される
欠点: 使用されない computed も更新される

**Pull-based (プル型)**

computed の値が必要になったとき（読み取り時）に初めて計算します．

```
signal 変更 → (何もしない) → effect で computed を読む → その時点で計算
```

利点: 必要な計算のみ実行される
欠点: 読み取り時のオーバーヘッド

### Push-Pull (ハイブリッド)

alien-signals と Vue 3.6 が採用する Push-Pull アルゴリズムは，両方の利点を組み合わせています:

1. **Push フェーズ**: signal が変更されたとき，依存する computed に「dirty」フラグを設定
2. **Pull フェーズ**: computed が読み取られたとき，dirty なら再計算

```
signal 変更 → dirty フラグを伝播 → effect で computed を読む → dirty なら再計算
```

この方式により:
- 不要な計算を避けられる（Pull の利点）
- 依存関係の追跡が効率的（Push の利点）

<KawaikoNote variant="funny" title="いいとこどり！">

Push-Pull アルゴリズムは，Push と Pull の両方の良いところを組み合わせた賢いアプローチです．\
「変更があったら dirty フラグだけ伝えて，実際の計算は必要になったときにやる」という戦略で，無駄な計算を徹底的に排除しています！

</KawaikoNote>

## alien-signals の基本 API

alien-signals は非常にシンプルな API を提供しています:

```ts
import { signal, computed, effect } from 'alien-signals'

// signal: リアクティブな値を作成
const count = signal(1)

// 値の読み取り
console.log(count()) // 1

// 値の更新
count(2)

// computed: 派生値を作成
const double = computed(() => count() * 2)
console.log(double()) // 4

// effect: 副作用を登録
effect(() => {
  console.log(`Count is: ${count()}`)
})

count(3) // "Count is: 3" が出力される
```

Vue の `ref` や `reactive` と比較すると:

| alien-signals | Vue |
|--------------|-----|
| `signal(value)` | `ref(value)` |
| `signal()` で読み取り | `.value` で読み取り |
| `signal(newValue)` で書き込み | `.value = newValue` で書き込み |
| `computed(() => ...)` | `computed(() => ...)` |
| `effect(() => ...)` | `watchEffect(() => ...)` |

## 実装の概要

::: warning
この章では alien-signals の実装を完全に移植するのではなく，その概念と基本的な仕組みを解説します．\
完全な実装を理解したい場合は，[alien-signals のソースコード](https://github.com/stackblitz/alien-signals)や [Vue 3.6 の PR](https://github.com/vuejs/core/pull/12349) を参照してください．
:::

### 双方向連結リスト

alien-signals の重要な最適化の一つは，依存関係を双方向連結リスト（Doubly Linked List）で管理することです．

従来の Vue の実装では，Set を使って依存関係を管理していました:

```ts
// 従来の実装
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

alien-signals では，連結リストを使用します:

```ts
// alien-signals スタイル
interface Link {
  dep: Dep
  sub: Subscriber
  prevDep: Link | undefined  // 同じ subscriber の前の dep への参照
  nextDep: Link | undefined  // 同じ subscriber の次の dep への参照
  prevSub: Link | undefined  // 同じ dep の前の subscriber への参照
  nextSub: Link | undefined  // 同じ dep の次の subscriber への参照
}
```

この構造により:
- メモリ使用量の削減（Set のオーバーヘッドを避ける）
- 依存関係の追加・削除が O(1) で可能
- GC の負荷軽減

### バージョン管理

もう一つの重要な最適化は，バージョン番号による dirty チェックです:

```ts
let globalVersion = 0

function triggerRef(ref: Ref) {
  globalVersion++
  ref.version = globalVersion
  // subscribers に dirty を伝播
}

function computedGetter(computed: ComputedRef) {
  if (computed.globalVersion !== globalVersion) {
    // 依存関係のいずれかが更新された可能性がある
    if (checkDirty(computed)) {
      // 実際に dirty なら再計算
      computed.value = computed.getter()
    }
    computed.globalVersion = globalVersion
  }
  return computed.value
}
```

グローバルバージョンを使用することで:
- computed が本当に再計算が必要かどうかを効率的に判定
- 不要な依存関係の走査を避ける

## chibivue での実装

chibivue では，この alien-signals のアルゴリズムを参考に Reactivity System を実装しています．

主要なファイル:
- `packages/reactivity/dep.ts` - 依存関係の管理
- `packages/reactivity/effect.ts` - effect の実装
- `packages/reactivity/ref.ts` - ref の実装
- `packages/reactivity/computed.ts` - computed の実装

基本的な構造:

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
    // activeEffect を購読者として登録
  }

  trigger(): void {
    // すべての購読者に通知
  }
}
```

```ts
// packages/reactivity/effect.ts
export class ReactiveEffect<T = any> implements Subscriber {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined

  run(): T {
    // effect 関数を実行し，依存関係を収集
  }
}
```

この章以降のチャプターでは，この最適化された Reactivity System をベースに実装を進めていきます．

<KawaikoNote variant="base" title="次のステップへ">

alien-signals の概念を理解できましたか？\
連結リストやバージョン管理は最初は難しく感じるかもしれませんが，実際にコードを書いていくうちに自然と理解できるようになります．\
次のチャプターでは，この最適化された仕組みの上に ref や computed を実装していきましょう！

</KawaikoNote>

## まとめ

- Vue 3.6 では alien-signals ベースの最適化された Reactivity System が導入される
- Push-Pull アルゴリズムにより，効率的な dirty チェックと遅延評価を実現
- 双方向連結リストによる依存関係管理でメモリ効率が向上
- バージョン番号による dirty チェックで不要な再計算を回避

次のチャプターからは，この最適化された Reactivity System の上に，ref や computed などの API を実装していきます．

## 参考リンク

- [stackblitz/alien-signals](https://github.com/stackblitz/alien-signals) - alien-signals 公式リポジトリ
- [vuejs/core#12349](https://github.com/vuejs/core/pull/12349) - Vue 3.6 への移植 PR
- [Vue 3.6 Alien Signals の解説](https://medium.com/@revanthkumarpatha/mastering-vue-3-6s-alien-signals-practical-examples-and-use-cases-7df02a159d8a) - Medium 記事
