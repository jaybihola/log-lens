import { describe, expect, it } from 'vitest';
import {
  escapeHtml, tryFormatJson, highlightJson, highlightXml, highlightPlainLog,
  detectAndHighlight, applyTermHits, visibleLength, truncateHtmlToVisibleChars,
  levelClass, LEVEL_LABELS,
} from './highlight.js';

describe('escapeHtml', () => {
  it('escapes &, <, >', () => {
    expect(escapeHtml('a & <b> c')).toBe('a &amp; &lt;b&gt; c');
  });

  it('leaves quotes untouched', () => {
    expect(escapeHtml('"quoted"')).toBe('"quoted"');
  });
});

describe('tryFormatJson', () => {
  it('pretty-prints valid JSON', () => {
    expect(tryFormatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('returns the input unchanged for invalid JSON', () => {
    expect(tryFormatJson('not json')).toBe('not json');
  });
});

describe('highlightJson', () => {
  it('wraps an object key in a "jk" span (distinguished by trailing colon)', () => {
    expect(highlightJson('{"a":1}')).toContain('<span class="jk">&quot;a&quot;</span>'.replace(/&quot;/g, '"'));
  });

  it('wraps a string value in a "js" span, a key in "jk"', () => {
    const html = highlightJson('{"a":"val"}');
    expect(html).toMatch(/<span class="jk">"a"<\/span>/);
    expect(html).toMatch(/<span class="js">"val"<\/span>/);
  });

  it('wraps booleans as "jb" and null as "jz"', () => {
    const html = highlightJson('{"a":true,"b":null}');
    expect(html).toContain('<span class="jb">true</span>');
    expect(html).toContain('<span class="jz">null</span>');
  });

  it('wraps numbers (including negative/decimal/exponent) as "jn"', () => {
    expect(highlightJson('-1.5e10')).toContain('<span class="jn">-1.5e10</span>');
  });

  it('wraps punctuation characters as "jp"', () => {
    const html = highlightJson('{"a":[1]}');
    expect(html).toContain('<span class="jp">{</span>');
    expect(html).toContain('<span class="jp">[</span>');
    expect(html).toContain('<span class="jp">:</span>');
  });

  it('escapes HTML-significant characters inside string values', () => {
    expect(highlightJson('{"a":"<b>"}')).toContain('&lt;b&gt;');
  });
});

describe('highlightXml', () => {
  it('wraps a tag name in "xt" and an attribute name/value in "xa"/"xv"', () => {
    const html = highlightXml('<a href="x">text</a>');
    expect(html).toMatch(/<span class="xt">a<\/span>/);
    expect(html).toContain('<span class="xa">href</span>');
    expect(html).toContain('<span class="xv">"x"</span>');
  });

  it('escapes the raw text first', () => {
    expect(highlightXml('<a>&</a>')).toContain('&amp;');
  });
});

describe('highlightPlainLog', () => {
  it('wraps an HTML-escaped quoted string as "ls"', () => {
    // Input is already-escaped HTML, since this runs after escapeHtml in
    // the real pipeline (detectAndHighlight).
    expect(highlightPlainLog('say &quot;hi&quot; now')).toBe('say <span class="ls">&quot;hi&quot;</span> now');
  });

  it('wraps a recognizable timestamp as "lts"', () => {
    expect(highlightPlainLog('2024-01-01T12:00:00Z boot')).toBe('<span class="lts">2024-01-01T12:00:00Z</span> boot');
  });

  it('leaves plain text with neither pattern unchanged', () => {
    expect(highlightPlainLog('nothing special here')).toBe('nothing special here');
  });
});

describe('detectAndHighlight', () => {
  it('routes valid JSON to highlightJson', () => {
    expect(detectAndHighlight('{"a":1}')).toContain('<span class="jk">');
  });

  it('routes XML-looking text to highlightXml', () => {
    expect(detectAndHighlight('<a>x</a>')).toContain('<span class="xt">');
  });

  it('falls back to plain-log highlighting for text that only looks like JSON but is invalid', () => {
    const html = detectAndHighlight('{not valid json');
    expect(html).not.toContain('<span class="jk">');
  });

  it('highlights an embedded JSON object within surrounding plain text', () => {
    const html = detectAndHighlight('prefix {"a":1} suffix');
    expect(html).toContain('prefix ');
    expect(html).toContain('<span class="jk">');
    expect(html).toContain(' suffix');
  });

  it('pretty-prints the embedded JSON when formatJson is true', () => {
    const html = detectAndHighlight('prefix {"a":1} suffix', true);
    expect(html).toContain('\n');
  });

  it('returns an escaped empty string for blank text', () => {
    expect(detectAndHighlight('   ')).toBe('   ');
  });
});

describe('applyTermHits', () => {
  it('wraps a matching term in a span with the given class', () => {
    expect(applyTermHits('hello world', ['world'], false)).toBe('hello <span class="hit">world</span>');
  });

  it('defaults to the "hit" class name', () => {
    expect(applyTermHits('x', ['x'], false)).toContain('class="hit"');
  });

  it('uses a custom class name when given', () => {
    expect(applyTermHits('x', ['x'], false, 'find-hit')).toContain('class="find-hit"');
  });

  it('is case-insensitive by default, case-sensitive when asked', () => {
    expect(applyTermHits('Hello', ['hello'], false)).toContain('<span class="hit">Hello</span>');
    expect(applyTermHits('Hello', ['hello'], true)).toBe('Hello');
  });

  it('never matches inside existing tag markup', () => {
    const html = '<span class="jk">key</span>';
    expect(applyTermHits(html, ['span'], false)).toBe(html);
  });

  it('returns the input unchanged for an empty terms list', () => {
    expect(applyTermHits('hello', [], false)).toBe('hello');
  });

  it('skips empty-string terms without matching everything', () => {
    expect(applyTermHits('hello', [''], false)).toBe('hello');
  });
});

describe('visibleLength', () => {
  it('counts only non-tag text', () => {
    expect(visibleLength('<span class="hit">hi</span> there')).toBe('hi there'.length);
  });

  it('counts plain text with no tags', () => {
    expect(visibleLength('plain text')).toBe(10);
  });
});

describe('truncateHtmlToVisibleChars', () => {
  it('truncates plain text to the visible character budget', () => {
    expect(truncateHtmlToVisibleChars('hello world', 5)).toBe('hello');
  });

  it('does not count tag markup against the budget', () => {
    const html = '<span class="hit">hello</span> world';
    expect(truncateHtmlToVisibleChars(html, 5)).toBe('<span class="hit">hello</span>');
  });

  it('closes a span still open at the cut point', () => {
    const html = '<span class="hit">hello world</span>';
    expect(truncateHtmlToVisibleChars(html, 5)).toBe('<span class="hit">hello</span>');
  });

  it('returns the whole string when the budget exceeds its visible length', () => {
    expect(truncateHtmlToVisibleChars('short', 100)).toBe('short');
  });
});

describe('levelClass', () => {
  it('reads a structured JSON LogLevel field', () => {
    expect(levelClass('{"LogLevel":"Error"}')).toBe('lvl-error');
    expect(levelClass('{"LogLevel":"Critical"}')).toBe('lvl-error');
    expect(levelClass('{"LogLevel":"Warning"}')).toBe('lvl-warn');
    expect(levelClass('{"LogLevel":"Debug"}')).toBe('lvl-debug');
    expect(levelClass('{"LogLevel":"Information"}')).toBe('lvl-info');
  });

  it('never flags a JSON entry as an error just because it mentions "exception" in an unrelated field', () => {
    expect(levelClass('{"LogLevel":"Information","Exception":null}')).toBe('lvl-info');
  });

  it('reads a dotnet console-style level prefix', () => {
    expect(levelClass('fail: something broke')).toBe('lvl-error');
    expect(levelClass('warn: careful')).toBe('lvl-warn');
    expect(levelClass('dbug: details')).toBe('lvl-debug');
    expect(levelClass('info: all good')).toBe('lvl-info');
  });

  it('falls back to a keyword scan for unstructured text', () => {
    expect(levelClass('a fatal error occurred')).toBe('lvl-error');
    expect(levelClass('this is just a warning')).toBe('lvl-warn');
    expect(levelClass('verbose trace output')).toBe('lvl-debug');
    expect(levelClass('nothing special')).toBe('lvl-info');
  });

  it('every level class has a label', () => {
    for (const cls of ['lvl-error', 'lvl-warn', 'lvl-info', 'lvl-debug']) {
      expect(LEVEL_LABELS[cls]).toBeTruthy();
    }
  });
});
