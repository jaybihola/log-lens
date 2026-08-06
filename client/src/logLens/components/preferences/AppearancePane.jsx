export function AppearancePane({ theme, onSetTheme }) {
  return (
    <div className="pref-pane">
      <p className="pref-pane-intro">App-wide look and feel, persisted per-browser.</p>
      <div className="settings-subsection">
        <label>Theme</label>
        <div className="theme-choice-row">
          <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => onSetTheme('dark')}>☾ Dark</button>
          <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => onSetTheme('light')}>☀ Light</button>
        </div>
      </div>
      <p className="creds-hint">
        Filter behavior (case-sensitivity, wrap, highlight-only, font size, autoscroll) is per-tab
        and lives in the toolbar&apos;s <strong>View</strong> menu instead of here.
      </p>
    </div>
  );
}
