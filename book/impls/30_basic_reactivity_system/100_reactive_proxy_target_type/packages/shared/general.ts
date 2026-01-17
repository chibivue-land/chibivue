export const isArray = Array.isArray;
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === "[object Map]";
export const isSet = (val: unknown): val is Set<any> => toTypeString(val) === "[object Set]";
export const isFunction = (val: unknown): val is Function => typeof val === "function";
export const isString = (val: unknown): val is string => typeof val === "string";
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === "object";

export const objectToString = Object.prototype.toString;
export const toTypeString = (value: unknown): string => objectToString.call(value);

export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === "[object Object]";

export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1);
};

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val =>
  hasOwnProperty.call(val, key);

const camelizeRE = /-(\w)/g;
export const camelize = (str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ""));
};

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const toHandlerKey = (str: string) => (str ? `on${capitalize(str)}` : ``);

export const hasChanged = (value: any, oldValue: any): boolean => !Object.is(value, oldValue);
