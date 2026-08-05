import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-display-settings';
const DEFAULT_FONT_SIZE = 13.5;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 20;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const fontSize = Number(raw.fontSize);
    return {
      highlightOnly: !!raw.highlightOnly,
      fontSize: Number.isFinite(fontSize) ? fontSize : DEFAULT_FONT_SIZE,
    };
  } catch {
    return { highlightOnly: false, fontSize: DEFAULT_FONT_SIZE };
  }
}

// App-wide display preferences (not per-tab), persisted in localStorage —
// same precedent as extra columns and filter presets.
export function useDisplaySettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* localStorage unavailable — display-only feature, not fatal */ }
  }, [settings]);

  const toggleHighlightOnly = useCallback(() => {
    setSettings((prev) => ({ ...prev, highlightOnly: !prev.highlightOnly }));
  }, []);

  const stepFontSize = useCallback((delta) => {
    setSettings((prev) => ({
      ...prev,
      fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev.fontSize + delta)),
    }));
  }, []);

  return { ...settings, toggleHighlightOnly, stepFontSize };
}
