export const enum PatchFlags {
  // Indicates an element with dynamic textContent
  TEXT = 1,
  // Indicates an element with dynamic class binding
  CLASS = 1 << 1,
  // Indicates an element with dynamic style
  STYLE = 1 << 2,
  // Indicates an element with dynamic props other than class and style
  PROPS = 1 << 3,
  // Indicates an element with props that need full diffing
  FULL_PROPS = 1 << 4,
  // Indicates an element with dynamic key (for v-if/v-for)
  NEED_HYDRATION = 1 << 5,
  // Indicates a fragment whose children order doesn't change
  STABLE_FRAGMENT = 1 << 6,
  // Indicates a fragment with keyed or partially keyed children
  KEYED_FRAGMENT = 1 << 7,
  // Indicates a fragment with unkeyed children
  UNKEYED_FRAGMENT = 1 << 8,
  // Indicates an element that only needs non-props patching
  NEED_PATCH = 1 << 9,
  // Indicates a component with dynamic slots
  DYNAMIC_SLOTS = 1 << 10,
  // Indicates a fragment was created only because user placed comments at root level
  DEV_ROOT_FRAGMENT = 1 << 11,
  // Special flag to indicate that the node is hoisted
  HOISTED = -1,
  // Special flag to bail out of optimization
  BAIL = -2,
}

export const PatchFlagNames: Record<number, string> = {
  [PatchFlags.TEXT]: "TEXT",
  [PatchFlags.CLASS]: "CLASS",
  [PatchFlags.STYLE]: "STYLE",
  [PatchFlags.PROPS]: "PROPS",
  [PatchFlags.FULL_PROPS]: "FULL_PROPS",
  [PatchFlags.NEED_HYDRATION]: "NEED_HYDRATION",
  [PatchFlags.STABLE_FRAGMENT]: "STABLE_FRAGMENT",
  [PatchFlags.KEYED_FRAGMENT]: "KEYED_FRAGMENT",
  [PatchFlags.UNKEYED_FRAGMENT]: "UNKEYED_FRAGMENT",
  [PatchFlags.NEED_PATCH]: "NEED_PATCH",
  [PatchFlags.DYNAMIC_SLOTS]: "DYNAMIC_SLOTS",
  [PatchFlags.DEV_ROOT_FRAGMENT]: "DEV_ROOT_FRAGMENT",
  [PatchFlags.HOISTED]: "HOISTED",
  [PatchFlags.BAIL]: "BAIL",
};
