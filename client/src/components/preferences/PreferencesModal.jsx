import { useState } from 'react';
import { EnvironmentsPane } from './EnvironmentsPane.jsx';
import { CredentialsPane } from './CredentialsPane.jsx';
import { AppearancePane } from './AppearancePane.jsx';
import { AboutPane } from './AboutPane.jsx';

const SECTIONS = [
  { id: 'environments', label: 'Environments' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'about', label: 'About' },
];

export function PreferencesModal({ onClose, initialSection = 'environments', theme, onSetTheme }) {
  const [section, setSection] = useState(initialSection);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pref-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pref-sidebar">
          <h3 className="pref-title">Preferences</h3>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pref-nav-item ${section === s.id ? 'active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="pref-content">
          {section === 'environments' && <EnvironmentsPane />}
          {section === 'credentials' && <CredentialsPane />}
          {section === 'appearance' && <AppearancePane theme={theme} onSetTheme={onSetTheme} />}
          {section === 'about' && <AboutPane />}
          <button type="button" className="pref-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
