import {
  isArray,
  isFunction,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
} from "@chibivue/shared";
import { escapeHtml } from "./ssrUtils";

export function ssrRenderAttrs(props: Record<string, unknown>, tag?: string): string {
  let ret = "";
  for (const key in props) {
    if (ssrIsIgnoredKey(key) || isOn(key) || (tag === "textarea" && key === "value")) {
      continue;
    }
    const value = props[key];
    if (key === "class") {
      ret += ` class="${ssrRenderClass(value)}"`;
    } else if (key === "style") {
      ret += ` style="${ssrRenderStyle(value)}"`;
    } else {
      ret += ssrRenderDynamicAttr(key, value, tag);
    }
  }
  return ret;
}

function ssrIsIgnoredKey(key: string): boolean {
  return key === "key" || key === "ref" || key === "innerHTML" || key === "textContent";
}

export function ssrRenderDynamicAttr(key: string, value: unknown, tag?: string): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }
  const attrKey =
    tag && (tag.indexOf("-") > 0 || isSVGTag(tag)) ? key : propsToAttrMap[key] || key.toLowerCase();

  if (isBooleanAttr(attrKey)) {
    return value === false ? "" : ` ${attrKey}`;
  } else if (isSSRSafeAttrName(attrKey)) {
    return value === "" ? ` ${attrKey}` : ` ${attrKey}="${escapeHtml(value)}"`;
  } else {
    console.warn(`[@chibivue/server-renderer] Skipped rendering unsafe attribute name: ${attrKey}`);
    return "";
  }
}

export function ssrRenderAttr(key: string, value: unknown): string {
  if (!isRenderableAttrValue(value)) {
    return "";
  }
  return ` ${key}="${escapeHtml(value)}"`;
}

function isRenderableAttrValue(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
}

export function ssrRenderClass(raw: unknown): string {
  return escapeHtml(normalizeClass(raw));
}

export function ssrRenderStyle(raw: unknown): string {
  if (!raw) {
    return "";
  }
  if (isString(raw)) {
    return escapeHtml(raw);
  }
  const styles = normalizeStyle(raw);
  return escapeHtml(stringifyStyle(styles));
}

function stringifyStyle(styles: Record<string, string | number> | null): string {
  let ret = "";
  if (!styles || isString(styles)) {
    return ret;
  }
  for (const key in styles) {
    const value = styles[key];
    const normalizedKey = key.startsWith("--") ? key : hyphenate(key);
    if (isString(value) || typeof value === "number") {
      ret += `${normalizedKey}:${value};`;
    }
  }
  return ret;
}

function hyphenate(str: string): string {
  return str.replace(/\B([A-Z])/g, "-$1").toLowerCase();
}

// Maps props to their corresponding HTML attribute names
const propsToAttrMap: Record<string, string> = {
  acceptCharset: "accept-charset",
  className: "class",
  htmlFor: "for",
  httpEquiv: "http-equiv",
};

// Boolean attributes
const isBooleanAttr = (key: string): boolean => booleanAttrsSet.has(key);

const booleanAttrsSet = new Set(
  (
    "allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare," +
    "default,defaultchecked,defaultmuted,defaultselected,defer,disabled," +
    "enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple," +
    "muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly," +
    "required,reversed,scoped,seamless,selected,sortable,truespeed,typemustmatch,visible"
  ).split(","),
);

// Checks if the attribute name is safe for SSR
const unsafeAttrCharRE = /[>/="'\u0009\u000a\u000c\u0020]/;
function isSSRSafeAttrName(name: string): boolean {
  return !unsafeAttrCharRE.test(name);
}

// SVG tags
const SVG_TAGS = new Set(
  "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view".split(
    ",",
  ),
);

function isSVGTag(tag: string): boolean {
  return SVG_TAGS.has(tag);
}
