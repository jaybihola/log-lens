import { useMemo, useRef, useState } from 'react';
import { Check, Plus, FolderTree, List, UnfoldVertical, FoldVertical } from 'lucide-react';
import { FieldStatsPopover } from './FieldStatsPopover.jsx';
import { SidebarResizeHandle } from '../../shared/components/SidebarResizeHandle.jsx';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { FieldTree } from '../../shared/components/FieldTree.jsx';
import { buildFieldTree, collectFolderPaths } from '../../shared/render/fieldTree.js';

const SHOW_DELAY_MS = 350;
// Grace period before hiding, so moving the cursor from the row to the
// popover (to click a value) doesn't dismiss it mid-transit — the popover
// itself also cancels this on its own mouseenter.
const HIDE_DELAY_MS = 200;

// Kibana-style "available fields" panel for the active tab: the index's
// cached fields (name + type, from useIndexFields), rendered as a nested
// tree (see FieldTree) rather than a flat dotted-name list — much easier to
// scan for a schema more than one or two levels deep, with a flat-list
// fallback for anyone who'd rather just scroll a plain list. Split into
// what's already a column and what isn't, each one-click to toggle as a
// column via the same onToggleColumn used by the field table/expanded-doc
// "+ Column" buttons — a *folder* can be toggled as a column too, which
// pulls in the entire JSON object under that path (getColumnValue already
// JSON.stringifies object values, so this needs no extra plumbing). Hovering
// a leaf row (briefly, to avoid recomputing on every row while scanning the
// list) shows its top-value distribution, computed from the tab's own
// buffer — see FieldStatsPopover; that same popover's title is what reveals
// a leaf's full path, since the tree itself only ever shows the last
// segment (folders reveal theirs via FieldTree's own hover tooltip).
export function FieldsSidebar({ buffer, fields, columns, onToggleColumn, onApplyFilter, width, onResize }) {
  const [search, setSearch] = useState('');
  const [hover, setHover] = useState(null); // { field, top, left } | null
  const [expandedPaths, setExpandedPaths] = useState(() => new Set());
  const [flatView, setFlatView] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const { menu, openMenu, closeMenu, isMenuActive } = useContextMenu();

  const columnSet = useMemo(() => new Set(columns), [columns]);
  const selected = useMemo(() => fields.filter((f) => columnSet.has(f.name)), [fields, columnSet]);
  const available = useMemo(() => fields.filter((f) => !columnSet.has(f.name)), [fields, columnSet]);
  // Computed across *all* fields (not per-section) so "expand all" reveals
  // every folder in both the selected and available trees at once — they
  // share this one expandedPaths set, so expanding "event" in one context
  // expands it in the other too.
  const allFolderPaths = useMemo(() => collectFolderPaths(buildFieldTree(fields, (f) => f.name)), [fields]);

  const toggleExpand = (path) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };
  const expandAll = () => setExpandedPaths(new Set(allFolderPaths));
  const collapseAll = () => setExpandedPaths(new Set());

  const scheduleShow = (fieldName, rect) => {
    if (menu) return; // a context menu is open elsewhere in the list — don't pop up a stats popover for a row you're not even trying to hover
    clearTimeout(hideTimer.current);
    clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setHover({ field: fieldName, top: rect.top, left: rect.right + 8 });
    }, SHOW_DELAY_MS);
  };
  const scheduleHide = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY_MS);
  };
  const cancelHide = () => clearTimeout(hideTimer.current);
  const hideNow = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    setHover(null);
  };

  const handleContextMenu = (e, path, active) => {
    hideNow(); // right-clicking mid-hover shouldn't leave the delayed stats popover to pop up on top of (or right next to) the menu
    openMenu(e, [
      { label: active ? 'Remove column' : 'Add as column', onClick: () => onToggleColumn(path) },
      { label: 'Copy field name', onClick: () => navigator.clipboard.writeText(path) },
      { divider: true },
      { label: 'Filter: field exists', onClick: () => onApplyFilter(path, '*') },
      { label: 'Filter: field is null', onClick: () => onApplyFilter(path, 'null') },
    ], path);
  };

  const renderLeaf = (active) => (node, depth) => {
    const field = node.item;
    return (
      <FieldRow
        key={node.path}
        field={field}
        segment={node.segment}
        depth={depth}
        active={active}
        menuActive={isMenuActive(field.name)}
        onClick={() => onToggleColumn(field.name)}
        onHover={(rect) => scheduleShow(field.name, rect)}
        onUnhover={scheduleHide}
        onContextMenu={(e) => handleContextMenu(e, field.name, active)}
      />
    );
  };

  // A folder can be added as a column too — the whole nested object under
  // it — via a small toggle button next to the expand/collapse control,
  // consistent with a leaf row's own toggle.
  const renderFolderAction = (node) => {
    const active = columnSet.has(node.path);
    return (
      <button
        type="button"
        className={active ? 'field-tree-folder-toggle active' : 'field-tree-folder-toggle'}
        onClick={(e) => { e.stopPropagation(); onToggleColumn(node.path); }}
        onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, node.path, active); }}
      >
        {active ? <Check size={12} strokeWidth={2} /> : <Plus size={12} strokeWidth={2} />}
      </button>
    );
  };

  return (
    <aside className={menu ? 'fields-sidebar menu-open' : 'fields-sidebar'} style={{ flexBasis: width }}>
      <input
        type="text"
        className="fields-sidebar-search"
        placeholder="Search fields…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {fields.length > 0 && (
        <div className="fields-sidebar-controls">
          <Tooltip label={flatView ? 'Tree view' : 'Flat list'} description={flatView ? 'Group nested fields into a collapsible tree.' : 'Show every field as one flat list, ignoring nesting.'}>
            <button type="button" className="icon-btn" onClick={() => setFlatView((v) => !v)}>
              {flatView ? <FolderTree size={14} strokeWidth={1.75} /> : <List size={14} strokeWidth={1.75} />}
            </button>
          </Tooltip>
          <Tooltip label="Expand all" description="Open every folder in the tree.">
            <button type="button" className="icon-btn" onClick={expandAll} disabled={flatView}>
              <UnfoldVertical size={14} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Collapse all" description="Close every folder in the tree.">
            <button type="button" className="icon-btn" onClick={collapseAll} disabled={flatView}>
              <FoldVertical size={14} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      )}
      {fields.length === 0 ? (
        <p className="creds-hint fields-sidebar-empty">
          No cached fields for this tab — open a remote-query tab pointed at an index to browse its fields here.
        </p>
      ) : (
        <div className="fields-sidebar-list">
          {selected.length > 0 && (
            <div className="fields-sidebar-section">
              <label>Selected columns ({selected.length})</label>
              <FieldTree
                items={selected}
                getPath={(f) => f.name}
                searchQuery={search}
                flat
                expanded={expandedPaths}
                onToggleExpand={toggleExpand}
                renderLeaf={renderLeaf(true)}
                renderFolderAction={renderFolderAction}
                onFolderContextMenu={(e, node) => handleContextMenu(e, node.path, columnSet.has(node.path))}
                isFolderMenuActive={(node) => isMenuActive(node.path)}
              />
            </div>
          )}
          <div className="fields-sidebar-section">
            <label>Available fields ({available.length})</label>
            <FieldTree
              items={available}
              getPath={(f) => f.name}
              searchQuery={search}
              flat={flatView}
              expanded={expandedPaths}
              onToggleExpand={toggleExpand}
              renderLeaf={renderLeaf(false)}
              renderFolderAction={renderFolderAction}
              onFolderContextMenu={(e, node) => handleContextMenu(e, node.path, columnSet.has(node.path))}
              isFolderMenuActive={(node) => isMenuActive(node.path)}
            />
          </div>
        </div>
      )}
      {hover && (
        <FieldStatsPopover
          buffer={buffer}
          field={hover.field}
          top={hover.top}
          left={hover.left}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onApply={(field, value) => { onApplyFilter(field, value); hideNow(); }}
        />
      )}
      <SidebarResizeHandle width={width} onChange={onResize} />
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </aside>
  );
}

function FieldRow({ field, segment, depth, active, menuActive, onClick, onHover, onUnhover, onContextMenu }) {
  return (
    <button
      type="button"
      className={[
        'fields-sidebar-row',
        active ? 'active' : '',
        menuActive ? 'menu-target' : '',
      ].filter(Boolean).join(' ')}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={onClick}
      onMouseEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onUnhover}
      onContextMenu={onContextMenu}
    >
      <span className="fields-sidebar-row-name">{segment}</span>
      <span className="fields-sidebar-row-type">{field.type}</span>
      <span className="fields-sidebar-row-toggle">
        {active ? <Check size={12} strokeWidth={2} /> : <Plus size={12} strokeWidth={2} />}
      </span>
    </button>
  );
}
