import { findBalancedJson, tryParseJsonObject } from './jsonPaths.js';

export function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function tryFormatJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw; // not valid JSON — show as-is
  }
}

export function highlightJson(text) {
  const re = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const withTokens = text.replace(re, (match, offset) => {
    let cls;
    if (match[0] === '"') {
      const rest = text.slice(offset + match.length);
      cls = /^\s*:/.test(rest) ? 'jk' : 'js';
    } else if (match === 'true' || match === 'false') {
      cls = 'jb';
    } else if (match === 'null') {
      cls = 'jz';
    } else {
      cls = 'jn';
    }
    return `<span class="${cls}">${escapeHtml(match)}</span>`;
  });
  return withTokens.replace(/[{}[\],:]/g, '<span class="jp">$&</span>');
}

export function highlightXml(text) {
  return escapeHtml(text)
    .replace(/([a-zA-Z_:][\w:.-]*)(=)("[^"]*")/g, '<span class="xa">$1</span>$2<span class="xv">$3</span>')
    .replace(/(&lt;\/?)([a-zA-Z][\w:.-]*)/g, '$1<span class="xt">$2</span>');
}

export function highlightPlainLog(escaped) {
  const re = /(&quot;(?:[^&]|&(?!quot;))*?&quot;)|(\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b)/g;
  return escaped.replace(re, (m, str, ts) => {
    if (str) return `<span class="ls">${str}</span>`;
    if (ts) return `<span class="lts">${ts}</span>`;
    return m;
  });
}

// Finds a JSON object/array embedded anywhere in a larger log message (e.g. a
// prefix line followed by a pretty-printed payload) so it can be highlighted
// on its own even though the surrounding text isn't JSON.
function extractEmbeddedJson(text) {
  const re = /[{[]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const candidate = findBalancedJson(text, m.index);
    if (candidate) {
      try {
        JSON.parse(candidate);
        return { start: m.index, end: m.index + candidate.length, json: candidate };
      } catch { /* not valid JSON at this position — keep scanning */ }
    }
    re.lastIndex = m.index + 1;
  }
  return null;
}

export function detectAndHighlight(text, formatJson) {
  const trimmed = text.trim();
  if (!trimmed) return escapeHtml(text);
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try {
      JSON.parse(trimmed);
      return highlightJson(text);
    } catch { /* not valid JSON — fall through to plain highlighting */ }
  }
  if (trimmed[0] === '<') {
    return highlightXml(text);
  }
  const embedded = extractEmbeddedJson(text);
  if (embedded) {
    const before = text.slice(0, embedded.start);
    const after = text.slice(embedded.end);
    const jsonText = formatJson ? tryFormatJson(embedded.json) : embedded.json;
    return highlightPlainLog(escapeHtml(before)) + highlightJson(jsonText) + highlightPlainLog(escapeHtml(after));
  }
  return highlightPlainLog(escapeHtml(text));
}

// Applies search-term highlighting to already-marked-up HTML without
// touching tag markup.
export function applyTermHits(html, terms, caseSensitive) {
  if (!terms.length) return html;
  const parts = html.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i += 2) {
    let seg = parts[i];
    for (const term of terms) {
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      seg = seg.replace(new RegExp(`(${escaped})`, caseSensitive ? 'g' : 'ig'), '<span class="hit">$1</span>');
    }
    parts[i] = seg;
  }
  return parts.join('');
}

// Counts visible (non-tag) characters in already-marked-up HTML.
export function visibleLength(html) {
  const parts = html.split(/(<[^>]+>)/);
  let len = 0;
  for (let i = 0; i < parts.length; i += 2) len += parts[i].length;
  return len;
}

// Truncates already-highlighted HTML to 'maxChars' visible characters
// without cutting a tag in half, closing any spans still open at the cut point.
export function truncateHtmlToVisibleChars(html, maxChars) {
  const parts = html.split(/(<[^>]+>)/);
  let budget = maxChars;
  let out = '';
  const openTags = [];
  for (const part of parts) {
    if (!part) continue;
    if (part[0] === '<') {
      if (budget <= 0) break;
      const closeMatch = /^<\/(\w+)/.exec(part);
      if (closeMatch) {
        openTags.pop();
      } else if (!/\/>$/.test(part)) {
        const nameMatch = /^<(\w+)/.exec(part);
        if (nameMatch) openTags.push(nameMatch[1]);
      }
      out += part;
    } else if (budget <= 0) {
      break;
    } else if (part.length <= budget) {
      out += part;
      budget -= part.length;
    } else {
      out += part.slice(0, budget);
      budget = 0;
    }
  }
  while (openTags.length) out += `</${openTags.pop()}>`;
  return out;
}

export const LONG_LINE_THRESHOLD = 400; // chars before a line is collapsed by default

const CONSOLE_LEVEL_RE = /^(trce|dbug|info|warn|fail|crit):\s*(.*)$/i;

// Prefer an actual structured level over guessing from keywords — a JSON
// entry's "Exception":null field, for example, contains the literal word
// "exception" even when nothing went wrong, which would otherwise false-flag
// every JSON line as an error.
export function levelClass(text) {
  const obj = tryParseJsonObject(text);
  if (obj && typeof obj.LogLevel === 'string') {
    const lvl = obj.LogLevel.toLowerCase();
    if (lvl === 'error' || lvl === 'critical') return 'lvl-error';
    if (lvl === 'warning') return 'lvl-warn';
    if (lvl === 'debug' || lvl === 'trace') return 'lvl-debug';
    return 'lvl-info';
  }
  const consoleMatch = CONSOLE_LEVEL_RE.exec(text.split('\n')[0]);
  if (consoleMatch) {
    const lvl = consoleMatch[1].toLowerCase();
    if (lvl === 'fail' || lvl === 'crit') return 'lvl-error';
    if (lvl === 'warn') return 'lvl-warn';
    if (lvl === 'dbug' || lvl === 'trce') return 'lvl-debug';
    return 'lvl-info';
  }
  // No recognizable structured level — fall back to a loose keyword scan for
  // unstructured lines. Deliberately excludes "exception" (see comment above).
  if (/\b(error|fatal)\b/i.test(text)) return 'lvl-error';
  if (/\bwarn(ing)?\b/i.test(text)) return 'lvl-warn';
  if (/\bdebug|verbose|trace\b/i.test(text)) return 'lvl-debug';
  return 'lvl-info';
}

export const LEVEL_LABELS = { 'lvl-error': 'ERR', 'lvl-warn': 'WARN', 'lvl-info': 'INFO', 'lvl-debug': 'DBG' };
