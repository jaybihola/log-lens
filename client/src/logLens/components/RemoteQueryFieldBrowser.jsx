import { useMemo, useState } from 'react';
import { ChevronRight, Clock, FolderTree, FoldVertical, List, Pin, Rocket, UnfoldVertical, X } from 'lucide-react';
import { FieldTree, TreeGuides } from '../../shared/components/FieldTree.jsx';
import { buildFieldTree, collectFolderPaths, treeIndent } from '../../shared/render/fieldTree.js';

function describeConfig(cfg) {
  return [cfg.environment, cfg.index, cfg.kql].filter(Boolean).join(' · ');
}

// The remote-query modal's left column — styled and structured to match the
// real log-view FieldsSidebar (search, flat/tree + expand/collapse controls,
// labeled sections) rather than being its own bespoke thing. Where the real
// sidebar has a "Pinned lines" section (see FieldsSidebar.jsx), this one has
// pinned + recent *queries* instead — there's no buffer of log lines here to
// pin, but the same "quick access to what you've marked or just ran" idea
// carries over directly. Clicking a field inserts "name:" into the KQL
// filter (FilterInput's own autocomplete convention); clicking a pinned/
// recent row applies that whole query config.
export function RemoteQueryFieldBrowser({
  fields, onInsertField, saved, recent, onApplyPreset, onRemoveSaved, onRemoveRecent, onLaunchPreset,
}) {
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState(() => new Set());
  const [flatView, setFlatView] = useState(false);
  // Which of the three sections (pinned/recent/fields) are collapsed — all
  // start open; a section with nothing in it is never rendered at all
  // regardless of this, so there's nothing to toggle for an empty one.
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const toggleSection = (key) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  const empty = fields.length === 0 && saved.length === 0 && recent.length === 0;

  return (
    <aside className="fields-sidebar remote-query-fields">
      <input
        type="text"
        className="fields-sidebar-search"
        placeholder="Search fields…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {fields.length > 0 && (
        <div className="fields-sidebar-controls">
          <button type="button" className="icon-btn" onClick={() => setFlatView((v) => !v)} title={flatView ? 'Tree view' : 'Flat list'}>
            {flatView ? <FolderTree size={14} strokeWidth={1.75} /> : <List size={14} strokeWidth={1.75} />}
          </button>
          <button type="button" className="icon-btn" onClick={expandAll} disabled={flatView} title="Expand all">
            <UnfoldVertical size={14} strokeWidth={1.75} />
          </button>
          <button type="button" className="icon-btn" onClick={collapseAll} disabled={flatView} title="Collapse all">
            <FoldVertical size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}
      {empty ? (
        <p className="creds-hint fields-sidebar-empty">
          No cached fields yet — they show up here once this index has been queried at least once.
        </p>
      ) : (
        <div className="fields-sidebar-list">
          {saved.length > 0 && (
            <Section title={`Pinned queries (${saved.length})`} collapsed={collapsedSections.has('pinned')} onToggle={() => toggleSection('pinned')}>
              <div className="fields-sidebar-pinned-list">
                {saved.map((p) => (
                  <PresetRow
                    key={p.name}
                    icon={<Pin size={11} strokeWidth={1.75} className="pinned-row-pin" />}
                    title={p.name}
                    description={describeConfig(p)}
                    onApply={() => onApplyPreset(p)}
                    onLaunch={onLaunchPreset ? () => onLaunchPreset(p) : null}
                    onRemove={() => onRemoveSaved(p.name)}
                  />
                ))}
              </div>
            </Section>
          )}
          {recent.length > 0 && (
            <Section title={`Recent queries (${recent.length})`} collapsed={collapsedSections.has('recent')} onToggle={() => toggleSection('recent')}>
              <div className="fields-sidebar-pinned-list">
                {recent.map((cfg, i) => (
                  <PresetRow
                    key={`${cfg.environment}:${cfg.index}:${i}`}
                    icon={<Clock size={11} strokeWidth={1.75} className="pinned-row-pin" />}
                    title={describeConfig(cfg)}
                    onApply={() => onApplyPreset(cfg)}
                    onLaunch={onLaunchPreset ? () => onLaunchPreset(cfg) : null}
                    onRemove={() => onRemoveRecent(i)}
                  />
                ))}
              </div>
            </Section>
          )}
          {fields.length > 0 && (
            <Section title={`Fields (${fields.length})`} collapsed={collapsedSections.has('fields')} onToggle={() => toggleSection('fields')}>
              <FieldTree
                items={fields}
                getPath={(f) => f.name}
                searchQuery={search}
                flat={flatView}
                expanded={expandedPaths}
                onToggleExpand={toggleExpand}
                emptyMessage="No fields match your search."
                renderLeaf={(node, depth) => (
                  <FieldRow key={node.path} field={node.item} segment={node.segment} depth={depth} onClick={() => onInsertField(node.item.name)} />
                )}
              />
            </Section>
          )}
        </div>
      )}
    </aside>
  );
}

// Each section (Pinned/Recent/Fields) collapses independently — the label
// row is the toggle, chevron rotates the same way a folder row's does
// (.field-tree-chevron, see FieldTree.jsx) for a consistent affordance.
function Section({ title, collapsed, onToggle, children }) {
  return (
    <div className="fields-sidebar-section">
      <button type="button" className="fields-sidebar-section-toggle" onClick={onToggle}>
        <ChevronRight size={12} strokeWidth={2} className={collapsed ? 'field-tree-chevron' : 'field-tree-chevron expanded'} />
        <span>{title}</span>
      </button>
      {!collapsed && children}
    </div>
  );
}

function FieldRow({ field, segment, depth, onClick }) {
  return (
    <button type="button" className="fields-sidebar-row" style={{ paddingLeft: treeIndent(depth) }} onClick={onClick}>
      <TreeGuides depth={depth} />
      <span className="fields-sidebar-row-name">{segment}</span>
      <span className="fields-sidebar-row-type">{field.type}</span>
    </button>
  );
}

// Same shape as FieldsSidebar's own PinnedRow — a div (hosts nested action
// buttons, which a <button> can't) with click-to-apply (repopulate the form
// so it can be reviewed/tweaked before creating anything) and hover-revealed
// launch/remove controls. `onLaunch`, when given, skips the form entirely —
// same query config, straight into a new tab — for whenever you already
// know you just want it running.
function PresetRow({ icon, title, description, onApply, onLaunch, onRemove }) {
  return (
    <div
      className="fields-sidebar-row pinned-row"
      role="button"
      tabIndex={0}
      title={description || title}
      onClick={onApply}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onApply(); }}
    >
      {icon}
      <span className="fields-sidebar-row-name">{title}</span>
      {onLaunch && (
        <button type="button" className="pinned-row-unpin pinned-row-launch" title="Launch as new tab" onClick={(e) => { e.stopPropagation(); onLaunch(); }}>
          <Rocket size={11} strokeWidth={2} />
        </button>
      )}
      <button type="button" className="pinned-row-unpin" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
