import { useState } from 'react';

// Popover content for the remote-query modal's Pin button — just names the
// current query config and hands it to onSave (useRemoteQueryPresets). The
// resulting list now lives in the sidebar (see RemoteQueryFieldBrowser's
// "Pinned queries" section) alongside recent queries, matching how the real
// log-view sidebar surfaces pinned lines — this popover is only the "add"
// step, not a browse/apply surface anymore.
export function RemoteQueryPinForm({ onSave, onDone }) {
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    onSave(name);
    setName('');
    onDone();
  };

  return (
    <div className="rq-pin-form">
      <label>Pin this query</label>
      <div className="picker-path-row">
        <input
          type="text"
          placeholder="Name…"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        />
        <button type="button" onClick={save} disabled={!name.trim()}>Pin</button>
      </div>
    </div>
  );
}
