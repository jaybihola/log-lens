import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('useTheme', () => {
  it('defaults to dark when jsdom has no matchMedia and nothing is stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('respects a previously-saved theme', () => {
    localStorage.setItem('log-lens-theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('ignores a corrupt stored value and falls back to the default', () => {
    localStorage.setItem('log-lens-theme', 'not-a-theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme flips between dark and light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('setTheme sets an explicit value', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
  });

  it('applies the theme as a data-theme attribute on <html>', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the theme choice across a fresh mount', () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.setTheme('light'));
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('light');
  });
});
