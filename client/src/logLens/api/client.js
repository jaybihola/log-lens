import { request, jsonPost, jsonPut } from '../../shared/api/http.js';

export const api = {
  listTabs: () => request('/api/tabs'),
  createFileTab: (filePath) => jsonPost('/api/tabs', filePath ? { path: filePath } : {}),
  openFile: (tabId, filePath) => jsonPost(`/api/tabs/${tabId}/open`, { path: filePath }),
  activateTab: (tabId) => request(`/api/tabs/${tabId}/activate`, { method: 'POST' }),
  history: (tabId) => request(`/api/tabs/${tabId}/history`),
  clearTab: (tabId) => request(`/api/tabs/${tabId}/clear`, { method: 'POST' }),
  closeTab: (tabId) => request(`/api/tabs/${tabId}`, { method: 'DELETE' }),
  browse: (dir, showHidden) => request(`/api/browse?${new URLSearchParams({ dir: dir || '', showHidden: showHidden ? 'true' : 'false' })}`),

  // ---- remote query ----
  createApiTab: (environment, queryConfig) => jsonPost('/api/tabs', { kind: 'api', environment, queryConfig }),
  queryTab: (tabId, environment, queryConfig) => jsonPost(`/api/tabs/${tabId}/query`, { environment, queryConfig }),
  fetchTab: (tabId) => request(`/api/tabs/${tabId}/fetch`, { method: 'POST' }),
  getSettings: () => request('/api/settings'),
  saveSettings: (settings) => jsonPost('/api/settings', settings),
  listCredentials: () => request('/api/credentials'),
  addCredential: (name, username, password) => jsonPost('/api/credentials', { name, username, password }),
  updateCredential: (id, patch) => jsonPut(`/api/credentials/${id}`, patch),
  removeCredential: (id) => request(`/api/credentials/${id}`, { method: 'DELETE' }),
  esFieldValues: (environment, field, index) => request(`/api/es-field-values?${new URLSearchParams({ environment, field, index: index || '' })}`),
  indexFields: (environment, index) => request(`/api/index-fields?${new URLSearchParams({ environment, index })}`),
  queryPreview: (environment, queryConfig) => jsonPost('/api/es-query-preview', { environment, queryConfig }),
};
