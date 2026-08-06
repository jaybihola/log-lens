// Turns a flat list of dot-path items ("user.address.city") into a nested
// tree — shared by the log viewer's fields sidebar and (per its reusability
// requirement) JSON Lens. `getPath` extracts the path string from whatever
// shape the caller's items are; the item itself is kept on its leaf node
// unchanged, so callers can render it however they need.
//
// A path can be both an intermediate segment AND a leaf in its own right
// (e.g. both "event" and "event.type" exist as real fields) — such a node
// keeps `children` and also carries `isLeaf`/`item`, so callers can decide
// how to present that edge case rather than losing the data.

// Single source of truth for per-depth indent — was a "14" duplicated
// independently in FieldTree.jsx (folder rows) and each of its two callers'
// own leaf-row renderers (FieldsSidebar.jsx, JsonFileSidebar.jsx). Bumped
// from 14 to 18px: at the old value, three or four nested levels of a real
// JSON folder tree compressed close enough together to be hard to tell
// apart at a glance.
export const TREE_INDENT_BASE = 8;
export const TREE_INDENT_STEP = 18;
export function treeIndent(depth) {
  return TREE_INDENT_BASE + depth * TREE_INDENT_STEP;
}

export function buildFieldTree(items, getPath = (item) => item.path) {
  const root = new Map();

  for (const item of items) {
    const path = getPath(item);
    if (!path) continue;
    const segments = path.split('.');
    let level = root;
    let acc = '';
    let node;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      acc = acc ? `${acc}.${seg}` : seg;
      if (!level.has(seg)) {
        level.set(seg, { segment: seg, path: acc, childMap: new Map(), children: [], isLeaf: false, item: null });
      }
      node = level.get(seg);
      if (i === segments.length - 1) {
        node.isLeaf = true;
        node.item = item;
      }
      level = node.childMap;
    }
  }

  return finalize(root);
}

// Folders before leaves, alphabetical within each — the usual file-tree
// convention.
function finalize(map) {
  const arr = [...map.values()];
  arr.sort((a, b) => {
    const aFolder = a.childMap.size > 0;
    const bFolder = b.childMap.size > 0;
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.segment.localeCompare(b.segment);
  });
  for (const node of arr) {
    node.children = finalize(node.childMap);
    delete node.childMap;
  }
  return arr;
}

// Keeps a node if its own segment/path matches, or any descendant does —
// same "keep ancestors of a match" shape as the JSON field filter's
// pruning, so a search reveals matches without orphaning them.
export function filterFieldTree(nodes, query) {
  const q = query.toLowerCase();
  const out = [];
  for (const node of nodes) {
    const selfMatches = node.path.toLowerCase().includes(q);
    const filteredChildren = node.children.length ? filterFieldTree(node.children, q) : [];
    if (selfMatches || filteredChildren.length) {
      out.push({ ...node, children: selfMatches ? node.children : filteredChildren });
    }
  }
  return out;
}

// Every folder path in a tree — used to auto-expand everything while a
// search is active, so matches are never hidden behind a collapsed branch
// (and by the sidebar's own "expand all").
export function collectFolderPaths(nodes, out = new Set()) {
  for (const node of nodes) {
    if (node.children.length) {
      out.add(node.path);
      collectFolderPaths(node.children, out);
    }
  }
  return out;
}

// The flat-list alternative to buildFieldTree — every item as its own
// top-level "leaf" node with no hierarchy, segment set to the full path
// (since there's no nesting to abbreviate against). Lets FieldTree render
// either shape through the same renderLeaf without the caller needing two
// separate code paths.
export function buildFlatList(items, getPath = (item) => item.path) {
  return items
    .map((item) => {
      const path = getPath(item);
      return { segment: path, path, children: [], isLeaf: true, item };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
