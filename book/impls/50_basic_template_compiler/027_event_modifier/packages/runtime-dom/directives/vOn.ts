const modifierGuards: Record<string, (e: Event) => void | boolean> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
}

export const withModifiers = (fn: Function, modifiers: string[]) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event)) return
    }
    return fn(event, ...args)
  }
}
