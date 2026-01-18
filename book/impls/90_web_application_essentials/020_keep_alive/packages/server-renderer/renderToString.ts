import { type App, type VNode, createVNode, isVNode } from "../runtime-core";
import { isPromise, isString } from "../shared";
import { type SSRBuffer, type SSRContext, renderComponentVNode } from "./render";

function nestedUnrollBuffer(
  buffer: SSRBuffer,
  parentRet: string,
  startIndex: number,
): Promise<string> | string {
  if (!buffer.hasAsync) {
    return parentRet + unrollBufferSync(buffer);
  }

  let ret = parentRet;
  for (let i = startIndex; i < buffer.length; i += 1) {
    const item = buffer[i];
    if (isString(item)) {
      ret += item;
      continue;
    }

    if (isPromise(item)) {
      return item.then((nestedItem) => {
        buffer[i] = nestedItem;
        return nestedUnrollBuffer(buffer, ret, i);
      });
    }

    const result = nestedUnrollBuffer(item, ret, 0);
    if (isPromise(result)) {
      return result.then((nestedItem) => {
        buffer[i] = nestedItem as any;
        return nestedUnrollBuffer(buffer, "", i);
      });
    }

    ret = result;
  }

  return ret;
}

export function unrollBuffer(buffer: SSRBuffer): Promise<string> | string {
  return nestedUnrollBuffer(buffer, "", 0);
}

function unrollBufferSync(buffer: SSRBuffer): string {
  let ret = "";
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i];
    if (isString(item)) {
      ret += item;
    } else {
      ret += unrollBufferSync(item as SSRBuffer);
    }
  }
  return ret;
}

export async function renderToString(
  input: App | VNode,
  context: SSRContext = {},
): Promise<string> {
  if (isVNode(input)) {
    // raw vnode, wrap with app
    const vnode = input;
    const buffer = await renderComponentVNode(
      createVNode({ render: () => vnode }, null, null),
      null,
    );
    return unrollBuffer(buffer as SSRBuffer) as Promise<string>;
  }

  // rendering an app
  const app = input;
  const vnode = createVNode(app._component, app._props, null);
  vnode.appContext = app._context;

  const buffer = await renderComponentVNode(vnode);
  const result = await unrollBuffer(buffer as SSRBuffer);

  if (context.__watcherHandles) {
    for (const unwatch of context.__watcherHandles) {
      unwatch();
    }
  }

  return result;
}
