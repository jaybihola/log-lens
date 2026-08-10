import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppMode } from './useAppMode.js';

beforeEach(() => localStorage.clear());

describe('useAppMode', () => {
  it('defaults to "logs" with nothing stored', () => {
    const { result } = renderHook(() => useAppMode());
    expect(result.current.mode).toBe('logs');
  });

  it('setMode accepts any of the three valid modes', () => {
    const { result } = renderHook(() => useAppMode());
    act(() => result.current.setMode('json'));
    expect(result.current.mode).toBe('json');
    act(() => result.current.setMode('diff'));
    expect(result.current.mode).toBe('diff');
    act(() => result.current.setMode('logs'));
    expect(result.current.mode).toBe('logs');
  });

  it('falls back to "logs" for an invalid mode rather than setting garbage', () => {
    const { result } = renderHook(() => useAppMode());
    act(() => result.current.setMode('bogus'));
    expect(result.current.mode).toBe('logs');
  });

  it('persists the mode across a fresh mount', () => {
    const first = renderHook(() => useAppMode());
    act(() => first.result.current.setMode('diff'));
    const second = renderHook(() => useAppMode());
    expect(second.result.current.mode).toBe('diff');
  });

  it('ignores a corrupt/unrecognized stored value and falls back to "logs"', () => {
    localStorage.setItem('log-lens-app-mode', 'not-a-real-mode');
    const { result } = renderHook(() => useAppMode());
    expect(result.current.mode).toBe('logs');
  });
});
