import { isArray } from "@chibivue/shared";

export interface SchedulerJob extends Function {
  id?: number;
  pre?: boolean;
  active?: boolean;
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[];

let isFlushing = false;
let isFlushPending = false;

const queue: SchedulerJob[] = [];
let flushIndex = 0;

const pendingPostFlushCbs: SchedulerJob[] = [];
let activePostFlushCbs: SchedulerJob[] | null = null;
let postFlushIndex = 0;

const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any>;
let currentFlushPromise: Promise<void> | null = null;

export function nextTick<T = void>(this: T, fn?: (this: T) => void): Promise<void> {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(this ? fn.bind(this) : fn) : p;
}

function findInsertionIndex(id: number) {
  let start = flushIndex + 1;
  let end = queue.length;

  while (start < end) {
    const middle = (start + end) >>> 1;
    const middleJobId = getId(queue[middle]);
    middleJobId < id ? (start = middle + 1) : (end = middle);
  }

  return start;
}

export function queueJob(job: SchedulerJob): void {
  if (!queue.length || !queue.includes(job, isFlushing ? flushIndex + 1 : flushIndex)) {
    if (job.id == null) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

export function queuePostFlushCb(cb: SchedulerJobs): void {
  if (!isArray(cb)) {
    if (!activePostFlushCbs || !activePostFlushCbs.includes(cb, postFlushIndex)) {
      pendingPostFlushCbs.push(cb);
    }
  } else {
    pendingPostFlushCbs.push(...cb);
  }
  queueFlush();
}

export function flushPreFlushCbs(i: number = isFlushing ? flushIndex + 1 : 0): void {
  for (; i < queue.length; i++) {
    const cb = queue[i];
    if (cb && cb.pre) {
      queue.splice(i, 1);
      i--;
      cb();
    }
  }
}

export function flushPostFlushCbs(): void {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)];
    pendingPostFlushCbs.length = 0;

    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }

    activePostFlushCbs = deduped;

    activePostFlushCbs.sort((a, b) => getId(a) - getId(b));

    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      activePostFlushCbs[postFlushIndex]();
    }
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}

const getId = (job: SchedulerJob): number => (job.id == null ? Infinity : job.id);

const comparator = (a: SchedulerJob, b: SchedulerJob): number => {
  const diff = getId(a) - getId(b);
  if (diff === 0) {
    if (a.pre && !b.pre) return -1;
    if (b.pre && !a.pre) return 1;
  }
  return diff;
};

function flushJobs() {
  isFlushPending = false;
  isFlushing = true;
  queue.sort(comparator);

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job && job.active !== false) {
        job();
      }
    }
  } finally {
    flushIndex = 0;
    queue.length = 0;
    flushPostFlushCbs();
    isFlushing = false;
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs();
    }
  }
}
