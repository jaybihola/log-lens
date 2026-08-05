import { useEffect, useRef } from 'react';

// Opens the shared SSE connection and dispatches to whichever tab a pushed
// line/status belongs to. Also watches the server's boot id: a changed id
// means the server process restarted (not just a dropped TCP connection), so
// the caller should reload tabs/buffers from scratch rather than assume
// continuity — this is what lets the browser follow a `--watch` dev restart.
export function useLiveEvents({ onLine, onStatus, onBootChanged }) {
  const bootIdRef = useRef(null);
  const handlersRef = useRef({ onLine, onStatus, onBootChanged });
  handlersRef.current = { onLine, onStatus, onBootChanged };

  useEffect(() => {
    const source = new EventSource('/api/events');

    source.addEventListener('boot', (e) => {
      const { bootId } = JSON.parse(e.data);
      if (bootIdRef.current !== null && bootIdRef.current !== bootId) {
        handlersRef.current.onBootChanged?.();
      }
      bootIdRef.current = bootId;
    });

    source.addEventListener('status', (e) => {
      handlersRef.current.onStatus?.(JSON.parse(e.data));
    });

    source.onmessage = (e) => {
      handlersRef.current.onLine?.(JSON.parse(e.data));
    };

    return () => source.close();
  }, []);
}
