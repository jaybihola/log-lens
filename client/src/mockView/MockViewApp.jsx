import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useMockCollections } from './hooks/useMockCollections.js';
import { useMockTabs } from './hooks/useMockTabs.js';
import { mockViewApi } from './api/mockViewClient.js';
import { MockSidebar } from './components/MockSidebar.jsx';
import { RequestTabBar } from './components/RequestTabBar.jsx';
import { RequestBuilder } from './components/RequestBuilder.jsx';
import { ResponseViewer } from './components/ResponseViewer.jsx';
import { EnvironmentModal } from './components/EnvironmentModal.jsx';
import { SaveRequestModal } from './components/SaveRequestModal.jsx';
import { PromptModal } from '../shared/components/PromptModal.jsx';
import { ConfirmModal } from '../shared/components/ConfirmModal.jsx';
import { EmptyState } from '../shared/components/EmptyState.jsx';
import { buildUrl, buildHeaders } from './requestUtils.js';
import { interpolate } from './interpolate.js';

const REQUEST_FIELDS = (tab) => ({
  name: tab.name, method: tab.method, url: tab.url, params: tab.params, headers: tab.headers, body: tab.body, auth: tab.auth,
});

// Mock View's top-level component — a Postman-style request builder. Tabs
// (useMockTabs) are local-first and localStorage-persisted like JSON Lens's;
// collections + environments (useMockCollections) are server-synced like
// JSON Lens's folder tree. Requests are sent through the server
// (mockViewApi.send -> server/src/mockView/sender.js) to sidestep CORS.
// `active` is accepted (App.jsx passes it to every tool) but unused so far —
// nothing here has a global side effect worth gating yet, unlike Log Lens's
// SSE connection or either tool's Cmd/Ctrl+K listener.
export function MockViewApp({ active: _active }) {
  const {
    collections, environments, activeEnvironmentId, activeEnvironment,
    createCollection, deleteCollection, createFolder, deleteFolder,
    createRequest, updateRequest, deleteRequest,
    createEnvironment, updateEnvironment, deleteEnvironment, setActiveEnvironment,
  } = useMockCollections();
  const {
    tabs, activeTabId, activeTab, addTab, closeTab, activateTab, updateTab, openSavedRequest, markSaved, setResponse, setSending,
  } = useMockTabs();
  const [dialog, setDialog] = useState(null);

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

  return (
    <div className="mock-shell">
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
      />

      <div className="mock-body-col">
        {tabs.length === 0 ? (
          <EmptyState
            icon={<Send size={28} strokeWidth={1.5} />}
            title="No requests open"
            subtitle="Start a new request, or open one from a collection on the left."
            actions={[{ label: 'New request', primary: true, onClick: addTab }]}
          />
        ) : (
          <>
            <RequestTabBar tabs={tabs} activeTabId={activeTabId} onActivate={activateTab} onClose={closeTab} onAdd={addTab} />
            {activeTab && (
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
            )}
          </>
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
    </div>
  );
}
