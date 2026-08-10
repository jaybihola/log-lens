import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDisplaySettings } from './useDisplaySettings.js';

beforeEach(() => localStorage.clear());

describe('useDisplaySettings', () => {
  it('defaults fontSize=13.5, histogramOpen=true, histogramIntervalMs=null with nothing stored', () => {
    const { result } = renderHook(() => useDisplaySettings());
    expect(result.current.fontSize).toBe(13.5);
    expect(result.current.histogramOpen).toBe(true);
    expect(result.current.histogramIntervalMs).toBeNull();
  });

  it('stepFontSize increments/decrements and clamps to [10, 20]', () => {
    const { result } = renderHook(() => useDisplaySettings());
    act(() => result.current.stepFontSize(-100));
    expect(result.current.fontSize).toBe(10);
    act(() => result.current.stepFontSize(100));
    expect(result.current.fontSize).toBe(20);
  });

  it('toggleHistogram flips histogramOpen', () => {
    const { result } = renderHook(() => useDisplaySettings());
    act(() => result.current.toggleHistogram());
    expect(result.current.histogramOpen).toBe(false);
  });

  it('setHistogramInterval sets an explicit override, or null for auto', () => {
    const { result } = renderHook(() => useDisplaySettings());
    act(() => result.current.setHistogramInterval(60000));
    expect(result.current.histogramIntervalMs).toBe(60000);
    act(() => result.current.setHistogramInterval(null));
    expect(result.current.histogramIntervalMs).toBeNull();
  });

  it('respects an explicit prior histogramOpen:false rather than defaulting it back to true', () => {
    localStorage.setItem('log-lens-display-settings', JSON.stringify({ histogramOpen: false }));
    const { result } = renderHook(() => useDisplaySettings());
    expect(result.current.histogramOpen).toBe(false);
  });

  it('falls back to defaults entirely on corrupt stored JSON', () => {
    localStorage.setItem('log-lens-display-settings', 'not json');
    const { result } = renderHook(() => useDisplaySettings());
    expect(result.current.fontSize).toBe(13.5);
  });

  it('persists across a fresh mount', () => {
    const first = renderHook(() => useDisplaySettings());
    act(() => first.result.current.stepFontSize(1));
    const second = renderHook(() => useDisplaySettings());
    expect(second.result.current.fontSize).toBe(14.5);
  });
});
