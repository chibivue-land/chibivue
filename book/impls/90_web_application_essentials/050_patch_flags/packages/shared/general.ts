export const isArray = Array.isArray;
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === "[object Map]";
export const isSet = (val: unknown): val is Set<any> => toTypeString(val) === "[object Set]";
export const isFunction = (val: unknown): val is Function => typeof val === "function";
export const isString = (val: unknown): val is string => typeof val === "string";
export const isSymbol = (val: unknown): val is symbol => typeof val === "symbol";
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

export const isIntegerKey = (key: unknown) =>
  isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;

const camelizeRE = /-(\w)/g;
export const camelize = (str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ""));
};

const hyphenateRE = /\B([A-Z])/g;
export const hyphenate = (str: string) => str.replace(hyphenateRE, "-$1").toLowerCase();

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const toHandlerKey = (str: string) => (str ? `on${capitalize(str)}` : ``);

export const hasChanged = (value: any, oldValue: any): boolean => !Object.is(value, oldValue);

export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg);
  }
};

export const isOn = (key: string) =>
  key.charCodeAt(0) === 111 /* o */ &&
  key.charCodeAt(1) === 110 /* n */ &&
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return (
    (isObject(val) || isFunction(val)) &&
    isFunction((val as any).then) &&
    isFunction((val as any).catch)
  );
};

export const toDisplayString = (val: unknown): string => {
  return isString(val)
    ? val
    : val == null
      ? ""
      : isArray(val) ||
          (isObject(val) && (val.toString === objectToString || !isFunction(val.toString)))
        ? JSON.stringify(val, null, 2)
        : String(val);
};
