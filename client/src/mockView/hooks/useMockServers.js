import { useCallback, useEffect, useRef, useState } from 'react';
import { mockViewApi } from '../api/mockViewClient.js';

const TRAFFIC_POLL_MS = 1500;

// Server configs are server-synced like useMockCollections (refetch-whole-
// list after each mutation — same "small dataset, not worth surgical
// patching" reasoning). Traffic for the currently-selected server is polled
// on an interval, not pushed via SSE like Log Lens's own tail — a mock
// server's hit volume is low enough in a dev workflow that a second
// streaming transport isn't worth it here; the effect only runs while a
// server id is actually selected, so nothing polls when this screen isn't
// even open.
export function useMockServers(selectedServerId) {
  const [servers, setServers] = useState([]);
  const [ready, setReady] = useState(false);
  const [traffic, setTraffic] = useState([]);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    const { servers: next } = await mockViewApi.listMockServers();
    setServers(next);
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    if (!selectedServerId) { setTraffic([]); return undefined; }
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await mockViewApi.mockServerTraffic(selectedServerId);
        if (!cancelled) setTraffic(data.hits);
      } catch { /* transient — next poll retries */ }
    };
    poll();
    pollRef.current = setInterval(poll, TRAFFIC_POLL_MS);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, [selectedServerId]);

  const createServer = useCallback(async (name, port) => { const s = await mockViewApi.createMockServer(name, port); await refresh(); return s; }, [refresh]);
  const updateServer = useCallback(async (id, patch) => { await mockViewApi.updateMockServer(id, patch); await refresh(); }, [refresh]);
  const deleteServer = useCallback(async (id) => { await mockViewApi.deleteMockServer(id); await refresh(); }, [refresh]);

  const createRoute = useCallback(async (serverId, fields) => { await mockViewApi.createMockRoute(serverId, fields); await refresh(); }, [refresh]);
  const updateRoute = useCallback(async (serverId, routeId, patch) => { await mockViewApi.updateMockRoute(serverId, routeId, patch); await refresh(); }, [refresh]);
  const deleteRoute = useCallback(async (serverId, routeId) => { await mockViewApi.deleteMockRoute(serverId, routeId); await refresh(); }, [refresh]);

  const start = useCallback(async (id) => {
    const result = await mockViewApi.startMockServer(id);
    await refresh();
    return result;
  }, [refresh]);
  const stop = useCallback(async (id) => { await mockViewApi.stopMockServer(id); await refresh(); }, [refresh]);

  return { ready, servers, traffic, createServer, updateServer, deleteServer, createRoute, updateRoute, deleteRoute, start, stop };
}
