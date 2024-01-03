export interface RouterHistory {
  location: Location
  push(to: string): void
  replace(to: string): void
  go(delta: number, triggerListeners?: boolean): void
}

export const createWebHistory = (): RouterHistory => {
  return {
    location: window.location,
    push(to: string) {
      window.history.pushState({}, '', to)
    },
    replace(to: string) {
      window.history.replaceState({}, '', to)
    },
    go(delta: number, triggerListeners?: boolean) {
      window.history.go(delta)
    },
  }
}
