// Tiny fetch-wrapper primitives shared by every feature's API client
// (api/client.js for Log Lens, api/jsonLensClient.js for JSON Lens) —
// extracted so JSON Lens doesn't duplicate this boilerplate, with no change
// in behavior for existing callers.
export async function request(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

const withJsonBody = (method) => (path, body) => request(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const jsonPost = withJsonBody('POST');
export const jsonPut = withJsonBody('PUT');
export const jsonDelete = withJsonBody('DELETE');
