import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiffTabs, isTabDirty } from './useDiffTabs.js';

beforeEach(() => localStorage.clear());

describe('useDiffTabs', () => {
  it('starts with no tabs', () => {
    const { result } = renderHook(() => useDiffTabs());
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBeNull();
  });

  it('addTab creates a tab with default fields and activates it', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const tab = result.current.activeTab;
    expect(tab).toMatchObject({
      leftText: '', rightText: '', language: 'plaintext', viewMode: 'side-by-side', origin: 'new', scratchId: null,
    });
    expect(result.current.activeTabId).toBe(tab.id);
  });

  it('setLeftText/setRightText update independently and mark the tab dirty', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setLeftText(id, 'left'));
    act(() => result.current.setRightText(id, 'right'));
    expect(result.current.activeTab.leftText).toBe('left');
    expect(result.current.activeTab.rightText).toBe('right');
    expect(isTabDirty(result.current.activeTab)).toBe(true);
  });

  it('setLanguage and setViewMode update their own fields only', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setLanguage(id, 'javascript'));
    act(() => result.current.setViewMode(id, 'unified'));
    expect(result.current.activeTab.language).toBe('javascript');
    expect(result.current.activeTab.viewMode).toBe('unified');
  });

  it('setOption toggles a single ignore-option without touching the others', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setOption(id, 'ignoreCase', true));
    expect(result.current.activeTab.options).toEqual({
      ignoreWhitespace: false, ignoreCase: true, ignoreBlankLines: false, ignoreLineEndings: false,
    });
  });

  it('swapSides exchanges leftText and rightText', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setLeftText(id, 'L'));
    act(() => result.current.setRightText(id, 'R'));
    act(() => result.current.swapSides(id));
    expect(result.current.activeTab.leftText).toBe('R');
    expect(result.current.activeTab.rightText).toBe('L');
  });

  it('clearTab empties both sides, leaving language/options untouched', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setLeftText(id, 'L'));
    act(() => result.current.setRightText(id, 'R'));
    act(() => result.current.setLanguage(id, 'python'));
    act(() => result.current.clearTab(id));
    expect(result.current.activeTab.leftText).toBe('');
    expect(result.current.activeTab.rightText).toBe('');
    expect(result.current.activeTab.language).toBe('python');
  });

  it('duplicateTab copies every comparison field as a fresh unsaved draft', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const id = result.current.activeTab.id;
    act(() => result.current.setLeftText(id, 'L'));
    act(() => result.current.setOption(id, 'ignoreCase', true));
    act(() => result.current.duplicateTab(id));
    expect(result.current.tabs).toHaveLength(2);
    const copy = result.current.tabs[1];
    expect(copy.leftText).toBe('L');
    expect(copy.options.ignoreCase).toBe(true);
    expect(copy.origin).toBe('new');
    expect(copy.name).toBe(`${result.current.tabs[0].name} copy`);
  });

  describe('isTabDirty / markSaved / revertTab (multi-field snapshot, unlike JSON Lens\'s single savedContent)', () => {
    it('is dirty when leftText/rightText/language/options differ from the saved snapshot', () => {
      const { result } = renderHook(() => useDiffTabs());
      act(() => result.current.addTab());
      const id = result.current.activeTab.id;
      expect(isTabDirty(result.current.activeTab)).toBe(false); // fresh tab matches its own blank snapshot
      act(() => result.current.setLeftText(id, 'L'));
      expect(isTabDirty(result.current.activeTab)).toBe(true);
    });

    it('is dirty on an options-only change, not just text', () => {
      const { result } = renderHook(() => useDiffTabs());
      act(() => result.current.addTab());
      const id = result.current.activeTab.id;
      act(() => result.current.markSaved(id, {}));
      act(() => result.current.setOption(id, 'ignoreWhitespace', true));
      expect(isTabDirty(result.current.activeTab)).toBe(true);
    });

    it('markSaved snapshots the tab\'s current fields, clearing dirty state', () => {
      const { result } = renderHook(() => useDiffTabs());
      act(() => result.current.addTab());
      const id = result.current.activeTab.id;
      act(() => result.current.setLeftText(id, 'L'));
      act(() => result.current.setRightText(id, 'R'));
      act(() => result.current.markSaved(id, { origin: 'scratch', scratchId: 'dscr-1' }));
      expect(isTabDirty(result.current.activeTab)).toBe(false);
      expect(result.current.activeTab.origin).toBe('scratch');
      expect(result.current.activeTab.scratchId).toBe('dscr-1');
    });

    it('revertTab restores leftText/rightText/language/options from the snapshot', () => {
      const { result } = renderHook(() => useDiffTabs());
      act(() => result.current.addTab());
      const id = result.current.activeTab.id;
      act(() => result.current.setLeftText(id, 'original'));
      act(() => result.current.markSaved(id, {}));
      act(() => result.current.setLeftText(id, 'edited'));
      act(() => result.current.setOption(id, 'ignoreCase', true));
      act(() => result.current.revertTab(id));
      expect(result.current.activeTab.leftText).toBe('original');
      expect(result.current.activeTab.options.ignoreCase).toBe(false);
    });
  });

  it('openScratchTab creates a scratch-bound tab whose snapshot matches the loaded data', () => {
    const { result } = renderHook(() => useDiffTabs());
    const data = { leftText: 'L', rightText: 'R', language: 'python', options: { ignoreCase: true } };
    act(() => result.current.openScratchTab('dscr-1', 'my diff', data));
    expect(result.current.activeTab).toMatchObject({ leftText: 'L', rightText: 'R', language: 'python', origin: 'scratch', scratchId: 'dscr-1' });
    expect(isTabDirty(result.current.activeTab)).toBe(false);
  });

  it('openScratchTab activates an already-open tab for the same scratch instead of duplicating it', () => {
    const { result } = renderHook(() => useDiffTabs());
    const data = { leftText: 'L', rightText: 'R', language: 'plaintext', options: {} };
    act(() => result.current.openScratchTab('dscr-1', 'name', data));
    const firstId = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.openScratchTab('dscr-1', 'name', data));
    expect(result.current.activeTabId).toBe(firstId);
    expect(result.current.tabs).toHaveLength(2);
  });

  it('closeTab falls back to another tab, closing the last leaves activeTabId null', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const first = result.current.activeTab.id;
    act(() => result.current.addTab());
    const second = result.current.activeTab.id;
    act(() => result.current.closeTab(second));
    expect(result.current.activeTabId).toBe(first);
    act(() => result.current.closeTab(first));
    expect(result.current.activeTabId).toBeNull();
  });

  it('closeOtherTabs / closeTabsToRight behave the same as the JSON Lens tab bar', () => {
    const { result } = renderHook(() => useDiffTabs());
    act(() => result.current.addTab());
    const first = result.current.activeTab.id;
    act(() => result.current.addTab());
    act(() => result.current.addTab());
    act(() => result.current.closeTabsToRight(first));
    expect(result.current.tabs.map((t) => t.id)).toEqual([first]);
  });

  it('persists tabs (including options) to localStorage and restores them on a fresh mount', () => {
    const first = renderHook(() => useDiffTabs());
    act(() => first.result.current.addTab());
    const id = first.result.current.activeTab.id;
    act(() => first.result.current.setLeftText(id, 'L'));
    act(() => first.result.current.setOption(id, 'ignoreLineEndings', true));

    const second = renderHook(() => useDiffTabs());
    expect(second.result.current.tabs).toHaveLength(1);
    expect(second.result.current.tabs[0].leftText).toBe('L');
    expect(second.result.current.tabs[0].options.ignoreLineEndings).toBe(true);
  });
});
