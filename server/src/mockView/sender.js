// Requests are sent from here, server-side — never directly from the
// browser — for the same reason Log Lens's remote-query tabs proxy through
// the server: it sidesteps CORS entirely rather than asking every API the
// user points this at to cooperate with a browser security model it has no
// reason to know about.

const TIMEOUT_MS = 30_000;
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

export async function sendHttpRequest({ method, url, headers, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: headers || {},
      body: body && !METHODS_WITHOUT_BODY.has(String(method).toUpperCase()) ? body : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await res.text();
    const responseHeaders = {};
    res.headers.forEach((value, key) => { responseHeaders[key] = value; });
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: text,
      sizeBytes: Buffer.byteLength(text, 'utf8'),
      timeMs: Math.round(performance.now() - start),
    };
  } catch (e) {
    return {
      ok: false,
      error: e.name === 'AbortError' ? `Request timed out after ${TIMEOUT_MS / 1000}s` : e.message,
      timeMs: Math.round(performance.now() - start),
    };
  } finally {
    clearTimeout(timer);
  }
}
