import { useState } from 'react';
import { FilePickerBody } from '../../shared/components/FilePickerBody.jsx';
import { RemoteQueryBody } from './RemoteQueryBody.jsx';

export function TabPickerModal({ onOpenFile, onCreateRemote, onClose, recentFiles, onRemoveRecent, initialMode = 'file' }) {
  const [mode, setMode] = useState(initialMode); // 'file' | 'api'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-mode-row">
          <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>Local file</button>
          <button type="button" className={mode === 'api' ? 'active' : ''} onClick={() => setMode('api')}>Remote query</button>
        </div>
        {mode === 'file'
          ? <FilePickerBody onOpen={onOpenFile} onClose={onClose} recentFiles={recentFiles} onRemoveRecent={onRemoveRecent} />
          : <RemoteQueryBody onCreate={onCreateRemote} onClose={onClose} />}
      </div>
    </div>
  );
}
