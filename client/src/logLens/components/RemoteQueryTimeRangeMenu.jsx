import { useState } from 'react';
import { QUICK_RANGES, UNIT_MINUTES, UNITS } from '../filter/timeRanges.js';

// Popover content for the remote-query modal's time-range trigger: a custom
// amount+unit "quick select" (mirrors Kibana's own numeric quick-select
// control, but built from this app's own compact segmented-toggle pattern —
// see .filter-combine-toggle — rather than a full Dropdown, which is sized
// for primary pickers like Environment/Index, not a tiny inline unit
// selector) plus the expanded commonly-used list below. Both just resolve
// to a minute count and hand it to the same applyQuickRange the old fixed
// buttons used — no new time-range machinery, only more ways to reach it.
export function RemoteQueryTimeRangeMenu({ activeMinutes, onPick }) {
  const [amount, setAmount] = useState(15);
  const [unit, setUnit] = useState('minutes');

  const applyCustom = () => {
    const n = Math.max(1, Math.round(Number(amount) || 0));
    onPick(n * UNIT_MINUTES[unit]);
  };

  return (
    <div className="rq-time-menu">
      <div className="more-menu-section">
        <label>Quick select</label>
        <div className="rq-time-menu-custom">
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="filter-combine-toggle rq-time-menu-units">
            {UNITS.map((u) => (
              <button key={u.id} type="button" className={unit === u.id ? 'active' : ''} onClick={() => setUnit(u.id)}>
                {u.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={applyCustom}>Apply</button>
        </div>
      </div>
      <div className="view-menu-divider" />
      <div className="more-menu-section">
        <label>Commonly used</label>
        <div className="rq-time-menu-list">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              className={activeMinutes === r.minutes ? 'view-menu-toggle active' : 'view-menu-toggle'}
              onClick={() => onPick(r.minutes)}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
