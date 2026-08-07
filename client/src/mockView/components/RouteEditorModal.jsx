import { useState } from 'react';
import { Dropdown } from '../../shared/components/Dropdown.jsx';
import { JsonEditor } from '../../shared/components/JsonEditor.jsx';

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }));

const PLACEHOLDER_BODY = `{
  "id": "{{uuid}}",
  "receivedAt": "{{now}}"
}`;

// Create/edit one route rule on a mock server. `route` is null for create.
// Response body supports {{uuid}}, {{now}}, and {{request.params.x}} /
// {{request.query.x}} / {{request.body.x}} templating — resolved live by
// server/src/mockView/mockServerEngine.js on every hit, not baked in here.
export function RouteEditorModal({ route, onSave, onCancel }) {
  const [method, setMethod] = useState(route?.method || 'GET');
  const [path, setPath] = useState(route?.path || '/');
  const [status, setStatus] = useState(route?.status ?? 200);
  const [body, setBody] = useState(route?.body ?? '');
  const [delayMs, setDelayMs] = useState(route?.delayMs ?? 0);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal mock-route-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{route ? 'Edit route' : 'New route'}</h3>
        <div className="mock-route-modal-row">
          <Dropdown value={method} options={METHOD_OPTIONS} onChange={setMethod} className="mock-route-method" />
          <input type="text" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/orders/:id" className="mock-route-path" />
        </div>
        <div className="mock-route-modal-row">
          <label className="mock-route-field-label">
            Status
            <input type="text" inputMode="numeric" value={status} onChange={(e) => setStatus(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </label>
          <label className="mock-route-field-label">
            Delay (ms)
            <input type="text" inputMode="numeric" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value.replace(/\D/g, '')) || 0)} />
          </label>
        </div>
        <label className="mock-route-field-label mock-route-body-label">Response body</label>
        <JsonEditor value={body} onChange={setBody} language="json" minHeight="140px" maxHeight="260px" wrap />
        {!body && <p className="creds-hint">e.g.<br />{PLACEHOLDER_BODY}</p>}
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={() => onSave({ method, path: path.trim() || '/', status, body, delayMs })} disabled={!path.trim()}>
            {route ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
