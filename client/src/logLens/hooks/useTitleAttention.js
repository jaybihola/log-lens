import { useEffect, useRef } from 'react';

const BASE_TITLE = document.title;
const FLASH_MS = 1000;

// Flashes the browser tab's title while one or more background Log Lens
// tabs have unseen error/warn lines (see useTabs.js's attentionCounts) —
// purely a live signal, no persistence, and it resets to the base title the
// instant the count drops back to zero (e.g. every flagged tab got
// activated). Not gated on the tool being the visible one — the whole point
// is to notice something while you're looking elsewhere.
export function useTitleAttention(count) {
  const onRef = useRef(false);

  useEffect(() => {
    if (!count) {
      document.title = BASE_TITLE;
      onRef.current = false;
      return undefined;
    }
    const id = setInterval(() => {
      onRef.current = !onRef.current;
      document.title = onRef.current ? `● (${count}) ${BASE_TITLE}` : BASE_TITLE;
    }, FLASH_MS);
    return () => {
      clearInterval(id);
      document.title = BASE_TITLE;
    };
  }, [count]);
}
