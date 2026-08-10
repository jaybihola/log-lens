import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/client.js', () => ({
  api: {
    listTabs: vi.fn(), createFileTab: vi.fn(), openFile: vi.fn(), activateTab: vi.fn(),
    history: vi.fn(), clearTab: vi.fn(), closeTab: vi.fn(),
    createApiTab: vi.fn(), queryTab: vi.fn(), fetchTab: vi.fn(),
  },
}));
vi.mock('./useLiveEvents.js', () => ({ useLiveEvents: vi.fn() }));

const { api } = await import('../api/client.js');
const { useLiveEvents } = await import('./useLiveEvents.js');
const { useTabs } = await import('./useTabs.js');

function liveHandlers() {
  return useLiveEvents.mock.calls[useLiveEvents.mock.calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listTabs.mockResolvedValue({ tabs: [], activeTabId: null });
  api.history.mockResolvedValue({ lines: [], file: null, status: 'idle', kind: 'file' });
});

describe('useTabs — boot', () => {
  it('starts empty when the server has no tabs', async () => {
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.tabMetaList).toEqual([]));
    expect(result.current.activeTabId).toBeNull();
  });

  it('loads history for every tab and activates the server-reported active tab', async () => {
    api.listTabs.mockResolvedValue({
      tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }, { id: '2', kind: 'file', file: '/b', status: 'watching' }],
      activeTabId: '2',
    });
    api.history.mockImplementation((id) => Promise.resolve({ lines: [{ seq: 1, text: `line-${id}` }], file: null, status: 'watching', kind: 'file' }));
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('2'));
    expect(result.current.activeBuffer).toEqual([{ seq: 1, text: 'line-2' }]);
  });

  it('falls back to the first tab when the server has no active tab set', async () => {
    api.listTabs.mockResolvedValue({ tabs: [{ id: '1', kind: 'file', file: '/a', status: 'idle' }], activeTabId: null });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));
  });
});

describe('useTabs — live line/status events', () => {
  async function bootedWithOneTab() {
    api.listTabs.mockResolvedValue({ tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }], activeTabId: '1' });
    const hook = renderHook(() => useTabs());
    await waitFor(() => expect(hook.result.current.activeTabId).toBe('1'));
    return hook;
  }

  it('appends a line for the active tab to its buffer', async () => {
    const { result } = await bootedWithOneTab();
    act(() => liveHandlers().onLine({ tabId: '1', seq: 1, text: 'hello' }));
    await waitFor(() => expect(result.current.activeBuffer).toEqual([{ seq: 1, text: 'hello' }]));
  });

  it('ignores a duplicate/stale line (seq <= last buffered seq)', async () => {
    const { result } = await bootedWithOneTab();
    act(() => liveHandlers().onLine({ tabId: '1', seq: 5, text: 'a' }));
    await waitFor(() => expect(result.current.activeBuffer).toHaveLength(1));
    act(() => liveHandlers().onLine({ tabId: '1', seq: 5, text: 'dup' }));
    act(() => liveHandlers().onLine({ tabId: '1', seq: 3, text: 'older' }));
    // Give any (incorrect) scheduled render a chance to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.activeBuffer).toHaveLength(1);
  });

  it('increments attentionCounts for an error/warn line on a background tab, not the active one', async () => {
    api.listTabs.mockResolvedValue({
      tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }, { id: '2', kind: 'file', file: '/b', status: 'watching' }],
      activeTabId: '1',
    });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));

    act(() => liveHandlers().onLine({ tabId: '2', seq: 1, text: 'a fatal error occurred' }));
    await waitFor(() => expect(result.current.attentionCounts['2']).toBe(1));

    act(() => liveHandlers().onLine({ tabId: '1', seq: 1, text: 'a fatal error occurred' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.attentionCounts['1']).toBeUndefined();
  });

  it('does not flag attention for a background line at an ordinary level', async () => {
    api.listTabs.mockResolvedValue({
      tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }, { id: '2', kind: 'file', file: '/b', status: 'watching' }],
      activeTabId: '1',
    });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));
    act(() => liveHandlers().onLine({ tabId: '2', seq: 1, text: 'all good here' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.attentionCounts['2']).toBeUndefined();
  });

  it('activateTab clears that tab\'s attention count and calls the server', async () => {
    api.listTabs.mockResolvedValue({
      tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }, { id: '2', kind: 'file', file: '/b', status: 'watching' }],
      activeTabId: '1',
    });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));
    act(() => liveHandlers().onLine({ tabId: '2', seq: 1, text: 'fatal error' }));
    await waitFor(() => expect(result.current.attentionCounts['2']).toBe(1));

    await act(async () => { await result.current.activateTab('2'); });
    expect(result.current.attentionCounts['2']).toBeUndefined();
    expect(api.activateTab).toHaveBeenCalledWith('2');
  });

  it('handleStatus updates the matching tab\'s status/file in tabMetaList', async () => {
    const { result } = await bootedWithOneTab();
    act(() => liveHandlers().onStatus({ tabId: '1', status: 'missing', file: '/a', fetchError: null }));
    expect(result.current.tabMetaList.find((t) => t.id === '1').status).toBe('missing');
  });
});

describe('useTabs — tab actions', () => {
  it('openNewTab creates a tab via the API and activates it', async () => {
    api.listTabs.mockResolvedValue({ tabs: [], activeTabId: null });
    api.createFileTab.mockResolvedValue({ id: 'new', kind: 'file', file: '/x', status: 'waiting' });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBeNull());
    await act(async () => { await result.current.openNewTab('/x'); });
    expect(result.current.activeTabId).toBe('new');
    expect(result.current.tabMetaList).toEqual([{ id: 'new', kind: 'file', file: '/x', status: 'waiting' }]);
  });

  it('closeTab asks the server, then re-syncs active tab from its response', async () => {
    api.listTabs.mockResolvedValue({
      tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }, { id: '2', kind: 'file', file: '/b', status: 'watching' }],
      activeTabId: '1',
    });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));

    api.closeTab.mockResolvedValue({ ok: true });
    api.listTabs.mockResolvedValue({ tabs: [{ id: '2', kind: 'file', file: '/b', status: 'watching' }], activeTabId: '2' });
    await act(async () => { await result.current.closeTab('1'); });
    expect(result.current.activeTabId).toBe('2');
    expect(result.current.tabMetaList).toEqual([{ id: '2', kind: 'file', file: '/b', status: 'watching' }]);
  });

  it('clearActiveTab empties the active buffer without calling the server', async () => {
    api.listTabs.mockResolvedValue({ tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }], activeTabId: '1' });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));
    act(() => liveHandlers().onLine({ tabId: '1', seq: 1, text: 'hello' }));
    await waitFor(() => expect(result.current.activeBuffer).toHaveLength(1));
    // clearActiveTab is an async function (even though its body never
    // actually awaits anything), so act() needs to be awaited itself — but
    // its real re-render is still rAF-scheduled on top of that, so the
    // final assertion also needs its own waitFor.
    await act(async () => { await result.current.clearActiveTab(); });
    await waitFor(() => expect(result.current.activeBuffer).toEqual([]));
  });

  it('handleBootChanged clears history-loaded state and reloads tabs from scratch', async () => {
    api.listTabs.mockResolvedValue({ tabs: [{ id: '1', kind: 'file', file: '/a', status: 'watching' }], activeTabId: '1' });
    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(result.current.activeTabId).toBe('1'));
    act(() => liveHandlers().onLine({ tabId: '1', seq: 1, text: 'before restart' }));
    await waitFor(() => expect(result.current.activeBuffer).toHaveLength(1));

    api.history.mockResolvedValue({ lines: [{ seq: 1, text: 'after restart' }], file: null, status: 'watching', kind: 'file' });
    await act(async () => { await liveHandlers().onBootChanged(); });
    await waitFor(() => expect(result.current.activeBuffer).toEqual([{ seq: 1, text: 'after restart' }]));
  });
});
