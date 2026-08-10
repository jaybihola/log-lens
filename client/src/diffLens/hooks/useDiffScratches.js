import { useCallback, useEffect, useState } from 'react';
import { diffLensApi } from '../api/diffLensClient.js';

// The scratch-only subset of JSON Lens's useJsonFileSystem.js (Diff Lens has
// no folder tree to browse — "save this comparison for quick access" is the
// whole feature, per the plan). Scratch metadata ({id, name, updatedAt})
// lives here; the actual leftText/rightText/language/options are only ever
// read/written through diffLensApi directly (DiffFileSidebar's openScratch,
// DiffLensApp's saveTabAsScratch/saveTab) — this hook doesn't cache content.
export function useDiffScratches() {
  const [scratches, setScratches] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { scratches: list } = await diffLensApi.listScratches();
      setScratches(list);
      setReady(true);
    })();
  }, []);

  const createScratch = useCallback(async (name, data) => {
    const entry = await diffLensApi.createScratch(name, data);
    setScratches((prev) => [...prev, entry]);
    return entry;
  }, []);

  const renameScratch = useCallback(async (id, name) => {
    const updated = await diffLensApi.updateScratch(id, { name });
    setScratches((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const saveScratchData = useCallback(async (id, data) => {
    const updated = await diffLensApi.updateScratch(id, data);
    setScratches((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteScratchEntry = useCallback(async (id) => {
    await diffLensApi.deleteScratch(id);
    setScratches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { ready, scratches, createScratch, renameScratch, saveScratchData, deleteScratchEntry };
}
