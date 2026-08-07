import { useMemo, useState } from 'react';
import { PanelLeft, Send } from 'lucide-react';
import { useMockCollections } from './hooks/useMockCollections.js';
import { useMockTabs } from './hooks/useMockTabs.js';
import { useMockSidebar } from './hooks/useMockSidebar.js';
import { useMockServers } from './hooks/useMockServers.js';
import { mockViewApi } from './api/mockViewClient.js';
import { MockSidebar } from './components/MockSidebar.jsx';
import { MockServersSidebar } from './components/MockServersSidebar.jsx';
import { MockServerDetail } from './components/MockServerDetail.jsx';
import { RouteEditorModal } from './components/RouteEditorModal.jsx';
import { NewMockServerModal } from './components/NewMockServerModal.jsx';
import { RequestTabBar } from './components/RequestTabBar.jsx';
import { RequestBuilder } from './components/RequestBuilder.jsx';
import { ResponseViewer } from './components/ResponseViewer.jsx';
import { EnvironmentModal } from './components/EnvironmentModal.jsx';
import { SaveRequestModal } from './components/SaveRequestModal.jsx';
import { PromptModal } from '../shared/components/PromptModal.jsx';
import { ConfirmModal } from '../shared/components/ConfirmModal.jsx';
import { EmptyState } from '../shared/components/EmptyState.jsx';
import { Tooltip } from '../shared/components/Tooltip.jsx';
import { buildUrl, buildHeaders } from './requestUtils.js';
import { interpolate } from './interpolate.js';

const REQUEST_FIELDS = (tab) => ({
  name: tab.name, method: tab.method, url: tab.url, params: tab.params, headers: tab.headers, body: tab.body, auth: tab.auth,
});

// Mock View's top-level component — a Postman-style request builder (see
// RequestBuilder/ResponseViewer) plus a local mock-server engine (see
// MockServerDetail), switched via the two buttons in the header the same
// way JsonToolbar's Edit/View toggle keeps a visible text label instead of
// relying on Tooltip alone. Shares the app shell's `.app`/`.app-header`/
// `.app-body` structure and tab-bar classes with Log Lens and JSON Lens
// rather than inventing its own — see App.css.
export function MockViewApp({ active: _active }) {
  const {
    collections, environments, activeEnvironmentId, activeEnvironment,
    createCollection, deleteCollection, createFolder, deleteFolder,
    createRequest, updateRequest, deleteRequest,
    createEnvironment, updateEnvironment, deleteEnvironment, setActiveEnvironment,
  } = useMockCollections();
  const {
    tabs, activeTabId, activeTab, addTab, closeTab, activateTab, updateTab, renameTab, openSavedRequest, markSaved, setResponse, setSending,
  } = useMockTabs();
  const { sidebarOpen, toggleSidebar, sidebarWidth, resizeSidebar } = useMockSidebar();
  const [screen, setScreen] = useState('requests'); // 'requests' | 'servers'
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const {
    servers, traffic, createServer, deleteServer, createRoute, updateRoute, deleteRoute, start, stop,
  } = useMockServers(screen === 'servers' ? selectedServerId : null);

  const selectedServer = servers.find((s) => s.id === selectedServerId) || null;

  const resolvedUrl = useMemo(
    () => (activeTab ? buildUrl(activeTab.url, activeTab.params, activeEnvironment?.variables) : ''),
    [activeTab, activeEnvironment],
  );

  const handleChangeField = (patch) => { if (activeTab) updateTab(activeTab.id, patch); };

  const handleSend = async () => {
    if (!activeTab || !activeTab.url.trim()) return;
    setSending(activeTab.id, true);
    const vars = activeEnvironment?.variables;
    const url = buildUrl(activeTab.url, activeTab.params, vars);
    const headers = buildHeaders(activeTab.headers, activeTab.auth, vars);
    const body = activeTab.body.mode !== 'none' ? interpolate(activeTab.body.content, vars) : undefined;
    if (body !== undefined && activeTab.body.mode === 'json' && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
    try {
      const res = await mockViewApi.send({ method: activeTab.method, url, headers, body });
      setResponse(activeTab.id, res);
    } catch (e) {
      setResponse(activeTab.id, { ok: false, error: e.message });
    }
  };

  const handleSave = () => {
    if (!activeTab) return;
    if (activeTab.origin === 'saved') {
      updateRequest(activeTab.collectionId, activeTab.requestId, REQUEST_FIELDS(activeTab));
      markSaved(activeTab.id, { collectionId: activeTab.collectionId, requestId: activeTab.requestId });
      return;
    }
    if (!collections.length) { setDialog({ type: 'need-collection-for-save' }); return; }
    setDialog({ type: 'save-request' });
  };

  const handleOpenRequest = (collectionId, request) => openSavedRequest(collectionId, request.id, request);

  const handleNewRequest = async (collectionId, folderId) => {
    const created = await createRequest(collectionId, folderId, { name: 'New request', method: 'GET', url: '' });
    if (created) openSavedRequest(collectionId, created.id, created);
  };

  const handleStartServer = async (id) => {
    setServerError(null);
    try {
      await start(id);
    } catch (e) {
      setServerError(e.message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Mock View</span>
        <Tooltip label="Sidebar" description="Collections and environments, or mock servers.">
          <button type="button" className={sidebarOpen ? 'active icon-btn' : 'icon-btn'} onClick={toggleSidebar}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>

        {screen === 'requests' ? (
          <RequestTabBar tabs={tabs} activeTabId={activeTabId} onActivate={activateTab} onClose={closeTab} onAdd={addTab} onRename={renameTab} />
        ) : (
          <span className="mock-header-spacer" />
        )}

        <div className="app-header-actions mock-screen-switch">
          <button type="button" className={screen === 'requests' ? 'active' : ''} onClick={() => setScreen('requests')}>Requests</button>
          <button type="button" className={screen === 'servers' ? 'active' : ''} onClick={() => setScreen('servers')}>Mock Servers</button>
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && screen === 'requests' && (
          <MockSidebar
            collections={collections}
            environments={environments}
            activeEnvironmentId={activeEnvironmentId}
            activeEnvironment={activeEnvironment}
            onSetActiveEnvironment={setActiveEnvironment}
            onOpenRequest={handleOpenRequest}
            onNewCollection={() => setDialog({ type: 'new-collection' })}
            onNewFolder={(collectionId) => setDialog({ type: 'new-folder', collectionId })}
            onNewRequest={handleNewRequest}
            onDeleteCollection={(id) => setDialog({ type: 'delete-collection', id })}
            onDeleteFolder={(collectionId, folderId) => setDialog({ type: 'delete-folder', collectionId, folderId })}
            onDeleteRequest={(collectionId, requestId) => setDialog({ type: 'delete-request', collectionId, requestId })}
            onNewEnvironment={() => setDialog({ type: 'new-environment' })}
            onEditEnvironment={(env) => setDialog({ type: 'edit-environment', environment: env })}
            width={sidebarWidth}
            onResize={resizeSidebar}
          />
        )}
        {sidebarOpen && screen === 'servers' && (
          <MockServersSidebar
            servers={servers}
            selectedId={selectedServerId}
            onSelect={(id) => { setSelectedServerId(id); setServerError(null); }}
            onNewServer={() => setDialog({ type: 'new-server' })}
            width={sidebarWidth}
            onResize={resizeSidebar}
          />
        )}

        {screen === 'requests' ? (
          tabs.length === 0 ? (
            <EmptyState
              icon={<Send size={28} strokeWidth={1.5} />}
              title="No requests open"
              subtitle="Start a new request, or open one from a collection on the left."
              actions={[{ label: 'New request', primary: true, onClick: addTab }]}
            />
          ) : (
            activeTab && (
              <div className="mock-panes">
                <RequestBuilder
                  tab={activeTab}
                  resolvedUrl={resolvedUrl}
                  onChangeField={handleChangeField}
                  onSend={handleSend}
                  onSave={handleSave}
                  sending={activeTab.sending}
                  canSave
                />
                <ResponseViewer response={activeTab.response} sending={activeTab.sending} />
              </div>
            )
          )
        ) : (
          <MockServerDetail
            server={selectedServer}
            traffic={traffic}
            error={serverError}
            onStart={handleStartServer}
            onStop={stop}
            onDeleteServer={(id) => setDialog({ type: 'delete-server', id })}
            onNewRoute={() => setDialog({ type: 'new-route', serverId: selectedServer.id })}
            onEditRoute={(route) => setDialog({ type: 'edit-route', serverId: selectedServer.id, route })}
            onDeleteRoute={(serverId, routeId) => deleteRoute(serverId, routeId)}
          />
        )}
      </div>

      {dialog?.type === 'new-collection' && (
        <PromptModal title="New collection" placeholder="Collection name" confirmLabel="Create" onCancel={() => setDialog(null)} onConfirm={(name) => { createCollection(name); setDialog(null); }} />
      )}
      {dialog?.type === 'new-folder' && (
        <PromptModal title="New folder" placeholder="Folder name" confirmLabel="Create" onCancel={() => setDialog(null)} onConfirm={(name) => { createFolder(dialog.collectionId, name); setDialog(null); }} />
      )}
      {dialog?.type === 'new-environment' && (
        <PromptModal title="New environment" placeholder="Environment name" confirmLabel="Create" onCancel={() => setDialog(null)} onConfirm={(name) => { createEnvironment(name); setDialog(null); }} />
      )}
      {dialog?.type === 'edit-environment' && (
        <EnvironmentModal
          environment={dialog.environment}
          onCancel={() => setDialog(null)}
          onSave={(id, patch) => { updateEnvironment(id, patch); setDialog(null); }}
          onDelete={(id) => { deleteEnvironment(id); setDialog(null); }}
        />
      )}
      {dialog?.type === 'save-request' && (
        <SaveRequestModal
          collections={collections}
          defaultName={activeTab?.name}
          onCancel={() => setDialog(null)}
          onSave={async (collectionId, folderId, name) => {
            const fields = { ...REQUEST_FIELDS(activeTab), name };
            const created = await createRequest(collectionId, folderId, fields);
            if (created) markSaved(activeTab.id, { collectionId, requestId: created.id, name });
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'need-collection-for-save' && (
        <ConfirmModal
          title="No collections yet"
          message="Create a collection first, then save this request into it."
          actions={[{ label: 'New collection', onClick: () => setDialog({ type: 'new-collection' }) }]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'delete-collection' && (
        <ConfirmModal
          title="Delete collection?"
          message="This deletes every folder and request inside it too."
          actions={[{ label: 'Delete', danger: true, onClick: () => { deleteCollection(dialog.id); setDialog(null); } }]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'delete-folder' && (
        <ConfirmModal
          title="Delete folder?"
          message="This deletes every request inside it too."
          actions={[{ label: 'Delete', danger: true, onClick: () => { deleteFolder(dialog.collectionId, dialog.folderId); setDialog(null); } }]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'delete-request' && (
        <ConfirmModal
          title="Delete request?"
          actions={[{ label: 'Delete', danger: true, onClick: () => { deleteRequest(dialog.collectionId, dialog.requestId); setDialog(null); } }]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'new-server' && (
        <NewMockServerModal
          onCancel={() => setDialog(null)}
          onSave={async (name, port) => {
            const created = await createServer(name, port);
            if (created) setSelectedServerId(created.id);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'delete-server' && (
        <ConfirmModal
          title="Delete mock server?"
          message="This stops it (if running) and removes every route on it."
          actions={[{ label: 'Delete', danger: true, onClick: () => { deleteServer(dialog.id); if (selectedServerId === dialog.id) setSelectedServerId(null); setDialog(null); } }]}
          onCancel={() => setDialog(null)}
        />
      )}
      {(dialog?.type === 'new-route' || dialog?.type === 'edit-route') && (
        <RouteEditorModal
          route={dialog.route || null}
          onCancel={() => setDialog(null)}
          onSave={(fields) => {
            if (dialog.type === 'edit-route') updateRoute(dialog.serverId, dialog.route.id, fields);
            else createRoute(dialog.serverId, fields);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
