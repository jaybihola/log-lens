import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/diffLensClient.js', () => ({
  diffLensApi: {
    listScratches: vi.fn(),
    createScratch: vi.fn(),
    updateScratch: vi.fn(),
    deleteScratch: vi.fn(),
  },
}));

const { diffLensApi } = await import('../api/diffLensClient.js');
const { useDiffScratches } = await import('./useDiffScratches.js');

beforeEach(() => {
  vi.clearAllMocks();
  diffLensApi.listScratches.mockResolvedValue({ scratches: [] });
});

describe('useDiffScratches', () => {
  it('loads the scratch list on mount and flips ready to true', async () => {
    diffLensApi.listScratches.mockResolvedValue({ scratches: [{ id: 'a', name: 'x', updatedAt: 1 }] });
    const { result } = renderHook(() => useDiffScratches());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.scratches).toEqual([{ id: 'a', name: 'x', updatedAt: 1 }]);
  });

  it('createScratch appends the server-returned entry to local state', async () => {
    diffLensApi.createScratch.mockResolvedValue({ id: 'new-id', name: 'my diff', updatedAt: 123 });
    const { result } = renderHook(() => useDiffScratches());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let entry;
    await act(async () => {
      entry = await result.current.createScratch('my diff', { leftText: 'a', rightText: 'b', language: 'plaintext', options: {} });
    });
    expect(entry).toEqual({ id: 'new-id', name: 'my diff', updatedAt: 123 });
    expect(result.current.scratches).toEqual([{ id: 'new-id', name: 'my diff', updatedAt: 123 }]);
    expect(diffLensApi.createScratch).toHaveBeenCalledWith('my diff', { leftText: 'a', rightText: 'b', language: 'plaintext', options: {} });
  });

  it('renameScratch replaces the entry in local state with the updated one', async () => {
    diffLensApi.listScratches.mockResolvedValue({ scratches: [{ id: 'a', name: 'old', updatedAt: 1 }] });
    diffLensApi.updateScratch.mockResolvedValue({ id: 'a', name: 'new', updatedAt: 2 });
    const { result } = renderHook(() => useDiffScratches());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.renameScratch('a', 'new'); });
    expect(result.current.scratches).toEqual([{ id: 'a', name: 'new', updatedAt: 2 }]);
    expect(diffLensApi.updateScratch).toHaveBeenCalledWith('a', { name: 'new' });
  });

  it('saveScratchData replaces the entry with the server\'s response, leaving other entries untouched', async () => {
    diffLensApi.listScratches.mockResolvedValue({
      scratches: [{ id: 'a', name: 'a', updatedAt: 1 }, { id: 'b', name: 'b', updatedAt: 1 }],
    });
    diffLensApi.updateScratch.mockResolvedValue({ id: 'a', name: 'a', updatedAt: 2 });
    const { result } = renderHook(() => useDiffScratches());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.saveScratchData('a', { leftText: 'x' }); });
    expect(result.current.scratches.find((s) => s.id === 'a').updatedAt).toBe(2);
    expect(result.current.scratches.find((s) => s.id === 'b').updatedAt).toBe(1);
  });

  it('deleteScratchEntry removes the entry from local state', async () => {
    diffLensApi.listScratches.mockResolvedValue({ scratches: [{ id: 'a', name: 'a', updatedAt: 1 }] });
    diffLensApi.deleteScratch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useDiffScratches());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.deleteScratchEntry('a'); });
    expect(result.current.scratches).toEqual([]);
  });
});
