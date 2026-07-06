import { useEffect, useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SyncScopeNodeDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseSectionCard
} from "./knowledge-base-rag-components.tsx";
import { parseGoogleDriveScopeInput } from "./google-drive-id.ts";

import "./knowledge-base-rag-sync-scope.css";

const defaultApiClient = createKnowledgeBaseRagApiClient();

export type KnowledgeBaseSyncScopeScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
  onViewProcessingStatus?: () => void;
  onScopeSaved?: () => void;
};

export function KnowledgeBaseSyncScopeScreen(props: KnowledgeBaseSyncScopeScreenProps) {
  const {
    apiClient = defaultApiClient,
    workspaceId = DEMO_WORKSPACE_ID,
    onViewProcessingStatus,
    onScopeSaved
  } = props;
  const [scopeNodes, setScopeNodes] = useState<SyncScopeNodeDto[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [scopeInput, setScopeInput] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [maxFiles, setMaxFiles] = useState(100);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<"hourly" | "daily">("daily");
  const [selectedScopeNodeIds, setSelectedScopeNodeIds] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [operationState, setOperationState] = useState<"idle" | "saving" | "syncing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const savedScopeNodes = useMemo(
    () =>
      scopeNodes.filter(
        (node) => node.selected && selectedScopeNodeIds.has(node.scopeNodeId)
      ),
    [scopeNodes, selectedScopeNodeIds]
  );
  const isBusy = operationState !== "idle";
  const hasScopeCandidate =
    savedScopeNodes.length > 0 || scopeInput.trim().length > 0;

  useEffect(() => {
    let isActive = true;

    setLoadState("loading");
    setErrorMessage(null);
    setNoticeMessage(null);

    Promise.allSettled([
      apiClient.listDataSources(workspaceId, { provider: "google_drive" }),
      apiClient.getSyncScope(workspaceId)
    ])
      .then(([sourcesResult, nodesResult]) => {
        if (!isActive) return;
        if (sourcesResult.status === "rejected") {
          throw sourcesResult.reason;
        }
        const sources = sourcesResult.value;
        const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : [];
        const connectedSource = sources.find((source) => source.status === "connected");
        setSourceId(connectedSource?.sourceId ?? null);
        setAutoSyncEnabled(connectedSource?.autoSyncEnabled === true);
        setAutoSyncFrequency(connectedSource?.autoSyncFrequency ?? "daily");
        setScopeNodes(nodes);
        setSelectedScopeNodeIds(new Set(nodes.filter((node) => node.selected).map((node) => node.scopeNodeId)));
        setScopeInput("");
        setHasUnsavedChanges(false);
        if (nodesResult.status === "rejected") {
          setNoticeMessage(
            "Saved scope is temporarily unavailable. You can still enter Drive URLs or IDs."
          );
        }
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setScopeNodes([]);
        setSelectedScopeNodeIds(new Set());
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, retryKey, workspaceId]);

  async function handleSaveScope() {
    if (isBusy) return;

    setOperationState("saving");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!sourceId) throw new Error("Connect Google Drive before saving scope.");
      const parsedScope = parseGoogleDriveScopeInput(scopeInput);
      const savedItems = savedScopeNodes.flatMap((node) =>
        node.externalId && (node.nodeType === "folder" || node.nodeType === "file")
          ? [{ id: node.externalId, kind: node.nodeType }]
          : []
      );
      const requestedItems = new Map(
        [...savedItems, ...parsedScope].map((item) => [
          `${item.kind}:${item.id}`,
          item
        ])
      );
      const nextScope = [...requestedItems.values()];
      const updatedNodes = await apiClient.configureGoogleDriveScope(
        workspaceId,
        sourceId,
        {
          folderIds: nextScope.filter((item) => item.kind === "folder").map((item) => item.id),
          fileIds: nextScope.filter((item) => item.kind === "file").map((item) => item.id),
          recursive,
          maxFiles,
          allowedMimeTypes: [
            "text/plain",
            "text/markdown",
            "text/csv",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.google-apps.document",
            "application/vnd.google-apps.spreadsheet"
          ]
        }
      );
      setScopeNodes(updatedNodes);
      setSelectedScopeNodeIds(
        new Set(updatedNodes.filter((node) => node.selected).map((node) => node.scopeNodeId))
      );
      await apiClient.configureGoogleDriveAutoSync(workspaceId, sourceId, {
        autoSyncEnabled,
        autoSyncFrequency: autoSyncEnabled ? autoSyncFrequency : undefined
      });
      setScopeInput("");
      setHasUnsavedChanges(false);
      setSuccessMessage("Synchronization scope updated.");
      onScopeSaved?.();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  async function handleRequestManualSync() {
    if (isBusy) return;

    setOperationState("syncing");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiClient.requestManualSync(workspaceId, {
        sourceId: sourceId ?? undefined,
        scopeNodeIds: [...selectedScopeNodeIds]
      });
      setSuccessMessage("Sync job started. View progress in Processing Status.");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  return (
    <div className="knowledge-base-rag-sync-scope">
      {successMessage ? (
        <div
          className="knowledge-base-rag-sync-scope-feedback knowledge-base-rag-sync-scope-feedback--success"
          role="status"
        >
          <span>{successMessage}</span>
          {successMessage.startsWith("Sync job started") &&
          onViewProcessingStatus ? (
            <button type="button" onClick={onViewProcessingStatus}>
              View Processing Status
            </button>
          ) : null}
        </div>
      ) : null}

      <KnowledgeBaseSectionCard
        title="Drive content"
        eyebrow="Selected content"
        description="Choose which Google Drive files or folders can be imported into the Knowledge Base."
      >
        {loadState === "loading" ? (
          <div className="knowledge-base-rag-sync-scope-feedback" role="status">
            Loading synchronization scope...
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="knowledge-base-rag-sync-scope-feedback" role="alert">
            <div>
              <h3>Unable to load synchronization scope</h3>
              <p>{errorMessage}</p>
            </div>
            <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {noticeMessage && loadState === "loaded" ? (
          <p className="knowledge-base-rag-sync-scope-note" role="status">
            {noticeMessage}
          </p>
        ) : null}

        {errorMessage && loadState === "loaded" ? (
          <div className="knowledge-base-rag-sync-scope-feedback" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {loadState === "loaded" && sourceId ? (
          <>
            <div className="knowledge-base-rag-sync-scope-config">
              <label>
                Paste Drive file/folder URLs or IDs
                <textarea
                  aria-label="Paste Drive file/folder URLs or IDs"
                  value={scopeInput}
                  onChange={(event) => {
                    setScopeInput(event.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Paste a Google Drive file or folder URL"
                />
                <span>
                  One item per line. Full URLs and raw IDs are accepted.
                </span>
              </label>
            </div>
            <details className="knowledge-base-rag-sync-scope-instructions">
              <summary>How do I find a Drive file or folder ID?</summary>
              <p>
                You can paste the full URL. The app extracts the ID automatically.
              </p>
              <ul>
                <li>
                  Google Docs: <code>https://docs.google.com/document/d/&lt;DOCUMENT_ID&gt;/edit</code>
                </li>
                <li>
                  Uploaded files: <code>https://drive.google.com/file/d/&lt;FILE_ID&gt;/view</code>
                </li>
                <li>
                  Drive folders: <code>https://drive.google.com/drive/folders/&lt;FOLDER_ID&gt;</code>
                </li>
              </ul>
              <p>
                Paste only the ID part. For example,
                <code>182d96jUaHozp6IrL8Ne55-YmSQSePagGfy85y3t2W6g</code>.
              </p>
              <p>
                This local demo uses manual file/folder IDs. If Google denies
                access, share or select the item for this app. Production should
                use Google Picker with <code>drive.file</code>.
              </p>
            </details>
            <div className="knowledge-base-rag-sync-scope-section">
              <h3>Sync settings</h3>
              <p>
                Google Drive automatic sync keeps selected Drive files and folders
                updated in the Knowledge Base on a schedule.
              </p>
            </div>
            <div className="knowledge-base-rag-sync-scope-config">
              <label>
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(event) => {
                    setRecursive(event.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                />
                Include nested folders
              </label>
              <label>
                Maximum files per sync
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxFiles}
                  onChange={(event) => {
                    setMaxFiles(Number(event.target.value));
                    setHasUnsavedChanges(true);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(event) => {
                    setAutoSyncEnabled(event.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                  disabled={!hasScopeCandidate}
                />
                Enable Auto Sync
              </label>
              <label>
                Frequency
                <select
                  aria-label="Auto Sync frequency"
                  disabled={!autoSyncEnabled}
                  value={autoSyncFrequency}
                  onChange={(event) => {
                    setAutoSyncFrequency(event.target.value as "hourly" | "daily");
                    setHasUnsavedChanges(true);
                  }}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>
            </div>
            <div className="knowledge-base-rag-sync-scope-saved">
              <div className="knowledge-base-rag-sync-scope-section">
                <h3>Saved Drive content</h3>
                <p>
                  These Google Drive files and folders are included in Knowledge
                  Base sync.
                </p>
              </div>
              {savedScopeNodes.length > 0 ? (
                <div
                  className="knowledge-base-rag-sync-scope-saved__list"
                  role="list"
                >
                  {savedScopeNodes.map((node) => (
                    <SavedScopeItem key={node.scopeNodeId} node={node} />
                  ))}
                </div>
              ) : (
                <p className="knowledge-base-rag-sync-scope-saved__empty">
                  No Drive content selected yet.
                </p>
              )}
            </div>

            <div className="knowledge-base-rag-sync-scope-section">
              <h3>Save and sync</h3>
            </div>
            <div className="knowledge-base-rag-sync-scope-actions" aria-label="Sync scope actions">
              <button
                type="button"
                disabled={isBusy || !hasUnsavedChanges || !hasScopeCandidate}
                onClick={() => void handleSaveScope()}
              >
                {operationState === "saving" ? "Saving..." : "Save scope"}
              </button>
              <div className="knowledge-base-rag-sync-scope-actions__sync">
                <button
                  type="button"
                  disabled={isBusy || selectedScopeNodeIds.size === 0}
                  onClick={() => void handleRequestManualSync()}
                >
                  {operationState === "syncing" ? "Syncing..." : "Sync now"}
                </button>
                {selectedScopeNodeIds.size === 0 ? (
                  <span>Save at least one Drive file or folder before syncing.</span>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {loadState === "loaded" && !sourceId ? (
          <KnowledgeBaseEmptyState
            title="No synchronization scope available"
            description="Connect Google Drive before configuring folder or file scope."
          />
        ) : null}
      </KnowledgeBaseSectionCard>
    </div>
  );
}

function SavedScopeItem({ node }: { node: SyncScopeNodeDto }) {
  return (
    <div className="knowledge-base-rag-sync-scope-saved__item" role="listitem">
      <div>
        <strong>{getScopeNodeDisplayName(node)}</strong>
        <span>Google Drive</span>
      </div>
      <span className="knowledge-base-rag-sync-scope-saved__type">
        {node.nodeType === "folder" ? "Folder" : "File"}
      </span>
    </div>
  );
}

function getScopeNodeDisplayName(node: SyncScopeNodeDto): string {
  const name = node.name.trim();
  const exposesExternalId =
    Boolean(node.externalId) &&
    (name === node.externalId || name.includes(node.externalId ?? ""));
  if (!name || exposesExternalId || /^(file|folder)\s+[a-z0-9_-]{3,}$/i.test(name)) {
    return node.nodeType === "folder"
      ? "Google Drive folder"
      : "Google Drive file";
  }
  return name;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Knowledge Base / RAG API could not be reached.";
}
