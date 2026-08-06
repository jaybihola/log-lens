const ROWS = [
  ['foo bar', 'AND (default) — line must contain both foo and bar'],
  ['foo OR bar', 'OR — lower precedence than AND, so "a b OR c d" means (a AND b) OR (c AND d)'],
  ['-foo', 'NOT — line must not contain foo'],
  ['"foo bar"', 'Quoted phrase — spaces included'],
  ['field:value', "JSON-path filter — line's field must contain value (substring, dot-path)"],
  ['field:err*  /  field:*Exception', 'Wildcard — anchored, so this means "starts with" / "ends with" (not just contains)'],
  ['field:(a,b,c)', 'Field is one of these values (OR) — each item can also use a wildcard'],
  ['field:*', 'Field-presence filter — the key exists, whether or not its value is null'],
  ['field:null', 'The key exists and its value is null'],
  ['field:* -field:null', 'The key exists with a real (non-null) value'],
  ['-field:*', "The key doesn't exist at all"],
  ['-field:value', 'NOT version of field:value'],
  ['err*Exception', 'Wildcard in a bare term too — searched anywhere in the line'],
];

const SHORTCUTS = [
  ['/', 'Focus the filter box'],
  ['⌘F / Ctrl+F', 'Open Find — same JQL, but highlights matches without removing lines, with next/previous'],
  ['Enter / Shift+Enter', 'Next / previous match, while the find bar is focused'],
  ['Esc', 'Close the open find bar/menu/modal'],
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
