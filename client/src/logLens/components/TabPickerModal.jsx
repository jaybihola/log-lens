import { useState } from 'react';
import { FilePickerBody } from '../../shared/components/FilePickerBody.jsx';
import { RemoteQueryBody } from './RemoteQueryBody.jsx';

export function TabPickerModal({ onOpenFile, onOpenFiles, onCreateRemote, onClose, recentFiles, onRemoveRecent, initialMode = 'file' }) {
  const [mode, setMode] = useState(initialMode); // 'file' | 'api'
  // Owned here (not inside RemoteQueryBody) so it can render inline with
  // the Local file/Remote query row below instead of on a row of its own —
  // both rows were left-aligned and compact, which meant two mostly-empty
  // rows stacked on top of each other; one shared row uses that space.
  const [formTab, setFormTab] = useState('build'); // 'build' | 'raw' — only relevant once mode === 'api'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={mode === 'api' ? 'modal remote-query-modal' : 'modal picker-modal tab-picker-file'} onClick={(e) => e.stopPropagation()}>
        <div className="picker-mode-row tab-picker-header-row">
          <div className="picker-mode-group">
            <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>Local file</button>
            <button type="button" className={mode === 'api' ? 'active' : ''} onClick={() => setMode('api')}>Remote query</button>
          </div>
          {mode === 'api' && (
            <div className="picker-mode-group rq-tabs-inline">
              <button type="button" className={formTab === 'build' ? 'active' : ''} onClick={() => setFormTab('build')}>Build</button>
              <button type="button" className={formTab === 'raw' ? 'active' : ''} onClick={() => setFormTab('raw')}>Raw request</button>
            </div>
          )}
        </div>
        {mode === 'file'
          ? (
            <FilePickerBody
              onOpen={onOpenFile}
              onOpenMultiple={onOpenFiles}
              multiple
              onClose={onClose}
              recentFiles={recentFiles}
              onRemoveRecent={onRemoveRecent}
            />
          )
          : (
            <RemoteQueryBody
              onCreate={onCreateRemote}
              onClose={onClose}
              activeTab={formTab}
              onActiveTabChange={setFormTab}
            />
          )}
      </div>
    </div>
  );
}
