import crypto from 'node:crypto';

// Named Basic Auth credentials for remote query environments — kept
// server-side only (never sent to the browser, including via the list
// endpoint below, which redacts passwords) so the client can query a
// backend without holding its own creds. Each environment picks one by id
// (see settings.js's credentialId field) rather than the tool holding a
// single global credential, since different environments commonly need
// different auth.
let credentials = [];

// A .env-provided ES_USERNAME/ES_PASSWORD seeds one credential on first
// boot, purely as a convenience — once anything has been saved via the UI,
// the state file (see restoreCredentialsFromState) is the sole source of
// truth and this seed is not reapplied.
if (process.env.ES_USERNAME) {
  credentials.push({
    id: 'env',
    name: 'From .env',
    username: process.env.ES_USERNAME,
    password: process.env.ES_PASSWORD || '',
  });
}

// Redacted shape for the client — usernames are shown for identification,
// passwords never round-trip once saved.
export function listCredentials() {
  return credentials.map(({ id, name, username }) => ({ id, name, username }));
}

export function getCredentialById(id) {
  return credentials.find((c) => c.id === id) || null;
}

export function addCredential(name, username, password) {
  const cred = { id: crypto.randomUUID(), name, username, password: password || '' };
  credentials.push(cred);
  return cred.id;
}

export function updateCredential(id, patch) {
  const cred = getCredentialById(id);
  if (!cred) return false;
  if (typeof patch.name === 'string') cred.name = patch.name;
  if (typeof patch.username === 'string') cred.username = patch.username;
  if (typeof patch.password === 'string' && patch.password) cred.password = patch.password;
  return true;
}

export function removeCredential(id) {
  credentials = credentials.filter((c) => c.id !== id);
}

// The full (unredacted) list, for state-file persistence only.
export function getAllCredentialsForPersist() {
  return credentials;
}

// Called once at startup, after the state file loads — once anything has
// ever been saved, the state file is authoritative (including an
// intentionally-emptied list), overriding the .env seed above.
export function restoreCredentialsFromState(saved) {
  if (Array.isArray(saved)) credentials = saved;
}
