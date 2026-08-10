import { request, jsonPost, jsonPut } from '../../shared/api/http.js';

export const diffLensApi = {
  listScratches: () => request('/api/diff-lens/scratches'),
  createScratch: (name, data) => jsonPost('/api/diff-lens/scratches', { name, ...data }),
  readScratch: (id) => request(`/api/diff-lens/scratches/${id}`),
  updateScratch: (id, patch) => jsonPut(`/api/diff-lens/scratches/${id}`, patch),
  deleteScratch: (id) => request(`/api/diff-lens/scratches/${id}`, { method: 'DELETE' }),
};
