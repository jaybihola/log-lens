import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { FoldFilterRow } from './FoldFilterRow.jsx';
import { IndexFieldTypesTable } from './IndexFieldTypesTable.jsx';

function emptyIndex() {
  return { pattern: '', foldFilters: [], fieldTypeOverrides: {} };
}

function emptyEnv() {
  return { name: '', url: '', credentialId: null, indices: [emptyIndex()] };
}

function emptyFoldFilter() {
  return { key: '', label: '', path: '', presetValuesText: '' };
}

// The draft form edits preset values as one comma-separated string
// (matching the reference app's Settings modal); converted to/from the
// server's string[] shape only at load/save time.
function toDraftFoldFilter(f) {
  return { key: f.key, label: f.label, path: f.path, presetValuesText: (f.presetValues || []).join(', ') };
}

export function EnvironmentsPane() {
  const [environments, setEnvironments] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSettings(), api.listCredentials()])
      .then(([s, c]) => {
        const draftEnvs = s.environments.length
          ? s.environments.map((e) => ({
            ...e,
            indices: (e.indices.length ? e.indices : [emptyIndex()]).map((ix) => ({
              ...ix,
              foldFilters: ix.foldFilters.map(toDraftFoldFilter),
              fieldTypeOverrides: ix.fieldTypeOverrides || {},
            })),
          }))
          : [emptyEnv()];
        setEnvironments(draftEnvs);
        setCredentials(c.credentials);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const updateEnv = (i, patch) => {
    setSaved(false);
    setEnvironments((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const updateIndex = (i, j, patch) => {
    setSaved(false);
    setEnvironments((prev) => prev.map((e, idx) => (idx === i
      ? { ...e, indices: e.indices.map((ix, k) => (k === j ? { ...ix, ...patch } : ix)) }
      : e)));
  };
  const addIndex = (i) => updateEnv(i, { indices: [...environments[i].indices, emptyIndex()] });
  const removeIndex = (i, j) => updateEnv(i, { indices: environments[i].indices.filter((_, k) => k !== j) });

  const updateFoldFilter = (i, j, k, patch) => {
    setSaved(false);
    setEnvironments((prev) => prev.map((e, idx) => (idx === i
      ? {
        ...e,
        indices: e.indices.map((ix, jx) => (jx === j
          ? { ...ix, foldFilters: ix.foldFilters.map((f, kx) => (kx === k ? { ...f, ...patch } : f)) }
          : ix)),
      }
      : e)));
  };
  const addFoldFilter = (i, j) => updateIndex(i, j, { foldFilters: [...environments[i].indices[j].foldFilters, emptyFoldFilter()] });
  const removeFoldFilter = (i, j, k) => updateIndex(i, j, { foldFilters: environments[i].indices[j].foldFilters.filter((_, kx) => kx !== k) });

  const changeFieldTypeOverride = (i, j, fieldName, type) => {
    const next = { ...environments[i].indices[j].fieldTypeOverrides };
    if (type) next[fieldName] = type; else delete next[fieldName];
    updateIndex(i, j, { fieldTypeOverrides: next });
  };

  const addEnv = () => { setSaved(false); setEnvironments((prev) => [...prev, emptyEnv()]); };
  const removeEnv = (i) => { setSaved(false); setEnvironments((prev) => prev.filter((_, idx) => idx !== i)); };

  const save = async () => {
    setError(null);
    const payload = {
      environments: environments
        .filter((e) => e.name.trim() && e.url.trim())
        .map((e) => ({
          name: e.name.trim(),
          url: e.url.trim(),
          credentialId: e.credentialId || null,
          indices: e.indices
            .filter((ix) => ix.pattern.trim())
            .map((ix) => ({
              pattern: ix.pattern.trim(),
              foldFilters: ix.foldFilters
                .filter((f) => f.key.trim() && f.path.trim())
                .map((f) => ({
                  key: f.key.trim(),
                  label: f.label.trim(),
                  path: f.path.trim(),
                  presetValues: f.presetValuesText.split(',').map((v) => v.trim()).filter(Boolean),
                })),
              fieldTypeOverrides: ix.fieldTypeOverrides || {},
            })),
        })),
    };
    try {
      await api.saveSettings(payload);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="pref-pane">
      <p className="pref-pane-intro">
        Which remote query environments exist, their index/collection pattern(s), and which fields
        get their own autocompleting "fold filter" chip — configuration, not hardcoded. Fold
        filters are defined per index, since different indices commonly have unrelated schemas.
      </p>
      {error && <div className="picker-error">{error}</div>}
      <div className="settings-env-list">
        {environments.map((env, i) => (
          <div className="settings-env-card" key={i}>
            <div className="settings-env-header">
              <input type="text" placeholder="Environment name (e.g. staging)" value={env.name} onChange={(e) => updateEnv(i, { name: e.target.value })} />
              <button type="button" onClick={() => removeEnv(i)}>Remove</button>
            </div>
            <input type="text" placeholder="Base URL (…/_msearch?pretty)" value={env.url} onChange={(e) => updateEnv(i, { url: e.target.value })} />
            <div className="settings-subsection">
              <label>Credential</label>
              <select value={env.credentialId || ''} onChange={(e) => updateEnv(i, { credentialId: e.target.value || null })}>
                <option value="">— none —</option>
                {credentials.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.username})</option>)}
              </select>
              {credentials.length === 0 && (
                <p className="creds-hint">No credentials yet — add one on the Credentials tab.</p>
              )}
            </div>
            <div className="settings-subsection">
              <label>Indices</label>
              {env.indices.map((idx, j) => (
                <div className="settings-index-card" key={j}>
                  <div className="settings-row">
                    <input type="text" placeholder="my-logs-*" value={idx.pattern} onChange={(e) => updateIndex(i, j, { pattern: e.target.value })} />
                    <button type="button" onClick={() => removeIndex(i, j)}>Remove index</button>
                  </div>
                  <div className="settings-fold-filter-list">
                    {idx.foldFilters.map((f, k) => (
                      <FoldFilterRow
                        key={k}
                        environment={env.name}
                        indexPattern={idx.pattern}
                        filter={f}
                        datalistId={`idx-fields-${i}-${j}`}
                        onChange={(patch) => updateFoldFilter(i, j, k, patch)}
                        onRemove={() => removeFoldFilter(i, j, k)}
                      />
                    ))}
                    <button type="button" onClick={() => addFoldFilter(i, j)}>+ Fold filter</button>
                  </div>
                  <div className="settings-subsection">
                    <label>Field types (cached from index mapping)</label>
                    <IndexFieldTypesTable
                      environment={env.name}
                      indexPattern={idx.pattern}
                      overrides={idx.fieldTypeOverrides}
                      onChangeOverride={(fieldName, type) => changeFieldTypeOverride(i, j, fieldName, type)}
                    />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addIndex(i)}>+ Index</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addEnv}>+ Environment</button>
      <div className="pref-pane-footer">
        <button type="button" onClick={save}>Save</button>
        {saved && <span className="pref-saved-hint">Saved</span>}
      </div>
    </div>
  );
}
