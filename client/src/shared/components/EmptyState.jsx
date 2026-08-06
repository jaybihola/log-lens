// A full-pane "nothing open yet" screen — shared by Log Lens (no tabs) and
// JSON Lens (no tabs), so both get the same richer treatment: an icon/title,
// a row of primary actions, and an optional quick-pick list (recent files,
// saved scratches) below it, rather than a single sentence and one button.
export function EmptyState({ icon, title, subtitle, actions, listTitle, listItems }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h2>{title}</h2>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {actions?.length > 0 && (
        <div className="empty-state-actions">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.primary ? 'btn-primary' : ''}
              onClick={a.onClick}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
      {listItems?.length > 0 && (
        <div className="empty-state-list">
          <label>{listTitle}</label>
          {listItems.map((item) => (
            <button key={item.key} type="button" className="empty-state-list-item" title={item.title} onClick={item.onClick}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
