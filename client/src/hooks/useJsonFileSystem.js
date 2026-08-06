import { useCallback, useEffect, useState } from 'react';
import { jsonLensApi } from '../api/jsonLensClient.js';

function basename(p) {
  const trimmed = p.replace(/\/+$/, '');
  const parts = trimmed.split('/');
  return parts[parts.length - 1] || trimmed || p;
}

function parentPath(p) {
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '/' : p.slice(0, idx);
}

function withJsonExt(name) {
  return name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
}

function makeRootNode(rootPath) {
  return { segment: basename(rootPath), path: rootPath, isFolder: true, children: [], loaded: false, loading: false };
}

// Finds a node anywhere in the tree by its absolute path, only descending
// into branches whose own path is a prefix of the target — cheap even with
// several open roots since it never walks unrelated subtrees.
function findNode(nodes, targetPath) {
  for (const n of nodes) {
    if (n.path === targetPath) return n;
    if (targetPath.startsWith(`${n.path}/`) && n.children.length) {
      const found = findNode(n.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function mapNode(nodes, targetPath, updater) {
  return nodes.map((n) => {
    if (n.path === targetPath) return updater(n);
    if (targetPath.startsWith(`${n.path}/`) && n.children.length) {
      return { ...n, children: mapNode(n.children, targetPath, updater) };
    }
    return n;
  });
}

// JSON Lens's filesystem sidebar: N user-opened root folders rendered as a
// lazy tree (each folder's children are only fetched once expanded — unlike
// the log viewer's field tree, a real directory tree is neither small nor
// safe to eagerly recurse into) plus the flat list of app-managed scratches.
// Both roots and scratches are server-persisted (see server/src/jsonLens/
// store.js), so opened folders and scratch documents both survive a restart.
export function useJsonFileSystem() {
  const [roots, setRoots] = useState([]);
  const [rootNodes, setRootNodes] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [scratches, setScratches] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([jsonLensApi.listRoots(), jsonLensApi.listScratches()]);
      setRoots(r.roots);
      setRootNodes(r.roots.map(makeRootNode));
      setScratches(s.scratches);
      setReady(true);
    })();
  }, []);

  const setNodeState = useCallback((path, patch) => {
    setRootNodes((prev) => mapNode(prev, path, (n) => ({ ...n, ...patch })));
  }, []);

  const loadChildren = useCallback(async (dirPath) => {
    const data = await jsonLensApi.browse(dirPath, false);
    return data.entries.map((e) => ({
      segment: e.name,
      path: dirPath === '/' ? `/${e.name}` : `${dirPath}/${e.name}`,
      isFolder: e.isDir,
      children: [],
      loaded: !e.isDir,
      loading: false,
    }));
  }, []);

  // Silently a no-op when `path` isn't part of any currently-open root —
  // callers like "Save As" may target a directory the user never added to
  // the tree, and that shouldn't spuriously mark an untracked path expanded.
  const refreshFolder = useCallback(async (path) => {
    if (!findNode(rootNodes, path)) return;
    setExpanded((prev) => (prev.has(path) ? prev : new Set([...prev, path])));
    setNodeState(path, { loading: true });
    try {
      const children = await loadChildren(path);
      setNodeState(path, { children, loaded: true, loading: false });
    } catch (e) {
      setNodeState(path, { loading: false, loadError: e.message });
    }
  }, [rootNodes, loadChildren, setNodeState]);

  const toggleExpand = useCallback((path) => {
    setExpanded((prev) => {
      const wasExpanded = prev.has(path);
      const next = new Set(prev);
      if (wasExpanded) next.delete(path); else next.add(path);
      return next;
    });
    setRootNodes((prevNodes) => {
      const node = findNode(prevNodes, path);
      if (!node || node.loaded || node.loading || expanded.has(path)) return prevNodes;
      // Fire the fetch after this render — setNodeState/loadChildren handle
      // their own state updates asynchronously.
      loadChildren(path)
        .then((children) => setNodeState(path, { children, loaded: true, loading: false }))
        .catch((e) => setNodeState(path, { loading: false, loadError: e.message }));
      return mapNode(prevNodes, path, (n) => ({ ...n, loading: true }));
    });
  }, [expanded, loadChildren, setNodeState]);

  const addRoot = useCallback(async (dirPath) => {
    const { roots: next } = await jsonLensApi.addRoot(dirPath);
    setRoots(next);
    setRootNodes((prev) => (prev.some((n) => n.path === dirPath) ? prev : [...prev, makeRootNode(dirPath)]));
  }, []);

  const removeRoot = useCallback(async (dirPath) => {
    const { roots: next } = await jsonLensApi.removeRoot(dirPath);
    setRoots(next);
    setRootNodes((prev) => prev.filter((n) => n.path !== dirPath));
    setExpanded((prev) => new Set([...prev].filter((p) => p !== dirPath && !p.startsWith(`${dirPath}/`))));
  }, []);

  const createFile = useCallback(async (folderPath, fileName, content = '') => {
    const name = withJsonExt(fileName);
    const filePath = folderPath.endsWith('/') ? `${folderPath}${name}` : `${folderPath}/${name}`;
    await jsonLensApi.writeFile(filePath, content);
    await refreshFolder(folderPath);
    return filePath;
  }, [refreshFolder]);

  const deleteFile = useCallback(async (filePath) => {
    await jsonLensApi.deleteFile(filePath);
    await refreshFolder(parentPath(filePath));
  }, [refreshFolder]);

  const renameFile = useCallback(async (fromPath, newName) => {
    const dir = parentPath(fromPath);
    const name = withJsonExt(newName);
    const toPath = dir === '/' ? `/${name}` : `${dir}/${name}`;
    await jsonLensApi.renameFile(fromPath, toPath);
    await refreshFolder(dir);
    return toPath;
  }, [refreshFolder]);

  const createScratch = useCallback(async (name, content) => {
    const entry = await jsonLensApi.createScratch(name, content);
    setScratches((prev) => [...prev, entry]);
    return entry;
  }, []);

  const renameScratch = useCallback(async (id, name) => {
    const updated = await jsonLensApi.updateScratch(id, { name });
    setScratches((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const saveScratchContent = useCallback(async (id, content) => {
    const updated = await jsonLensApi.updateScratch(id, { content });
    setScratches((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteScratchEntry = useCallback(async (id) => {
    await jsonLensApi.deleteScratch(id);
    setScratches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    ready,
    roots,
    rootNodes,
    expanded,
    toggleExpand,
    addRoot,
    removeRoot,
    refreshFolder,
    createFile,
    deleteFile,
    renameFile,
    scratches,
    createScratch,
    renameScratch,
    saveScratchContent,
    deleteScratchEntry,
  };
}
