import { useState } from 'react';

export function NewMockServerModal({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [port, setPort] = useState('4010');

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New mock server</h3>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name" autoFocus />
        <label className="mock-route-field-label">
          Port
          <input type="text" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
        </label>
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={() => onSave(name.trim(), Number(port) || 4010)} disabled={!name.trim()}>Create</button>
        </div>
      </div>
    </div>
  );
}
