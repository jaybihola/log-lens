import { Plus, X } from 'lucide-react';
import { isTabDirty } from '../hooks/useMockTabs.js';

const METHOD_CLASS = { GET: 'm-get', POST: 'm-post', PUT: 'm-put', PATCH: 'm-patch', DELETE: 'm-delete' };

export function RequestTabBar({ tabs, activeTabId, onActivate, onClose, onAdd }) {
  return (
    <div className="mock-reqtabs">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={t.id === activeTabId ? 'mock-reqtab active' : 'mock-reqtab'}
          onClick={() => onActivate(t.id)}
        >
          <span className={`mock-method-tag ${METHOD_CLASS[t.method] || 'm-get'}`}>{t.method}</span>
          <span className="mock-reqtab-name">{t.name}</span>
          {isTabDirty(t) && <span className="mock-reqtab-dirty" />}
          <button type="button" className="mock-reqtab-x" onClick={(e) => { e.stopPropagation(); onClose(t.id); }}>
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button type="button" className="mock-reqtab-add" onClick={onAdd}>
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
