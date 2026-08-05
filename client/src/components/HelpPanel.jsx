const ROWS = [
  ['foo bar', 'AND (default) — line must contain both foo and bar'],
  ['foo OR bar', 'OR — lower precedence than AND, so "a b OR c d" means (a AND b) OR (c AND d)'],
  ['-foo', 'NOT — line must not contain foo'],
  ['"foo bar"', 'Quoted phrase — spaces included'],
  ['field:value', "JSON-path filter — line's field must contain value (substring, dot-path)"],
  ['field:*', 'Field-presence filter — line must have this field, any value'],
  ['-field:value / -field:*', 'NOT versions of the above'],
];

const SHORTCUTS = [
  ['/', 'Focus the filter box'],
  ['Esc', 'Close the open menu/modal'],
];

export function HelpPanel() {
  return (
    <div className="help-panel">
      <h4>JQL syntax</h4>
      <table className="help-table">
        <tbody>
          {ROWS.map(([syntax, meaning]) => (
            <tr key={syntax}>
              <td className="help-syntax">{syntax}</td>
              <td>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="help-example">
        {'"mismatched" OR validation -heartbeat -debug'}
      </p>
      <h4>Keyboard shortcuts</h4>
      <table className="help-table">
        <tbody>
          {SHORTCUTS.map(([key, meaning]) => (
            <tr key={key}>
              <td className="help-syntax"><kbd>{key}</kbd></td>
              <td>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
