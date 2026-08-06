export function AboutPane() {
  return (
    <div className="pref-pane">
      <h4 className="pref-about-title">log-lens</h4>
      <p className="pref-pane-intro">
        Tails a log file and streams it to the browser, with an instant client-side filter
        language and optional Elasticsearch/OpenSearch-shaped remote queries.
      </p>
      <div className="settings-subsection">
        <label>Config &amp; state locations</label>
        <table className="help-table">
          <tbody>
            <tr><td className="help-syntax">~/.log-lens-state.json</td><td>Open tabs, saved credentials, UI-edited environment settings</td></tr>
            <tr><td className="help-syntax">server/log-lens.settings.json</td><td>Environments/indices/fold filters seed file (git-ignored)</td></tr>
            <tr><td className="help-syntax">server/.env</td><td>Default ES_USERNAME / ES_PASSWORD (git-ignored)</td></tr>
          </tbody>
        </table>
      </div>
      <p className="creds-hint">See the <kbd>?</kbd> button for JQL syntax and keyboard shortcuts.</p>
    </div>
  );
}
