import { useEffect, useRef, useState } from 'react';

// Generic single-text-input modal — renaming, naming a new file, naming a
// new scratch. Same rationale as ConfirmModal: no native window.prompt()
// anywhere in this app.
export function PromptModal({ title, message, initialValue = '', placeholder, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal prompt-modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {message && <p className="confirm-modal-message">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            else if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={submit} disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
