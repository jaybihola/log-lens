import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pin, Wand2 } from 'lucide-react';
import { api } from '../api/client.js';
import { FoldFilterChips } from './FoldFilterChips.jsx';
import { JsonEditor } from '../../shared/components/JsonEditor.jsx';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { Popover } from '../../shared/components/Popover.jsx';
import { Tooltip } from '../../shared/components/Tooltip.jsx';
import { FilterInput } from './FilterInput.jsx';
import { VisualFilterBuilder } from './VisualFilterBuilder.jsx';
import { RemoteQueryFieldBrowser } from './RemoteQueryFieldBrowser.jsx';
import { RemoteQueryPinForm } from './RemoteQueryPinForm.jsx';
import { RemoteQueryTimeRangeMenu } from './RemoteQueryTimeRangeMenu.jsx';
import { useIndexFields } from '../hooks/useIndexFields.js';
import { useRemoteQueryPresets } from '../hooks/useRemoteQueryPresets.js';
import { useTimeRangeUsage } from '../hooks/useTimeRangeUsage.js';
import { buildSimpleMatcher } from '../filter/simpleJql.js';
import { shortMinutesLabel } from '../filter/timeRanges.js';

// The visual filter builder wants a buffer of loaded docs to compute
// value-suggestion stats from (see computeFieldStats) — this modal creates a
// tab, it doesn't have one yet. A stable empty array just means no value
// suggestions, not a crash.
const EMPTY_BUFFER = [];

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// `mode`: 'create' (default) makes a new tab via onCreate — used both for a
// plain new query and for "duplicate and modify" (which just seeds
// initialConfig from an existing tab first). 'edit' instead calls onSave
// with the source tab's id, reconfiguring that tab in place — see
// useTabs.updateRemoteTab.
// `initialConfig`, when given: { tabId?, environment, index, dateFrom,
// dateTo, kql, foldValues, rawBody } — an existing tab's queryConfig (plus
// its environment and, for edit mode, its id) to seed the form from instead
// of the usual "first environment, last 1h, blank filter" defaults.
// `activeTab`/`onActiveTabChange`, when both given, put the Build/Raw
// request toggle under the caller's control instead of this component's own
// — TabPickerModal uses this to render that toggle itself, inline in the
// same row as its Local file/Remote query switch (see there for why),
// rather than duplicating it as a second row here. Falls back to owning it
// internally (and rendering its own toggle row) when used standalone —
// RemoteQueryEditModal (Duplicate and modify/Edit) has no sibling row to
// share it with.
export function RemoteQueryBody({
  onCreate, onSave, onClose, initialConfig = null, mode = 'create',
  activeTab: controlledActiveTab, onActiveTabChange,
}) {
  const [environments, setEnvironments] = useState([]);
  const [environment, setEnvironment] = useState('');
  const [index, setIndex] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // null once the user edits the date inputs directly, or when seeded from
  // an existing tab's exact (non-"named quick range") dates.
  const [rangeMinutes, setRangeMinutes] = useState(initialConfig ? null : 60);
  const [kql, setKql] = useState(initialConfig?.kql || '');
  const [filterMode, setFilterMode] = useState('text'); // 'text' | 'visual' — independent of the main tab toolbar's own choice
  const [foldValues, setFoldValues] = useState(initialConfig?.foldValues || {}); // key -> string[]
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const tabsControlledExternally = controlledActiveTab !== undefined;
  const [internalActiveTab, setInternalActiveTab] = useState('build'); // 'build' | 'raw'
  const activeTab = tabsControlledExternally ? controlledActiveTab : internalActiveTab;
  const setActiveTab = tabsControlledExternally ? onActiveTabChange : setInternalActiveTab;

  const filterInputRef = useRef(null);
  const { saved, recent, saveQuery, removeSaved, pushRecent, removeRecent } = useRemoteQueryPresets();
  const { topRanges, recordUse } = useTimeRangeUsage();

  // "Raw request" editor: mirrors the exact body a fetch would send, built
  // live from the form above — until the user edits it directly, at which
  // point it stops following the form and takes priority over every filter
  // above when the tab is created.
  const [rawText, setRawText] = useState(initialConfig?.rawBody ? JSON.stringify(initialConfig.rawBody, null, 2) : '');
  const [rawOverride, setRawOverride] = useState(Boolean(initialConfig?.rawBody));
  const [rawError, setRawError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnvironments(s.environments);
      if (initialConfig?.environment) {
        setEnvironment(initialConfig.environment);
        setIndex(initialConfig.index || '');
      } else if (s.environments.length) {
        setEnvironment(s.environments[0].name);
        setIndex(s.environments[0].indices[0]?.pattern || '');
      }
      setLoaded(true);
    }).catch((e) => { setError(e.message); setLoaded(true); });
    if (initialConfig) {
      // Carries over the tab's exact range rather than a named quick-range
      // (there's no way to know "last 1h" vs. a hand-picked window from a
      // pair of absolute timestamps alone) — applyQuickRange isn't right here.
      if (initialConfig.dateFrom) setDateFrom(toDatetimeLocal(new Date(initialConfig.dateFrom)));
      if (initialConfig.dateTo) setDateTo(toDatetimeLocal(new Date(initialConfig.dateTo)));
    } else {
      applyQuickRange(60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentEnv = environments.find((e) => e.name === environment) || null;
  const currentIndex = currentEnv?.indices.find((i) => i.pattern === index) || null;
  const indexFields = useIndexFields(environment, index);

  // Local-only syntax check (same parser the filter itself runs on) — no
  // network round-trip, just tokenize+parse and see if it throws.
  const filterError = useMemo(() => {
    if (!kql.trim()) return null;
    try {
      buildSimpleMatcher(kql, false);
      return null;
    } catch (e) {
      return e.message;
    }
  }, [kql]);

  function applyQuickRange(minutes) {
    const now = new Date();
    setDateTo(toDatetimeLocal(now));
    setDateFrom(toDatetimeLocal(new Date(now.getTime() - minutes * 60 * 1000)));
    setRangeMinutes(minutes);
  }

  const insertField = (name) => {
    const trimmed = kql.trimEnd();
    const next = trimmed ? `${trimmed} ${name}:` : `${name}:`;
    setKql(next);
    // Plain .focus() leaves the caret wherever the browser defaults it
    // (often the start), which made typing the value right after clicking a
    // field feel backwards — explicitly place it at the end, same as
    // FilterInput's own applySuggestion.
    requestAnimationFrame(() => {
      const el = filterInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
  };

  const currentQueryConfig = () => {
    const resolvedFoldValues = {};
    for (const [key, values] of Object.entries(foldValues)) {
      if (values.length) resolvedFoldValues[key] = values;
    }
    return {
      index,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
      dateTo: dateTo ? new Date(dateTo).toISOString() : null,
      kql,
      foldValues: resolvedFoldValues,
    };
  };

  // Snapshot for saved/recent presets — environment + everything
  // currentQueryConfig doesn't already cover (rangeMinutes, so reapplying
  // re-derives the range relative to "now" instead of replaying stale
  // absolute timestamps).
  const presetConfig = () => ({
    environment,
    index,
    kql,
    foldValues,
    rangeMinutes,
  });

  const applyPreset = (cfg) => {
    if (cfg.environment) setEnvironment(cfg.environment);
    if (cfg.index) setIndex(cfg.index);
    setKql(cfg.kql || '');
    setFoldValues(cfg.foldValues || {});
    if (cfg.rangeMinutes) applyQuickRange(cfg.rangeMinutes);
  };

  // Regenerate the raw-request preview from the form state — skipped once
  // the user has taken over editing it directly.
  useEffect(() => {
    if (rawOverride || !environment) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.queryPreview(environment, currentQueryConfig()).then((res) => {
        if (res.error) { setRawError(res.error); return; }
        setRawError(null);
        setRawText(JSON.stringify(res.body, null, 2));
      }).catch((e) => setRawError(e.message));
    }, 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawOverride, environment, index, dateFrom, dateTo, kql, foldValues]);

  const resetRaw = () => setRawOverride(false);

  const create = async () => {
    setError(null);
    if (!environment) { setError('Pick an environment (configure one in Settings first)'); return; }
    let rawBody = null;
    if (rawOverride) {
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        setError('Raw request is not valid JSON — fix it or click "Reset to generated"');
        return;
      }
    }
    setCreating(true);
    try {
      const queryConfig = { ...currentQueryConfig(), rawBody };
      // onCreate (useTabs' createRemoteTab) / onSave (useTabs'
      // updateRemoteTab) are the single call sites that actually hit the
      // server — don't duplicate that here.
      if (mode === 'edit') await onSave(initialConfig.tabId, environment, queryConfig);
      else await onCreate(environment, queryConfig);
      pushRecent(presetConfig());
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!loaded) return <p>Loading…</p>;

  if (!environments.length) {
    return (
      <>
        <p>No environments configured yet — add one in Remote query settings first.</p>
        <div className="picker-path-row">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </>
    );
  }

  return (
    <div className="remote-query-form">
      {error && <div className="picker-error">{error}</div>}

      {/* Only when nothing external owns it (see the component doc comment
          above) — TabPickerModal renders the equivalent buttons itself,
          inline with its Local file/Remote query row, when it's the one in
          control. */}
      {!tabsControlledExternally && (
        <div className="picker-mode-row rq-tabs">
          <button type="button" className={activeTab === 'build' ? 'active' : ''} onClick={() => setActiveTab('build')}>Build</button>
          <button type="button" className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>
            Raw request {rawOverride && <span className="raw-override-badge">edited</span>}
          </button>
        </div>
      )}

      <div className="rq-body">
        {/* Only on Build: it inserts into the KQL filter, which the Raw tab
            doesn't even use once rawOverride is set (the raw body wins
            outright) — showing it there would just be a dead control taking
            up width the JSON editor could use instead. The field browser is
            the left column's entire content, full height, top to bottom —
            Environment/Index used to sit in a row spanning above both
            columns, which cut the sidebar off from the top of the modal for
            no real reason; they're query settings, so they now live with
            the rest of the form on the right instead. */}
        {activeTab === 'build' && (
          <RemoteQueryFieldBrowser
            fields={indexFields}
            onInsertField={insertField}
            saved={saved}
            recent={recent}
            onApplyPreset={applyPreset}
            onRemoveSaved={removeSaved}
            onRemoveRecent={removeRecent}
          />
        )}

        <div className="rq-main">
          <div className="rq-main-header">
            <div className="settings-subsection rq-env">
              <label>Environment</label>
              <Dropdown
                value={environment}
                options={environments.map((e) => ({ value: e.name, label: e.name }))}
                onChange={(v) => {
                  setEnvironment(v);
                  const env = environments.find((x) => x.name === v);
                  setIndex(env?.indices[0]?.pattern || '');
                }}
              />
            </div>
            {currentEnv && currentEnv.indices.length > 1 && (
              <div className="settings-subsection rq-index">
                <label>Index</label>
                <Dropdown
                  value={index}
                  options={currentEnv.indices.map((i) => ({ value: i.pattern, label: i.pattern }))}
                  onChange={setIndex}
                />
              </div>
            )}
            {/* Its own column, matching Environment/Index's shape exactly
                (an empty label spacer at the same height as their real
                labels) — without it, centering this icon button against
                those two whole columns (label + dropdown) doesn't actually
                line it up with the dropdowns themselves, only with the
                midpoint of "label + dropdown" combined, which sits visibly
                higher. Just the "pin" step now — the pinned/recent lists
                themselves live in the sidebar (RemoteQueryFieldBrowser),
                matching where the real log-view sidebar keeps pinned lines. */}
            <div className="settings-subsection rq-save-col">
              <label className="rq-save-col-spacer" aria-hidden="true">&nbsp;</label>
              <Popover
                align="right"
                trigger={(toggle, open) => (
                  <Tooltip label="Pin this query" description="Save this query config to the sidebar for quick reuse." disabled={open}>
                    <button type="button" className={open ? 'active icon-btn' : 'icon-btn'} onClick={toggle}>
                      <Pin size={15} strokeWidth={1.75} />
                    </button>
                  </Tooltip>
                )}
              >
                {(close) => (
                  <RemoteQueryPinForm onSave={(name) => saveQuery(name, presetConfig())} onDone={close} />
                )}
              </Popover>
            </div>
          </div>

          {/* Fixed-height modal now (see .remote-query-modal) — this is the
              one scroll region within .rq-main, so the header/tabs above
              stay put and only the tab's own content scrolls if it's long. */}
          <div className="rq-tab-content">
            {activeTab === 'build' ? (
              <>
                <div className="settings-subsection">
                  <label>Time range</label>
                  {/* Two rows (quick-pick, then the absolute pair) rather than
                      one long nowrap row — the datetime inputs alone need
                      ~400px, which used to force this whole modal wider. */}
                  <div className="settings-row rq-time-row">
                    {topRanges.map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={rangeMinutes === m ? 'active rq-time-quick-btn' : 'rq-time-quick-btn'}
                        onClick={() => { applyQuickRange(m); recordUse(m); }}
                      >
                        {shortMinutesLabel(m)}
                      </button>
                    ))}
                    <Popover
                      trigger={(toggle, open) => (
                        <Tooltip label="More time ranges" description="Custom amount/unit, plus the full commonly-used list." disabled={open}>
                          <button type="button" className={open ? 'active icon-btn rq-time-more-btn' : 'icon-btn rq-time-more-btn'} onClick={toggle}>
                            <ChevronDown size={14} strokeWidth={1.75} />
                          </button>
                        </Tooltip>
                      )}
                    >
                      {(close) => (
                        <RemoteQueryTimeRangeMenu
                          activeMinutes={rangeMinutes}
                          onPick={(m) => { applyQuickRange(m); recordUse(m); close(); }}
                        />
                      )}
                    </Popover>
                  </div>
                  <div className="settings-row rq-time-absolute-row">
                    <input type="datetime-local" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setRangeMinutes(null); }} />
                    <span className="rq-time-absolute-sep">→</span>
                    <input type="datetime-local" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setRangeMinutes(null); }} />
                  </div>
                </div>

                <div className="settings-subsection">
                  <div className="settings-row rq-filter-label-row">
                    <label style={{ marginTop: 0 }}>Filter</label>
                    <Tooltip
                      label={filterMode === 'visual' ? 'Switch to text filter' : 'Visual filter builder'}
                      description={filterMode === 'visual' ? 'Edit the raw KQL text instead of the pill builder.' : 'Build the filter with dropdowns and pills instead of typing it.'}
                    >
                      <button type="button" className={filterMode === 'visual' ? 'active icon-btn' : 'icon-btn'} onClick={() => setFilterMode((m) => (m === 'visual' ? 'text' : 'visual'))}>
                        <Wand2 size={14} strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                  </div>
                  {filterMode === 'visual' ? (
                    <VisualFilterBuilder query={kql} onChange={setKql} fields={indexFields} buffer={EMPTY_BUFFER} />
                  ) : (
                    <FilterInput ref={filterInputRef} value={kql} onChange={setKql} fields={indexFields} placeholder='event.type:Fetch and not status:Failed' />
                  )}
                  {filterError && <div className="picker-error rq-filter-error">{filterError}</div>}
                </div>

                {currentIndex?.foldFilters.map((f) => (
                  <FoldFilterChips
                    key={f.key}
                    filter={f}
                    environment={environment}
                    index={index}
                    values={foldValues[f.key] || []}
                    onChange={(values) => setFoldValues((prev) => ({ ...prev, [f.key]: values }))}
                  />
                ))}
              </>
            ) : (
              <div className="rq-raw-wrap">
                <div className="settings-row">
                  <label style={{ marginTop: 0 }}>Raw request {rawOverride && <span className="raw-override-badge">edited — overrides filters above</span>}</label>
                  {rawOverride && <button type="button" onClick={resetRaw}>Reset to generated</button>}
                </div>
                {rawError && !rawOverride && <div className="picker-error">{rawError}</div>}
                <JsonEditor
                  value={rawText}
                  onChange={(val) => { setRawOverride(true); setRawText(val); }}
                  height="100%"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rq-actions">
        <button type="button" onClick={create} disabled={creating}>
          {mode === 'edit' ? (creating ? 'Saving…' : 'Save changes') : (creating ? 'Creating…' : 'Create + fetch')}
        </button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
