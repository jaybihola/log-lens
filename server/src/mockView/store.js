import fs from 'node:fs';
import { MOCK_VIEW_STATE_FILE } from '../config.js';

// Same immediate-persist-per-mutator shape as jsonLens/store.js — its own
// state file, no separate "don't forget to save" step. A collection holds
// one level of folders (each holding requests) plus ungrouped requests
// directly on the collection, matching the scope ROADMAP.md originally
// sketched for this tool.

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MOCK_VIEW_STATE_FILE, 'utf8'));
    return {
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      environments: Array.isArray(parsed.environments) ? parsed.environments : [],
      activeEnvironmentId: typeof parsed.activeEnvironmentId === 'string' ? parsed.activeEnvironmentId : null,
    };
  } catch {
    return { collections: [], environments: [], activeEnvironmentId: null };
  }
}

let state = load();

function persist() {
  try {
    fs.writeFileSync(MOCK_VIEW_STATE_FILE, JSON.stringify(state));
  } catch {
    // not fatal — persistence just won't survive a restart
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRequest(fields = {}) {
  return {
    id: makeId('req'),
    name: fields.name || 'Untitled request',
    method: fields.method || 'GET',
    url: fields.url || '',
    params: Array.isArray(fields.params) ? fields.params : [],
    headers: Array.isArray(fields.headers) ? fields.headers : [],
    body: fields.body && typeof fields.body === 'object' ? fields.body : { mode: 'none', content: '' },
    auth: fields.auth && typeof fields.auth === 'object' ? fields.auth : { type: 'none' },
  };
}

function findCollection(id) {
  return state.collections.find((c) => c.id === id) || null;
}

// Requests carry a globally-unique id, so an update/delete only ever needs
// (collectionId, requestId) — no need for the caller to also know which
// folder (or none) currently holds it.
function findRequestContainer(collection, requestId) {
  if (collection.requests.some((r) => r.id === requestId)) return collection.requests;
  for (const folder of collection.folders) {
    if (folder.requests.some((r) => r.id === requestId)) return folder.requests;
  }
  return null;
}

// ---- collections ----

export function listCollections() {
  return state.collections;
}

export function createCollection(name) {
  const collection = { id: makeId('col'), name: (name || 'New collection').trim() || 'New collection', requests: [], folders: [] };
  state.collections = [...state.collections, collection];
  persist();
  return collection;
}

export function renameCollection(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return findCollection(id);
  state.collections = state.collections.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  persist();
  return findCollection(id);
}

export function deleteCollection(id) {
  state.collections = state.collections.filter((c) => c.id !== id);
  persist();
}

// ---- folders (one level, inside a collection) ----

export function createFolder(collectionId, name) {
  const collection = findCollection(collectionId);
  if (!collection) return null;
  const folder = { id: makeId('fld'), name: (name || 'New folder').trim() || 'New folder', requests: [] };
  collection.folders = [...collection.folders, folder];
  persist();
  return folder;
}

export function renameFolder(collectionId, folderId, name) {
  const collection = findCollection(collectionId);
  if (!collection) return null;
  const trimmed = (name || '').trim();
  if (!trimmed) return collection.folders.find((f) => f.id === folderId) || null;
  collection.folders = collection.folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f));
  persist();
  return collection.folders.find((f) => f.id === folderId) || null;
}

export function deleteFolder(collectionId, folderId) {
  const collection = findCollection(collectionId);
  if (!collection) return;
  collection.folders = collection.folders.filter((f) => f.id !== folderId);
  persist();
}

// ---- requests (in a collection directly, or inside one of its folders) ----

export function createRequest(collectionId, folderId, fields) {
  const collection = findCollection(collectionId);
  if (!collection) return null;
  const request = makeRequest(fields);
  if (folderId) {
    const folder = collection.folders.find((f) => f.id === folderId);
    if (!folder) return null;
    folder.requests = [...folder.requests, request];
  } else {
    collection.requests = [...collection.requests, request];
  }
  persist();
  return request;
}

export function updateRequest(collectionId, requestId, patch) {
  const collection = findCollection(collectionId);
  if (!collection) return null;
  const container = findRequestContainer(collection, requestId);
  if (!container) return null;
  const idx = container.findIndex((r) => r.id === requestId);
  container[idx] = { ...container[idx], ...patch, id: requestId };
  persist();
  return container[idx];
}

export function deleteRequest(collectionId, requestId) {
  const collection = findCollection(collectionId);
  if (!collection) return;
  collection.requests = collection.requests.filter((r) => r.id !== requestId);
  collection.folders = collection.folders.map((f) => ({ ...f, requests: f.requests.filter((r) => r.id !== requestId) }));
  persist();
}

// ---- environments: named variable sets, one active at a time ----

export function listEnvironments() {
  return { environments: state.environments, activeEnvironmentId: state.activeEnvironmentId };
}

export function createEnvironment(name) {
  const env = { id: makeId('env'), name: (name || 'New environment').trim() || 'New environment', variables: [] };
  state.environments = [...state.environments, env];
  if (!state.activeEnvironmentId) state.activeEnvironmentId = env.id;
  persist();
  return env;
}

export function updateEnvironment(id, patch) {
  const idx = state.environments.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const next = { ...state.environments[idx] };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim();
  if (Array.isArray(patch.variables)) next.variables = patch.variables;
  state.environments = state.environments.map((e, i) => (i === idx ? next : e));
  persist();
  return next;
}

export function deleteEnvironment(id) {
  state.environments = state.environments.filter((e) => e.id !== id);
  if (state.activeEnvironmentId === id) state.activeEnvironmentId = state.environments[0]?.id || null;
  persist();
}

export function setActiveEnvironment(id) {
  state.activeEnvironmentId = id && state.environments.some((e) => e.id === id) ? id : null;
  persist();
  return state.activeEnvironmentId;
}
