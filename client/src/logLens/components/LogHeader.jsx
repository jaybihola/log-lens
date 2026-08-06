import { ColumnResizeHandle } from '../../shared/components/ColumnResizeHandle.jsx';
import { ContextMenu } from '../../shared/components/ContextMenu.jsx';
import { useContextMenu } from '../../shared/hooks/useContextMenu.js';

export function LogHeader({ columns, onRemoveColumn, tsWidth, badgeWidth, extraColumnWidth, onResizeColumn }) {
  const { menu, openMenu, closeMenu } = useContextMenu();

  const handleContextMenu = (e, key) => {
    openMenu(e, [
      { label: 'Copy field name', onClick: () => navigator.clipboard.writeText(key) },
      { label: 'Remove column', onClick: () => onRemoveColumn(key), danger: true },
    ]);
  };

  return (
    <div className="log-header">
      <span className="pin-col" />
      <span className="num" />
      <span className="pair-col" />
      <span className="ts" style={{ width: tsWidth }}>
        Time
        <ColumnResizeHandle width={tsWidth} onChange={(w) => onResizeColumn('ts', w)} />
      </span>
      <span className="badge" style={{ width: badgeWidth }}>
        Lvl
        <ColumnResizeHandle width={badgeWidth} onChange={(w) => onResizeColumn('badge', w)} />
      </span>
      {columns.map((key) => {
        const width = extraColumnWidth(key);
        return (
          <span className="col-extra" key={key} title={key} style={{ width }} onContextMenu={(e) => handleContextMenu(e, key)}>
            <span className="col-extra-label">{key}</span>
            <span className="col-remove-btn" title="Remove column" onClick={() => onRemoveColumn(key)}>×</span>
            <ColumnResizeHandle width={width} onChange={(w) => onResizeColumn(key, w)} />
          </span>
        );
      })}
      <span className="text">Message</span>
      <span className="actions" />
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}
