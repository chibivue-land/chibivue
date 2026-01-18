import { isArray, isFunction, isObject, isPlainObject, isString, objectToString } from ".";

export const toDisplayString = (val: unknown): string => {
  return isString(val)
    ? val
    : val == null
      ? ""
      : isArray(val) ||
          (isObject(val) && (val.toString === objectToString || !isFunction(val.toString)))
        ? JSON.stringify(val, replacer, 2)
        : String(val);
};

const replacer = (_key: string, val: any): any => {
  // can't use isRef here since @vue/shared has no deps
  if (val && val.__v_isRef) {
    return replacer(_key, val.value);
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val);
  }
  return val;
};
