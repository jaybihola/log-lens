import { useState } from 'react';
import { Dropdown } from '../../shared/components/Dropdown.jsx';

// Shown the first time a draft tab is saved — picks which collection (and
// optionally which of its folders) the request lands in, plus its name.
// Every save after this one goes straight to the bound collection/request,
// no modal (see MockViewApp's handleSave).
export function SaveRequestModal({ collections, defaultName, onSave, onCancel }) {
  const [name, setName] = useState(defaultName);
  const [collectionId, setCollectionId] = useState(collections[0]?.id || '');
  const [folderId, setFolderId] = useState('');

  const collection = collections.find((c) => c.id === collectionId);
  const folderOptions = [{ value: '', label: 'Ungrouped' }, ...(collection?.folders || []).map((f) => ({ value: f.id, label: f.name }))];

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Save request</h3>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Request name" />
        <Dropdown
          value={collectionId}
          options={collections.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(id) => { setCollectionId(id); setFolderId(''); }}
          className="mock-save-collection"
        />
        <Dropdown value={folderId} options={folderOptions} onChange={setFolderId} className="mock-save-folder" />
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={() => onSave(collectionId, folderId || null, name)} disabled={!name.trim() || !collectionId}>Save</button>
        </div>
      </div>
    </div>
  );
}
