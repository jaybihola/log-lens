import { useCallback, useEffect, useState } from 'react';
import { mockViewApi } from '../api/mockViewClient.js';

// Server-synced collections + environments. Mutations refetch the whole
// (small — this is a dev tool's own saved requests, not a production
// dataset) collection list afterward rather than surgically patching local
// state — simpler to keep correct than hand-rolling tree updates for a
// one-level-of-folders structure that changes rarely compared to how often
// a request's own fields change (that part lives in useMockTabs instead).
export function useMockCollections() {
  const [collections, setCollections] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [c, e] = await Promise.all([mockViewApi.listCollections(), mockViewApi.listEnvironments()]);
    setCollections(c.collections);
    setEnvironments(e.environments);
    setActiveEnvironmentIdState(e.activeEnvironmentId);
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const createCollection = useCallback(async (name) => { await mockViewApi.createCollection(name); await refresh(); }, [refresh]);
  const renameCollection = useCallback(async (id, name) => { await mockViewApi.renameCollection(id, name); await refresh(); }, [refresh]);
  const deleteCollection = useCallback(async (id) => { await mockViewApi.deleteCollection(id); await refresh(); }, [refresh]);

  const createFolder = useCallback(async (collectionId, name) => { await mockViewApi.createFolder(collectionId, name); await refresh(); }, [refresh]);
  const renameFolder = useCallback(async (collectionId, folderId, name) => { await mockViewApi.renameFolder(collectionId, folderId, name); await refresh(); }, [refresh]);
  const deleteFolder = useCallback(async (collectionId, folderId) => { await mockViewApi.deleteFolder(collectionId, folderId); await refresh(); }, [refresh]);

  const createRequest = useCallback(async (collectionId, folderId, fields) => {
    const created = await mockViewApi.createRequest(collectionId, folderId, fields);
    await refresh();
    return created;
  }, [refresh]);
  const updateRequest = useCallback(async (collectionId, requestId, patch) => { await mockViewApi.updateRequest(collectionId, requestId, patch); await refresh(); }, [refresh]);
  const deleteRequest = useCallback(async (collectionId, requestId) => { await mockViewApi.deleteRequest(collectionId, requestId); await refresh(); }, [refresh]);

  const createEnvironment = useCallback(async (name) => { await mockViewApi.createEnvironment(name); await refresh(); }, [refresh]);
  const updateEnvironment = useCallback(async (id, patch) => { await mockViewApi.updateEnvironment(id, patch); await refresh(); }, [refresh]);
  const deleteEnvironment = useCallback(async (id) => { await mockViewApi.deleteEnvironment(id); await refresh(); }, [refresh]);

  const setActiveEnvironment = useCallback(async (id) => {
    const { activeEnvironmentId: next } = await mockViewApi.setActiveEnvironment(id);
    setActiveEnvironmentIdState(next);
  }, []);

  return {
    ready,
    collections,
    environments,
    activeEnvironmentId,
    activeEnvironment: environments.find((e) => e.id === activeEnvironmentId) || null,
    createCollection,
    renameCollection,
    deleteCollection,
    createFolder,
    renameFolder,
    deleteFolder,
    createRequest,
    updateRequest,
    deleteRequest,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
  };
}
