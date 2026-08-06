// Generic decision modal — a message plus caller-supplied action buttons and
// an implicit Cancel. This app never uses the browser's native confirm(), so
// anything from "delete this file?" to "this tab isn't saved — what do you
// want to do?" (which needs more than yes/no) goes through this instead.
//
// `actions`: [{ label, onClick, danger? }] — rendered in order, most
// prominent action last (rightmost) by convention.
export function ConfirmModal({ title, message, actions, onCancel, cancelLabel = 'Cancel' }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {message && <p className="confirm-modal-message">{message}</p>}
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'danger' : ''}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
