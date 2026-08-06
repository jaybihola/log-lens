import { buildSimpleMatcher, highlightTermsForSimple } from './simpleJql.js';

// compileQuery(query, opts) -> { matcher, terms, error } — the shape the
// rest of the app consumes. A malformed query must not hide the buffer: fall
// back to "show everything" and surface the parse error separately, so a
// typo never looks like "all my logs disappeared."
export function compileQuery(query, { caseSensitive = false } = {}) {
  try {
    return {
      matcher: buildSimpleMatcher(query, caseSensitive),
      terms: highlightTermsForSimple(query),
      error: null,
    };
  } catch (e) {
    return { matcher: () => true, terms: [], error: e.message };
  }
}
