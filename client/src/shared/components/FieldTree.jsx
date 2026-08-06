import { useMemo } from 'react';
import { ChevronRight, Folder, Loader2 } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import { buildFieldTree, buildFlatList, filterFieldTree, collectFolderPaths } from '../render/fieldTree.js';

// A generic, reusable nested-field tree — dot-path items ("user.address.
// city") rendered as a collapsible file-explorer-style tree instead of a
// flat list, so deeply-nested schemas stay legible. Built for the log
// viewer's fields sidebar; kept free of anything sidebar-specific (columns,
// field types, stats popovers) so JSON Lens can reuse it for its own field
// picking with a different `renderLeaf`.
//
// Two ways to feed it a tree:
//  - `items`+`getPath` (the original contract): the whole set is known
//    upfront and small (index field names, JSON keys), so it's fine to
//    eagerly build the full nested structure every time it changes.
//  - `nodes`: a pre-built tree handed in directly, bypassing buildFieldTree
//    entirely. For a real filesystem (JSON Lens's folder tree) the full set
//    is neither known upfront nor safe to eagerly recurse into — folders are
//    fetched lazily on expand — so the caller owns tree construction and
//    just hands this component whatever's been loaded so far.
//
// Only the *segment* is ever shown in a folder row — hovering it reveals
// the full path via this component's own tooltip (to the right, matching
// how leaf rows reveal theirs). Leaf rows are entirely renderLeaf's call,
// including whether/how they show their own full path.
//
// Expand state is controlled by the caller (`expanded`/`onToggleExpand`)
// rather than owned internally, so a parent can offer its own "expand
// all"/"collapse all" across possibly-multiple trees sharing one Set.
export function FieldTree({
  items = [], getPath = (item) => item.path, nodes: nodesProp, searchQuery = '', flat = false,
  expanded, onToggleExpand, renderLeaf, renderFolderAction, renderEmptyFolder, onFolderContextMenu,
  isFolderMenuActive, emptyMessage = 'No matching fields.',
}) {
  const builtTree = useMemo(() => {
    if (nodesProp) return null;
    return flat ? buildFlatList(items, getPath) : buildFieldTree(items, getPath);
  }, [items, getPath, flat, nodesProp]);
  const tree = nodesProp || builtTree || [];

  const query = searchQuery.trim();
  const filtered = useMemo(() => {
    if (!query) return tree;
    return flat && !nodesProp ? tree.filter((n) => n.path.toLowerCase().includes(query.toLowerCase())) : filterFieldTree(tree, query);
  }, [tree, query, flat, nodesProp]);
  // While searching, every folder that survived filtering necessarily leads
  // to a match — expand all of them so results aren't hidden behind a
  // collapsed branch, regardless of the caller's own expand state.
  const searchExpanded = useMemo(() => (query && !flat ? collectFolderPaths(filtered) : null), [filtered, query, flat]);
  const effectiveExpanded = searchExpanded || expanded;

  if (filtered.length === 0) return <p className="picker-empty">{emptyMessage}</p>;

  return (
    <div className="field-tree">
      <FieldTreeLevel
        nodes={filtered}
        depth={0}
        expanded={effectiveExpanded}
        onToggleExpand={onToggleExpand}
        renderLeaf={renderLeaf}
        renderFolderAction={renderFolderAction}
        renderEmptyFolder={renderEmptyFolder}
        onFolderContextMenu={onFolderContextMenu}
        isFolderMenuActive={isFolderMenuActive}
      />
    </div>
  );
}

function FieldTreeLevel({ nodes, depth, expanded, onToggleExpand, renderLeaf, renderFolderAction, renderEmptyFolder, onFolderContextMenu, isFolderMenuActive }) {
  return nodes.map((node) => (
    <FieldTreeRow
      key={node.path}
      node={node}
      depth={depth}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      renderLeaf={renderLeaf}
      renderFolderAction={renderFolderAction}
      renderEmptyFolder={renderEmptyFolder}
      onFolderContextMenu={onFolderContextMenu}
      isFolderMenuActive={isFolderMenuActive}
    />
  ));
}

function FieldTreeRow({ node, depth, expanded, onToggleExpand, renderLeaf, renderFolderAction, renderEmptyFolder, onFolderContextMenu, isFolderMenuActive }) {
  // node.isFolder, when explicitly set, wins outright — a lazily-loaded
  // directory can be genuinely empty (children.length === 0) and still be a
  // folder, which the children.length heuristic alone can't tell apart from
  // a leaf. Callers that never set it (the original items/getPath contract,
  // where a childless node really is a leaf) get the old behavior unchanged.
  const isFolder = typeof node.isFolder === 'boolean' ? node.isFolder : node.children.length > 0;

  if (!isFolder) {
    // A pure leaf owns its own row entirely — renderLeaf decides what
    // hover/click behavior it gets (e.g. the sidebar's value-stats popover).
    return renderLeaf(node, depth);
  }

  const isExpanded = expanded.has(node.path);
  return (
    <div className="field-tree-branch">
      <Tooltip label={node.path} placement="right">
        <div
          className={isFolderMenuActive?.(node) ? 'field-tree-folder-row menu-target' : 'field-tree-folder-row'}
          onContextMenu={onFolderContextMenu ? (e) => onFolderContextMenu(e, node) : undefined}
        >
          <button
            type="button"
            className="field-tree-folder"
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => onToggleExpand(node.path)}
          >
            <ChevronRight size={13} strokeWidth={2} className={isExpanded ? 'field-tree-chevron expanded' : 'field-tree-chevron'} />
            {node.loading
              ? <Loader2 size={13} strokeWidth={2} className="field-tree-folder-icon spin" />
              : <Folder size={13} strokeWidth={1.75} className="field-tree-folder-icon" />}
            <span className="field-tree-label">{node.segment}</span>
          </button>
          {renderFolderAction && renderFolderAction(node, depth)}
        </div>
      </Tooltip>
      {isExpanded && (
        node.children.length > 0
          ? (
            <FieldTreeLevel
              nodes={node.children}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              renderLeaf={renderLeaf}
              renderFolderAction={renderFolderAction}
              renderEmptyFolder={renderEmptyFolder}
              onFolderContextMenu={onFolderContextMenu}
              isFolderMenuActive={isFolderMenuActive}
            />
          )
          : (!node.loading && renderEmptyFolder ? renderEmptyFolder(node, depth) : null)
      )}
    </div>
  );
}
