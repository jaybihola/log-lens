import { request, jsonPost, jsonPut, jsonDelete } from '../../shared/api/http.js';

export const jsonLensApi = {
  // ---- open root folders ----
  listRoots: () => request('/api/json-lens/roots'),
  addRoot: (dirPath) => jsonPost('/api/json-lens/roots', { path: dirPath }),
  removeRoot: (dirPath) => jsonDelete('/api/json-lens/roots', { path: dirPath }),

  // ---- browsing ----
  browse: (dir, showHidden) => request(`/api/json-lens/browse?${new URLSearchParams({ dir: dir || '', showHidden: showHidden ? 'true' : 'false' })}`),

  // ---- files on disk ----
  readFile: (filePath) => request(`/api/json-lens/file?${new URLSearchParams({ path: filePath })}`),
  writeFile: (filePath, content) => jsonPost('/api/json-lens/file', { path: filePath, content }),
  fileExists: (filePath) => request(`/api/json-lens/file-exists?${new URLSearchParams({ path: filePath })}`),
  deleteFile: (filePath) => request(`/api/json-lens/file?${new URLSearchParams({ path: filePath })}`, { method: 'DELETE' }),
  renameFile: (from, to) => jsonPost('/api/json-lens/file/rename', { from, to }),

  // ---- scratches ----
  listScratches: () => request('/api/json-lens/scratches'),
  createScratch: (name, content) => jsonPost('/api/json-lens/scratches', { name, content }),
  readScratch: (id) => request(`/api/json-lens/scratches/${id}`),
  updateScratch: (id, patch) => jsonPut(`/api/json-lens/scratches/${id}`, patch),
  deleteScratch: (id) => request(`/api/json-lens/scratches/${id}`, { method: 'DELETE' }),
};
