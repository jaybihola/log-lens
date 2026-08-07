import { Play, Square, Trash2, Pencil, Plus } from 'lucide-react';
import { EmptyState } from '../../shared/components/EmptyState.jsx';

const METHOD_CLASS = { GET: 'm-get', POST: 'm-post', PUT: 'm-put', PATCH: 'm-patch', DELETE: 'm-delete' };

function formatTime(at) {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

// The Mock Servers screen's main pane: header (run/stop + base URL), the
// route rules table, and a polled live-traffic log — the "view what's
// actually hitting this" half of the tool, mirroring Log Lens's own live
// tail in spirit (see useMockServers.js).
export function MockServerDetail({ server, traffic, error, onStart, onStop, onDeleteServer, onNewRoute, onEditRoute, onDeleteRoute }) {
  if (!server) {
    return (
      <EmptyState
        icon={<Play size={28} strokeWidth={1.5} />}
        title="No mock server selected"
        subtitle="Create one, or pick one from the list on the left."
      />
    );
  }

  return (
    <div className="mock-server-detail">
      <div className="mock-server-detail-head">
        <h2>{server.name}</h2>
        <span className={server.running ? 'mock-run-pill up' : 'mock-run-pill down'}>
          <span className="dot" />{server.running ? 'Running' : 'Stopped'}
        </span>
        <span className="mock-server-url">http://localhost:{server.port}</span>
        <div className="mock-server-detail-spacer" />
        {server.running ? (
          <button type="button" onClick={() => onStop(server.id)}><Square size={13} strokeWidth={1.75} /> Stop</button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => onStart(server.id)}><Play size={13} strokeWidth={1.75} /> Start</button>
        )}
        <button type="button" className="icon-btn" onClick={() => onDeleteServer(server.id)}><Trash2 size={14} strokeWidth={1.75} /></button>
      </div>

      {error && <div className="mock-server-error">{error}</div>}

      <div className="mock-server-detail-body">
        <div className="mock-server-section">
          <div className="mock-server-section-head">
            <span className="section-label">Routes ({server.routes.length})</span>
            <button type="button" onClick={onNewRoute}><Plus size={13} strokeWidth={1.75} /> New route</button>
          </div>
          {server.routes.length === 0 ? (
            <p className="creds-hint">No routes yet — add one to start serving canned responses.</p>
          ) : (
            <table className="mock-kv mock-kv-readonly">
              <thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Delay</th><th style={{ width: 70 }}></th></tr></thead>
              <tbody>
                {server.routes.map((r) => (
                  <tr key={r.id}>
                    <td><span className={`mock-method-tag ${METHOD_CLASS[r.method] || 'm-get'}`}>{r.method}</span></td>
                    <td className="key">{r.path}</td>
                    <td>{r.status}</td>
                    <td>{r.delayMs ? `${r.delayMs} ms` : '—'}</td>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => onEditRoute(r)}><Pencil size={12} strokeWidth={1.75} /></button>
                      <button type="button" className="icon-btn" onClick={() => onDeleteRoute(server.id, r.id)}><Trash2 size={12} strokeWidth={1.75} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mock-server-section">
          <div className="mock-server-section-head">
            <span className="section-label">Live traffic</span>
          </div>
          {!server.running ? (
            <p className="creds-hint">Start the server to see incoming requests here.</p>
          ) : traffic.length === 0 ? (
            <p className="creds-hint">No requests yet.</p>
          ) : (
            <div className="mock-log-list">
              {traffic.map((h) => (
                <div key={h.id} className={h.status >= 400 ? 'mock-log-row err' : 'mock-log-row'}>
                  <span className="t">{formatTime(h.at)}</span>
                  <span>{h.method}</span>
                  <span className="path">{h.path}</span>
                  <span className="st">{h.status}</span>
                  <span className="lat">{h.timeMs} ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
