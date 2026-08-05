import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { FoldFilterChips } from './FoldFilterChips.jsx';
import { JsonEditor } from './JsonEditor.jsx';

function toDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const QUICK_RANGES = [
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '24h', minutes: 60 * 24 },
  { label: '7d', minutes: 60 * 24 * 7 },
];

export function RemoteQueryBody({ onCreate, onClose }) {
  const [environments, setEnvironments] = useState([]);
  const [environment, setEnvironment] = useState('');
  const [index, setIndex] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [kql, setKql] = useState('');
  const [foldValues, setFoldValues] = useState({}); // key -> string[]
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // "Raw request" editor: mirrors the exact body a fetch would send, built
  // live from the form above — until the user edits it directly, at which
  // point it stops following the form and takes priority over every filter
  // above when the tab is created.
  const [rawText, setRawText] = useState('');
  const [rawOverride, setRawOverride] = useState(false);
  const [rawError, setRawError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnvironments(s.environments);
      if (s.environments.length) {
        setEnvironment(s.environments[0].name);
        setIndex(s.environments[0].indices[0]?.pattern || '');
      }
      setLoaded(true);
    }).catch((e) => { setError(e.message); setLoaded(true); });
    applyQuickRange(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentEnv = environments.find((e) => e.name === environment) || null;
  const currentIndex = currentEnv?.indices.find((i) => i.pattern === index) || null;

  function applyQuickRange(minutes) {
    const now = new Date();
    setDateTo(toDatetimeLocal(now));
    setDateFrom(toDatetimeLocal(new Date(now.getTime() - minutes * 60 * 1000)));
  }

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
      // onCreate (useTabs' createRemoteTab) is the single call site that
      // actually hits POST /api/tabs — don't create it here too.
      await onCreate(environment, queryConfig);
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
    <>
      {error && <div className="picker-error">{error}</div>}
      <div className="settings-subsection">
        <label>Environment</label>
        <select value={environment} onChange={(e) => {
          setEnvironment(e.target.value);
          const env = environments.find((x) => x.name === e.target.value);
          setIndex(env?.indices[0]?.pattern || '');
        }}
        >
          {environments.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
      </div>
      {currentEnv && currentEnv.indices.length > 1 && (
        <div className="settings-subsection">
          <label>Index</label>
          <select value={index} onChange={(e) => setIndex(e.target.value)}>
            {currentEnv.indices.map((i) => <option key={i.pattern} value={i.pattern}>{i.pattern}</option>)}
          </select>
        </div>
      )}
      <div className="settings-subsection">
        <label>Time range</label>
        <div className="settings-row">
          {QUICK_RANGES.map((r) => (
            <button type="button" key={r.label} onClick={() => applyQuickRange(r.minutes)}>{r.label}</button>
          ))}
        </div>
        <div className="settings-row">
          <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      <div className="settings-subsection">
        <label>Filter (KQL-ish: field:value, quoted phrases, and/or/not)</label>
        <input type="text" value={kql} onChange={(e) => setKql(e.target.value)} placeholder='event.type:Fetch and not status:Failed' />
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
      <div className="settings-subsection">
        <div className="settings-row">
          <label style={{ marginTop: 0 }}>Raw request {rawOverride && <span className="raw-override-badge">edited — overrides filters above</span>}</label>
          {rawOverride && <button type="button" onClick={resetRaw}>Reset to generated</button>}
        </div>
        {rawError && !rawOverride && <div className="picker-error">{rawError}</div>}
        <JsonEditor
          value={rawText}
          onChange={(val) => { setRawOverride(true); setRawText(val); }}
        />
      </div>
      <div className="picker-path-row">
        <button type="button" onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create + fetch'}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
