import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useJsonTabs, isTabDirty } from './useJsonTabs.js';

beforeEach(() => localStorage.clear());

describe('useJsonTabs', () => {
  it('starts with no tabs', () => {
    const { result } = renderHook(() => useJsonTabs());
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBeNull();
  });

  it('addTab creates a new tab and activates it', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTab.id).toBe(result.current.tabs[0].id);
    expect(result.current.activeTab.origin).toBe('new');
  });

  it('addTabWithContent seeds content and an optional name', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTabWithContent('{"a":1}', 'seeded'));
    expect(result.current.activeTab.content).toBe('{"a":1}');
    expect(result.current.activeTab.name).toBe('seeded');
  });

  it('setContent updates the active tab and marks it dirty relative to savedContent', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setContent(id, '{"a":1}'));
    expect(isTabDirty(result.current.tabs[0])).toBe(true);
  });

  it('closeTab removes the tab and falls back to another as active', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const first = result.current.activeTab.id;
    act(() => result.current.addTab());
    const second = result.current.activeTab.id;
    act(() => result.current.closeTab(second));
    expect(result.current.tabs.map((t) => t.id)).toEqual([first]);
    expect(result.current.activeTabId).toBe(first);
  });

  it('closing the last tab leaves activeTabId null', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.closeTab(id));
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
  });

  it('duplicateTab copies content and inserts right after the source, as a fresh unsaved draft', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setContent(id, '{"a":1}'));
    act(() => result.current.duplicateTab(id));
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs[1].content).toBe('{"a":1}');
    expect(result.current.tabs[1].origin).toBe('new');
    expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
  });

  it('renameTab updates just the name', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.renameTab(id, 'renamed'));
    expect(result.current.activeTab.name).toBe('renamed');
  });

  it('openFileTab activates an already-open tab for the same file instead of duplicating it', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.openFileTab('/a/b.json', '{}'));
    const firstId = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.openFileTab('/a/b.json', '{}'));
    expect(result.current.tabs.filter((t) => t.filePath === '/a/b.json')).toHaveLength(1);
    expect(result.current.activeTabId).toBe(firstId);
  });

  it('openScratchTab dedups the same scratch the same way', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.openScratchTab('scr-1', 'name', 'content'));
    const firstId = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.openScratchTab('scr-1', 'name', 'content'));
    expect(result.current.activeTabId).toBe(firstId);
    expect(result.current.tabs).toHaveLength(2);
  });

  it('markSaved clears dirty state by setting savedContent to the just-persisted content', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setContent(id, '{"a":1}'));
    expect(isTabDirty(result.current.tabs[0])).toBe(true);
    act(() => result.current.markSaved(id, { origin: 'scratch', scratchId: 'scr-1' }));
    expect(isTabDirty(result.current.tabs[0])).toBe(false);
    expect(result.current.tabs[0].origin).toBe('scratch');
  });

  it('revertTab resets content back to savedContent', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTabWithContent('original'));
    const id = result.current.activeTab.id;
    act(() => result.current.markSaved(id, {}));
    act(() => result.current.setContent(id, 'edited'));
    act(() => result.current.revertTab(id));
    expect(result.current.activeTab.content).toBe('original');
  });

  it('closeOtherTabs keeps only the given tab', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const keep = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.addTab());
    act(() => result.current.closeOtherTabs(keep));
    expect(result.current.tabs.map((t) => t.id)).toEqual([keep]);
  });

  it('closeTabsToRight closes everything after the given tab', () => {
    const { result } = renderHook(() => useJsonTabs());
    act(() => result.current.addTab());
    const first = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.addTab());
    act(() => result.current.closeTabsToRight(first));
    expect(result.current.tabs.map((t) => t.id)).toEqual([first]);
  });

  it('persists tabs to localStorage and restores them on a fresh mount', () => {
    const first = renderHook(() => useJsonTabs());
    act(() => first.result.current.addTabWithContent('{"a":1}', 'persisted'));

    const second = renderHook(() => useJsonTabs());
    expect(second.result.current.tabs).toHaveLength(1);
    expect(second.result.current.tabs[0].content).toBe('{"a":1}');
    expect(second.result.current.tabs[0].name).toBe('persisted');
  });
});

describe('isTabDirty', () => {
  it('is false when content matches savedContent', () => {
    expect(isTabDirty({ content: 'x', savedContent: 'x' })).toBe(false);
  });

  it('is true when content differs from savedContent', () => {
    expect(isTabDirty({ content: 'x', savedContent: 'y' })).toBe(true);
  });
});
