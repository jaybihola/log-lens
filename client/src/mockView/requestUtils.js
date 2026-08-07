import { interpolate } from './interpolate.js';

// Pure request-shaping helpers — no fetch, no React — so both the "what
// will actually be sent" preview and the real send path build the exact
// same URL/headers.

export function buildUrl(url, params, variables) {
  const resolved = interpolate(url || '', variables);
  const enabled = (params || []).filter((p) => p.enabled !== false && p.key);
  if (!enabled.length) return resolved;
  const [base, existingQuery] = resolved.split('?');
  const usp = new URLSearchParams(existingQuery || '');
  for (const p of enabled) usp.set(interpolate(p.key, variables), interpolate(p.value ?? '', variables));
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildHeaders(headers, auth, variables) {
  const result = {};
  for (const h of headers || []) {
    if (h.enabled === false || !h.key) continue;
    result[interpolate(h.key, variables)] = interpolate(h.value ?? '', variables);
  }
  if (auth?.type === 'bearer' && auth.token) {
    result.Authorization = `Bearer ${interpolate(auth.token, variables)}`;
  } else if (auth?.type === 'basic' && auth.username) {
    const user = interpolate(auth.username, variables);
    const pass = interpolate(auth.password || '', variables);
    result.Authorization = `Basic ${btoa(`${user}:${pass}`)}`;
  }
  return result;
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
