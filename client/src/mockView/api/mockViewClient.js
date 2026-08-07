import { request, jsonPost, jsonPut } from '../../shared/api/http.js';

export const mockViewApi = {
  // ---- collections ----
  listCollections: () => request('/api/mock/collections'),
  createCollection: (name) => jsonPost('/api/mock/collections', { name }),
  renameCollection: (id, name) => jsonPut(`/api/mock/collections/${id}`, { name }),
  deleteCollection: (id) => request(`/api/mock/collections/${id}`, { method: 'DELETE' }),

  // ---- folders ----
  createFolder: (collectionId, name) => jsonPost(`/api/mock/collections/${collectionId}/folders`, { name }),
  renameFolder: (collectionId, folderId, name) => jsonPut(`/api/mock/collections/${collectionId}/folders/${folderId}`, { name }),
  deleteFolder: (collectionId, folderId) => request(`/api/mock/collections/${collectionId}/folders/${folderId}`, { method: 'DELETE' }),

  // ---- requests ----
  createRequest: (collectionId, folderId, requestFields) => jsonPost(`/api/mock/collections/${collectionId}/requests`, { folderId, request: requestFields }),
  updateRequest: (collectionId, requestId, patch) => jsonPut(`/api/mock/collections/${collectionId}/requests/${requestId}`, patch),
  deleteRequest: (collectionId, requestId) => request(`/api/mock/collections/${collectionId}/requests/${requestId}`, { method: 'DELETE' }),

  // ---- environments ----
  listEnvironments: () => request('/api/mock/environments'),
  createEnvironment: (name) => jsonPost('/api/mock/environments', { name }),
  updateEnvironment: (id, patch) => jsonPut(`/api/mock/environments/${id}`, patch),
  deleteEnvironment: (id) => request(`/api/mock/environments/${id}`, { method: 'DELETE' }),
  setActiveEnvironment: (id) => jsonPost('/api/mock/environments/active', { id }),

  // ---- sending ----
  send: (payload) => jsonPost('/api/mock/send', payload),

  // ---- mock servers ----
  listMockServers: () => request('/api/mock/servers'),
  createMockServer: (name, port) => jsonPost('/api/mock/servers', { name, port }),
  updateMockServer: (id, patch) => jsonPut(`/api/mock/servers/${id}`, patch),
  deleteMockServer: (id) => request(`/api/mock/servers/${id}`, { method: 'DELETE' }),
  createMockRoute: (serverId, fields) => jsonPost(`/api/mock/servers/${serverId}/routes`, fields),
  updateMockRoute: (serverId, routeId, patch) => jsonPut(`/api/mock/servers/${serverId}/routes/${routeId}`, patch),
  deleteMockRoute: (serverId, routeId) => request(`/api/mock/servers/${serverId}/routes/${routeId}`, { method: 'DELETE' }),
  startMockServer: (id) => jsonPost(`/api/mock/servers/${id}/start`, {}),
  stopMockServer: (id) => jsonPost(`/api/mock/servers/${id}/stop`, {}),
  mockServerTraffic: (id) => request(`/api/mock/servers/${id}/traffic`),
};
