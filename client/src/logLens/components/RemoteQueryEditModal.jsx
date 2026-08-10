import { RemoteQueryBody } from './RemoteQueryBody.jsx';

// Hosts RemoteQueryBody directly, skipping TabPickerModal's Local file/
// Remote query switcher — used for "Duplicate and modify" (mode: 'create',
// seeded from an existing tab) and "Edit" (mode: 'edit', reconfigures that
// same tab) from the tab bar's context menu, where the source is already
// known to be a remote query.
export function RemoteQueryEditModal({ mode, initialConfig, onCreate, onSave, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal remote-query-modal" onClick={(e) => e.stopPropagation()}>
        <RemoteQueryBody
          mode={mode}
          initialConfig={initialConfig}
          onCreate={onCreate}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
