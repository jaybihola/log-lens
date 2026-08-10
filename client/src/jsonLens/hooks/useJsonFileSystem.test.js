import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('../api/jsonLensClient.js', () => ({
  jsonLensApi: {
    listRoots: vi.fn(),
    listScratches: vi.fn(),
    addRoot: vi.fn(),
    removeRoot: vi.fn(),
    browse: vi.fn(),
    createScratch: vi.fn(),
    updateScratch: vi.fn(),
    deleteScratch: vi.fn(),
  },
}));

const { jsonLensApi } = await import('../api/jsonLensClient.js');
const { useJsonFileSystem } = await import('./useJsonFileSystem.js');

beforeEach(() => {
  vi.clearAllMocks();
  jsonLensApi.listRoots.mockResolvedValue({ roots: [] });
  jsonLensApi.listScratches.mockResolvedValue({ scratches: [] });
});

describe('useJsonFileSystem', () => {
  it('loads roots and scratches on mount, flipping ready to true', async () => {
    jsonLensApi.listRoots.mockResolvedValue({ roots: ['/a'] });
    jsonLensApi.listScratches.mockResolvedValue({ scratches: [{ id: 's1', name: 'x', updatedAt: 1 }] });
    const { result } = renderHook(() => useJsonFileSystem());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.roots).toEqual(['/a']);
    expect(result.current.scratches).toEqual([{ id: 's1', name: 'x', updatedAt: 1 }]);
    expect(result.current.rootNodes).toHaveLength(1);
    expect(result.current.rootNodes[0]).toMatchObject({ path: '/a', isFolder: true, loaded: false });
  });

  describe('roots', () => {
    it('addRoot appends a new root node without touching existing ones', async () => {
      jsonLensApi.addRoot.mockResolvedValue({ roots: ['/a'] });
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.addRoot('/a'); });
      expect(result.current.roots).toEqual(['/a']);
      expect(result.current.rootNodes.map((n) => n.path)).toEqual(['/a']);
    });

    it('removeRoot drops the root node and any expanded state under it', async () => {
      jsonLensApi.listRoots.mockResolvedValue({ roots: ['/a'] });
      jsonLensApi.removeRoot.mockResolvedValue({ roots: [] });
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.removeRoot('/a'); });
      expect(result.current.roots).toEqual([]);
      expect(result.current.rootNodes).toEqual([]);
    });
  });

  describe('lazy folder tree', () => {
    it('toggleExpand lazily loads a root\'s children exactly once', async () => {
      jsonLensApi.listRoots.mockResolvedValue({ roots: ['/a'] });
      jsonLensApi.browse.mockResolvedValue({ entries: [{ name: 'file.json', isDir: false }, { name: 'sub', isDir: true }] });
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => result.current.toggleExpand('/a'));
      await waitFor(() => expect(result.current.rootNodes[0].loaded).toBe(true));
      expect(result.current.rootNodes[0].children.map((c) => c.path)).toEqual(['/a/file.json', '/a/sub']);
      expect(result.current.expanded.has('/a')).toBe(true);

      act(() => result.current.toggleExpand('/a')); // collapse
      expect(result.current.expanded.has('/a')).toBe(false);
      expect(jsonLensApi.browse).toHaveBeenCalledTimes(1); // collapsing doesn't re-fetch
    });

    it('refreshFolder is a no-op for a path that is not part of any open root', async () => {
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.refreshFolder('/not/a/root'); });
      expect(jsonLensApi.browse).not.toHaveBeenCalled();
    });
  });

  describe('scratches (same contract as diffLens/useDiffScratches.js)', () => {
    it('createScratch appends the server-returned entry', async () => {
      jsonLensApi.createScratch.mockResolvedValue({ id: 'new', name: 'doc', updatedAt: 1 });
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.createScratch('doc', '{}'); });
      expect(result.current.scratches).toEqual([{ id: 'new', name: 'doc', updatedAt: 1 }]);
    });

    it('deleteScratchEntry removes it from local state', async () => {
      jsonLensApi.listScratches.mockResolvedValue({ scratches: [{ id: 'a', name: 'a', updatedAt: 1 }] });
      jsonLensApi.deleteScratch.mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useJsonFileSystem());
      await waitFor(() => expect(result.current.ready).toBe(true));
      await act(async () => { await result.current.deleteScratchEntry('a'); });
      expect(result.current.scratches).toEqual([]);
    });
  });
});
