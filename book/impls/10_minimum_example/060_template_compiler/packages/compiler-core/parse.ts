export const baseParse = (
  content: string,
): { tag: string; props: Record<string, string>; textContent: string } => {
  const matched = content.match(/<(\w+)\s+([^>]*)>([^<]*)<\/\1>/);
  if (!matched) return { tag: "", props: {}, textContent: "" };

  const [_, tag, attrs, textContent] = matched;

  const props: Record<string, string> = {};
  attrs.replace(/(\w+)=["']([^"']*)["']/g, (_, key: string, value: string) => {
    props[key] = value;
    return "";
  });

  return { tag, props, textContent };
};
