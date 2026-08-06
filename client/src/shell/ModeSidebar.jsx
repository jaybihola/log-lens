import { ScrollText, Braces } from 'lucide-react';
import { Tooltip } from '../shared/components/Tooltip.jsx';

const MODES = [
  { id: 'logs', label: 'Log viewer', description: 'Tail local files or query a remote Elasticsearch/OpenSearch index.', Icon: ScrollText },
  { id: 'json', label: 'JSON Lens', description: 'Format, validate, and drill into JSON documents.', Icon: Braces },
];

// The thin icon rail that switches between the app's separate tools — each
// one owns its own tabs/state entirely; this just decides which one is
// mounted (see App.jsx).
export function ModeSidebar({ mode, onSetMode }) {
  return (
    <nav className="mode-sidebar">
      {MODES.map(({ id, label, description, Icon }) => (
        <Tooltip key={id} label={label} description={description}>
          <button
            type="button"
            className={mode === id ? 'mode-btn active icon-btn' : 'mode-btn icon-btn'}
            onClick={() => onSetMode(id)}
          >
            <Icon size={17} strokeWidth={1.75} />
          </button>
        </Tooltip>
      ))}
    </nav>
  );
}
