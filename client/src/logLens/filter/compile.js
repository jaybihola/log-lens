import { buildSimpleMatcher, highlightTermsForSimple } from './simpleJql.js';
import { ownTimestamp, parseTimestampMs } from '../render/timestamp.js';

// compileQuery(query, opts) -> { matcher, terms, error } — the shape the
// rest of the app consumes. A malformed query must not hide the buffer: fall
// back to "show everything" and surface the parse error separately, so a
// typo never looks like "all my logs disappeared."
//
// `timeRange` (optional `{ start, end }`, ms epoch) is a second, independent
// filtering axis — the time-histogram's drag-to-select — ANDed on top of the
// JQL match rather than folded into the query string itself: it has its own
// clear/reset (see TimeHistogram.jsx) distinct from clearing the JQL text,
// and a line with no resolvable timestamp can't be judged against a time
// bound so it's excluded once a time range is active (mirrors the
// histogram's own "untimestamped lines aren't charted" honesty).
export function compileQuery(query, { caseSensitive = false, timeRange = null } = {}) {
  try {
    const jqlMatcher = buildSimpleMatcher(query, caseSensitive);
    const matcher = timeRange
      ? (text) => {
        if (!jqlMatcher(text)) return false;
        const raw = ownTimestamp(text);
        const ms = raw ? parseTimestampMs(raw) : null;
        return ms !== null && ms >= timeRange.start && ms <= timeRange.end;
      }
      : jqlMatcher;
    return {
      matcher,
      terms: highlightTermsForSimple(query),
      error: null,
    };
  } catch (e) {
    return { matcher: () => true, terms: [], error: e.message };
  }
}
