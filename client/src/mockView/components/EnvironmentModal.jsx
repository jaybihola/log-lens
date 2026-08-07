import { useState } from 'react';
import { KeyValueTable } from './KeyValueTable.jsx';

// The one settings surface this first slice needs: rename an environment
// and edit its variable list. Reuses KeyValueTable (same shape as
// Params/Headers rows) rather than inventing a second key/value editor.
export function EnvironmentModal({ environment, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(environment.name);
  const [variables, setVariables] = useState(environment.variables);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal mock-env-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Environment</h3>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Environment name" />
        <KeyValueTable rows={variables} onChange={setVariables} keyPlaceholder="Variable" valuePlaceholder="Value" />
        <div className="confirm-modal-actions">
          <button type="button" className="danger" onClick={() => onDelete(environment.id)}>Delete</button>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave(environment.id, { name, variables: variables.filter((v) => v.key) })}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
