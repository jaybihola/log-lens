import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

function emptyDraft() {
  return { name: '', username: '', password: '' };
}

export function CredentialsPane() {
  const [credentials, setCredentials] = useState([]);
  const [editingId, setEditingId] = useState(null); // null = not editing; 'new' = add form
  const [draft, setDraft] = useState(emptyDraft());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = () => api.listCredentials().then((r) => setCredentials(r.credentials));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const startAdd = () => { setEditingId('new'); setDraft(emptyDraft()); setError(null); };
  const startEdit = (cred) => { setEditingId(cred.id); setDraft({ name: cred.name, username: cred.username, password: '' }); setError(null); };
  const cancelEdit = () => { setEditingId(null); setError(null); };

  const save = async () => {
    setError(null);
    if (!draft.username.trim()) { setError('Username is required'); return; }
    try {
      if (editingId === 'new') {
        await api.addCredential(draft.name.trim(), draft.username.trim(), draft.password);
      } else {
        await api.updateCredential(editingId, {
          name: draft.name.trim(),
          username: draft.username.trim(),
          password: draft.password || undefined, // omit — leave existing password untouched
        });
      }
      await reload();
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    await api.removeCredential(id);
    await reload();
    if (editingId === id) setEditingId(null);
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="pref-pane">
      <p className="pref-pane-intro">
        Named Basic Auth credentials for remote query environments — store as many as you need,
        then assign one to each environment on the <strong>Environments</strong> tab. Held
        server-side only; passwords are write-only and never sent back to the browser once saved.
      </p>
      {error && editingId === null && <div className="picker-error">{error}</div>}
      {credentials.length === 0 && editingId === null && (
        <div className="picker-empty">No credentials yet.</div>
      )}
      <div className="settings-env-list">
        {credentials.map((cred) => (
          <div className="settings-env-card" key={cred.id}>
            {editingId === cred.id ? (
              <CredentialForm draft={draft} setDraft={setDraft} error={error} isEdit onSave={save} onCancel={cancelEdit} />
            ) : (
              <div className="settings-env-header">
                <div className="cred-summary">
                  <strong>{cred.name}</strong>
                  <span className="creds-hint">{cred.username}</span>
                </div>
                <button type="button" onClick={() => startEdit(cred)}>Edit</button>
                <button type="button" onClick={() => remove(cred.id)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {editingId === 'new' ? (
        <div className="settings-env-card">
          <CredentialForm draft={draft} setDraft={setDraft} error={error} onSave={save} onCancel={cancelEdit} />
        </div>
      ) : (
        <button type="button" onClick={startAdd}>+ Credential</button>
      )}
    </div>
  );
}

function CredentialForm({ draft, setDraft, error, isEdit, onSave, onCancel }) {
  return (
    <div className="pref-pane" style={{ gap: 8 }}>
      {error && <div className="picker-error">{error}</div>}
      <div className="settings-subsection">
        <label>Name</label>
        <input type="text" placeholder="e.g. staging-readonly" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="settings-subsection">
        <label>Username</label>
        <input type="text" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
      </div>
      <div className="settings-subsection">
        <label>Password {isEdit && '(leave blank to keep the existing one)'}</label>
        <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
      </div>
      <div className="pref-pane-footer">
        <button type="button" onClick={onSave}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
