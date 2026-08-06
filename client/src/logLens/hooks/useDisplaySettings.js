import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'log-lens-display-settings';
const DEFAULT_FONT_SIZE = 13.5;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 20;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const fontSize = Number(raw.fontSize);
    const intervalMs = Number(raw.histogramIntervalMs);
    return {
      fontSize: Number.isFinite(fontSize) ? fontSize : DEFAULT_FONT_SIZE,
      // Default to visible for a first-time user (no stored value at all),
      // but keep respecting an explicit prior choice either way — only
      // `undefined` (key never written) falls back to the new default.
      histogramOpen: typeof raw.histogramOpen === 'boolean' ? raw.histogramOpen : true,
      // null = auto interval (span-based); a stored number is an explicit override.
      histogramIntervalMs: Number.isFinite(intervalMs) ? intervalMs : null,
    };
  } catch {
    return { fontSize: DEFAULT_FONT_SIZE, histogramOpen: true, histogramIntervalMs: null };
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

  const stepFontSize = useCallback((delta) => {
    setSettings((prev) => ({
      ...prev,
      fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, prev.fontSize + delta)),
    }));
  }, []);

  const toggleHistogram = useCallback(() => {
    setSettings((prev) => ({ ...prev, histogramOpen: !prev.histogramOpen }));
  }, []);

  const setHistogramInterval = useCallback((ms) => {
    setSettings((prev) => ({ ...prev, histogramIntervalMs: ms }));
  }, []);

  return { ...settings, stepFontSize, toggleHistogram, setHistogramInterval };
}
