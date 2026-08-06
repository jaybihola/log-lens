import { useState } from 'react';
import { useAppMode } from './shell/useAppMode.js';
import { ModeSidebar } from './shell/ModeSidebar.jsx';
import { LogViewerApp } from './logLens/LogViewerApp.jsx';
import { JsonFormatterApp } from './jsonLens/JsonFormatterApp.jsx';
import './App.css';
import './logLens/LogLens.css';
import './jsonLens/JsonLens.css';

// The app shell: a thin icon rail picks which independent tool is visible.
// Both stay mounted at all times (just hidden via CSS, not unmounted) —
// each owns real state that's expensive/disruptive to lose on every switch:
// the log viewer's tabs, buffers and SSE connection would otherwise tear
// down and reboot (a fresh /api/tabs fetch + history reload per tab) every
// time you switched away and back.
//
// `jsonImport` is the one deliberate crack in that wall — "send this log
// line to JSON Lens" needs to hand content across from a tool that doesn't
// otherwise know JSON Lens's tabs exist. Kept to the minimum: a one-shot
// { content, name, id } request, cleared by JsonFormatterApp the moment it's
// consumed, rather than lifting either tool's actual tab state up here.
function App() {
  const { mode, setMode } = useAppMode();
  const [jsonImport, setJsonImport] = useState(null);

  const sendToJsonLens = (content, name) => {
    setJsonImport({ content, name, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    setMode('json');
  };

  return (
    <div className="app-shell">
      <ModeSidebar mode={mode} onSetMode={setMode} />
      <div className={mode === 'logs' ? 'mode-pane' : 'mode-pane hidden'}>
        <LogViewerApp active={mode === 'logs'} onSendToJsonLens={sendToJsonLens} />
      </div>
      <div className={mode === 'json' ? 'mode-pane' : 'mode-pane hidden'}>
        <JsonFormatterApp active={mode === 'json'} importRequest={jsonImport} onImportHandled={() => setJsonImport(null)} />
      </div>
    </div>
  );
}

export default App;
