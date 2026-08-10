import { describe, expect, it } from 'vitest';
import { treeIndent, buildFieldTree, filterFieldTree, collectFolderPaths, buildFlatList } from './fieldTree.js';

describe('treeIndent', () => {
  it('scales linearly with depth from the base', () => {
    expect(treeIndent(0)).toBe(8);
    expect(treeIndent(1)).toBe(26);
    expect(treeIndent(2)).toBe(44);
  });
});

describe('buildFieldTree', () => {
  it('nests dot-path items into a tree', () => {
    const tree = buildFieldTree([{ path: 'user.address.city' }, { path: 'user.name' }]);
    expect(tree).toHaveLength(1);
    const user = tree[0];
    expect(user.segment).toBe('user');
    expect(user.isLeaf).toBe(false);
    const childSegments = user.children.map((c) => c.segment).sort();
    expect(childSegments).toEqual(['address', 'name']);
  });

  it('sorts folders before leaves, alphabetically within each group', () => {
    const tree = buildFieldTree([{ path: 'z' }, { path: 'a.b' }, { path: 'm' }]);
    expect(tree.map((n) => n.segment)).toEqual(['a', 'm', 'z']);
  });

  it('marks a node as both an intermediate segment and a leaf when both exist', () => {
    const tree = buildFieldTree([{ path: 'event' }, { path: 'event.type' }]);
    const event = tree.find((n) => n.segment === 'event');
    expect(event.isLeaf).toBe(true);
    expect(event.item).toEqual({ path: 'event' });
    expect(event.children).toHaveLength(1);
  });

  it('skips items with no path', () => {
    const tree = buildFieldTree([{ path: '' }, { path: null }, { path: 'a' }]);
    expect(tree).toHaveLength(1);
  });

  it('uses a custom getPath function', () => {
    const tree = buildFieldTree([{ keyPath: 'a.b' }], (item) => item.keyPath);
    expect(tree[0].segment).toBe('a');
    expect(tree[0].children[0].segment).toBe('b');
  });

  it('builds correct cumulative paths at each depth', () => {
    const tree = buildFieldTree([{ path: 'a.b.c' }]);
    expect(tree[0].path).toBe('a');
    expect(tree[0].children[0].path).toBe('a.b');
    expect(tree[0].children[0].children[0].path).toBe('a.b.c');
  });

  it('does not leak the internal childMap onto finalized nodes', () => {
    const tree = buildFieldTree([{ path: 'a.b' }]);
    expect(tree[0].childMap).toBeUndefined();
  });
});

describe('filterFieldTree', () => {
  const tree = buildFieldTree([{ path: 'user.address.city' }, { path: 'user.name' }, { path: 'session.id' }]);

  it('keeps a node whose own path matches, case-insensitively', () => {
    const filtered = filterFieldTree(tree, 'SESSION');
    expect(filtered.map((n) => n.segment)).toEqual(['session']);
  });

  it('keeps an ancestor whose descendant matches, without dropping unrelated siblings from that ancestor', () => {
    const filtered = filterFieldTree(tree, 'city');
    const user = filtered.find((n) => n.segment === 'user');
    expect(user).toBeTruthy();
    // "city" only matches inside "address" — "name" should be pruned since
    // it's a sibling that doesn't itself match and has no matching descendant.
    expect(user.children.map((c) => c.segment)).toEqual(['address']);
  });

  it('keeps all children unpruned once an ancestor itself matches', () => {
    const filtered = filterFieldTree(tree, 'user');
    const user = filtered.find((n) => n.segment === 'user');
    expect(user.children.map((c) => c.segment).sort()).toEqual(['address', 'name']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterFieldTree(tree, 'nonexistent')).toEqual([]);
  });
});

describe('collectFolderPaths', () => {
  it('collects every path that has children, not leaf-only paths', () => {
    const tree = buildFieldTree([{ path: 'user.address.city' }, { path: 'session.id' }]);
    const folders = collectFolderPaths(tree);
    expect(folders).toEqual(new Set(['user', 'user.address', 'session']));
  });

  it('returns an empty set for a tree with no nesting', () => {
    const tree = buildFieldTree([{ path: 'a' }, { path: 'b' }]);
    expect(collectFolderPaths(tree).size).toBe(0);
  });
});

describe('buildFlatList', () => {
  it('makes every item its own top-level leaf, sorted by full path', () => {
    const flat = buildFlatList([{ path: 'z' }, { path: 'a.b' }]);
    expect(flat.map((n) => n.path)).toEqual(['a.b', 'z']);
    expect(flat.every((n) => n.isLeaf && n.children.length === 0)).toBe(true);
  });

  it('sets segment to the full path (no abbreviation)', () => {
    const flat = buildFlatList([{ path: 'a.b.c' }]);
    expect(flat[0].segment).toBe('a.b.c');
  });
});
