import { useState } from 'react';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { JsonEditor } from '../../shared/components/JsonEditor.jsx';
import { KeyValueTable } from './KeyValueTable.jsx';
import { splitVarSegments } from '../interpolate.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const METHOD_OPTIONS = METHODS.map((m) => ({ value: m, label: m }));
const SUBTABS = ['Params', 'Headers', 'Body', 'Auth'];

function enabledCount(rows) {
  return rows.filter((r) => r.enabled !== false && r.key).length;
}

// The method/URL bar + Params/Headers/Body/Auth editors for whichever
// request tab is active. Fully controlled — every edit goes back up through
// onChangeField so useMockTabs stays the single source of truth (and so
// dirty-tracking / localStorage persistence just works without this
// component needing to know about either).
export function RequestBuilder({ tab, resolvedUrl, onChangeField, onSend, onSave, sending, canSave }) {
  const [subtab, setSubtab] = useState('Params');

  const urlHasVars = tab.url.includes('{{');

  return (
    <div className="mock-main">
      <div className="mock-reqline">
        <Dropdown
          value={tab.method}
          options={METHOD_OPTIONS}
          onChange={(m) => onChangeField({ method: m })}
          className={`mock-method-select mock-method-select-${tab.method.toLowerCase()}`}
        />
        <div className="mock-url-wrap">
          <input
            type="text"
            className="mock-url-input"
            value={tab.url}
            placeholder="https://api.example.com/resource"
            onChange={(e) => onChangeField({ url: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          />
          {urlHasVars && (
            <div className="mock-url-preview">
              {splitVarSegments(resolvedUrl).map((seg, i) => (
                <span key={i} className={seg.isVar ? 'var-resolved' : ''}>{seg.text}</span>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        <button type="button" className="btn-primary" onClick={onSend} disabled={sending || !tab.url.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="mock-subtabs">
        {SUBTABS.map((label) => {
          let badge = null;
          if (label === 'Params') badge = enabledCount(tab.params) || null;
          if (label === 'Headers') badge = enabledCount(tab.headers) || null;
          if (label === 'Auth' && tab.auth.type !== 'none') badge = tab.auth.type;
          return (
            <div key={label} className={subtab === label ? 'mock-subtab active' : 'mock-subtab'} onClick={() => setSubtab(label)}>
              {label}{badge ? <span className="mock-subtab-badge">{badge}</span> : null}
            </div>
          );
        })}
      </div>

      <div className="mock-req-pane">
        {subtab === 'Params' && (
          <KeyValueTable rows={tab.params} onChange={(rows) => onChangeField({ params: rows })} keyPlaceholder="Key" valuePlaceholder="Value" />
        )}
        {subtab === 'Headers' && (
          <KeyValueTable rows={tab.headers} onChange={(rows) => onChangeField({ headers: rows })} keyPlaceholder="Header" valuePlaceholder="Value" />
        )}
        {subtab === 'Body' && (
          <div className="mock-body-editor">
            <div className="mock-body-mode-row">
              {['none', 'json', 'text'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={tab.body.mode === mode ? 'active' : ''}
                  onClick={() => onChangeField({ body: { ...tab.body, mode } })}
                >
                  {mode === 'none' ? 'No body' : mode.toUpperCase()}
                </button>
              ))}
            </div>
            {tab.body.mode !== 'none' && (
              <JsonEditor
                value={tab.body.content}
                onChange={(content) => onChangeField({ body: { ...tab.body, content } })}
                language={tab.body.mode === 'json' ? 'json' : 'text'}
                minHeight="160px"
                maxHeight="100%"
              />
            )}
          </div>
        )}
        {subtab === 'Auth' && (
          <div className="mock-auth-editor">
            <Dropdown
              value={tab.auth.type}
              options={[{ value: 'none', label: 'No auth' }, { value: 'bearer', label: 'Bearer token' }, { value: 'basic', label: 'Basic auth' }]}
              onChange={(type) => onChangeField({ auth: { ...tab.auth, type } })}
              className="mock-auth-type"
            />
            {tab.auth.type === 'bearer' && (
              <input
                type="text"
                className="mock-auth-input"
                placeholder="Token — {{token}} works too"
                value={tab.auth.token || ''}
                onChange={(e) => onChangeField({ auth: { ...tab.auth, token: e.target.value } })}
              />
            )}
            {tab.auth.type === 'basic' && (
              <div className="mock-auth-basic-row">
                <input
                  type="text"
                  placeholder="Username"
                  value={tab.auth.username || ''}
                  onChange={(e) => onChangeField({ auth: { ...tab.auth, username: e.target.value } })}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={tab.auth.password || ''}
                  onChange={(e) => onChangeField({ auth: { ...tab.auth, password: e.target.value } })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
