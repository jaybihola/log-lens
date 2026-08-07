// {{varName}} substitution against the active environment's variables —
// pure and framework-free so both the URL preview (highlighting resolved
// vars inline) and the actual send path can share it. An unresolved
// variable is left as literal `{{name}}` text rather than becoming an
// empty string, so a typo'd or missing variable is visible in the request
// that actually goes out instead of silently vanishing.
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function interpolate(text, variables) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  const map = new Map((variables || []).filter((v) => v.enabled !== false && v.key).map((v) => [v.key, v.value ?? '']));
  return text.replace(VAR_RE, (match, name) => (map.has(name) ? map.get(name) : match));
}

// Splits a string into plain-text and variable-reference segments, for
// rendering the URL bar with `{{var}}` tokens visually distinct from the
// surrounding text (see RequestBuilder.jsx).
export function splitVarSegments(text) {
  if (typeof text !== 'string') return [{ text: '', isVar: false }];
  const segments = [];
  let lastIndex = 0;
  for (const match of text.matchAll(VAR_RE)) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isVar: false });
    segments.push({ text: match[0], isVar: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isVar: false });
  return segments.length ? segments : [{ text, isVar: false }];
}
