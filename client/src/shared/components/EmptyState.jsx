import { Tooltip } from './Tooltip.jsx';

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
          {listItems.map((item) => {
            const button = (
              <button type="button" className="empty-state-list-item" onClick={item.onClick}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
            return item.title
              ? <Tooltip key={item.key} label={item.title}>{button}</Tooltip>
              : <span key={item.key} style={{ display: 'contents' }}>{button}</span>;
          })}
        </div>
      )}
    </div>
  );
}
