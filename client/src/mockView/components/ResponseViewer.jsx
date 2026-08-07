import { useState } from 'react';
import { JsonEditor } from '../../shared/components/JsonEditor.jsx';
import { formatBytes } from '../requestUtils.js';

function statusClass(status) {
  if (!status) return 'st-error';
  if (status < 300) return 'st-2xx';
  if (status < 400) return 'st-3xx';
  if (status < 500) return 'st-4xx';
  return 'st-5xx';
}

function looksLikeJson(text) {
  const trimmed = (text || '').trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

// Status/timing/size header + Body/Headers tabs for whichever request tab is
// active. Three states: nothing sent yet, currently sending, or a response
// (success or a transport-level failure — sender.js reports both through the
// same shape, distinguished by `ok`).
export function ResponseViewer({ response, sending }) {
  const [tab, setTab] = useState('Body');

  if (sending) {
    return (
      <div className="mock-response mock-response-empty">
        <div className="mock-response-empty-msg">Sending…</div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="mock-response mock-response-empty">
        <div className="mock-response-empty-msg">Send a request to see the response here.</div>
      </div>
    );
  }

  if (!response.ok) {
    return (
      <div className="mock-response mock-response-empty">
        <div className="mock-response-empty-msg mock-response-error">{response.error || 'Request failed'}</div>
      </div>
    );
  }

  const headerEntries = Object.entries(response.headers || {});
  const isJson = looksLikeJson(response.body);
  let prettyBody = response.body;
  if (isJson) {
    try { prettyBody = JSON.stringify(JSON.parse(response.body), null, 2); } catch { /* not actually valid JSON — show raw */ }
  }

  return (
    <div className="mock-response">
      <div className="mock-resp-header">
        <div className={`mock-status-pill ${statusClass(response.status)}`}>{response.status} {response.statusText}</div>
        <div className="mock-resp-meta">
          <span>Time <b>{response.timeMs} ms</b></span>
          <span>Size <b>{formatBytes(response.sizeBytes)}</b></span>
        </div>
        <div className="mock-resp-tabs">
          <div className={tab === 'Body' ? 'mock-resp-tab active' : 'mock-resp-tab'} onClick={() => setTab('Body')}>Body</div>
          <div className={tab === 'Headers' ? 'mock-resp-tab active' : 'mock-resp-tab'} onClick={() => setTab('Headers')}>
            Headers <span className="mock-resp-tab-badge">{headerEntries.length}</span>
          </div>
        </div>
      </div>
      <div className="mock-resp-body">
        {tab === 'Body' && (
          prettyBody
            ? <JsonEditor value={prettyBody} readOnly language={isJson ? 'json' : 'text'} minHeight="100%" maxHeight="100%" wrap />
            : <div className="mock-resp-empty-body">Empty response body</div>
        )}
        {tab === 'Headers' && (
          <table className="mock-kv mock-kv-readonly">
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}><td className="key">{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
