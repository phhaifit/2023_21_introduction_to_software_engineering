import { useEffect, useMemo, useRef, useState } from "react";

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

type SyncScopeTreeNode = SyncScopeNodeDto & {
  children: SyncScopeTreeNode[];
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
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [retryKey, setRetryKey] = useState(0);

  const tree = useMemo(() => buildScopeTree(scopeNodes), [scopeNodes]);
  const savedRootNodes = useMemo(
    () => scopeNodes.filter((node) => !node.parentScopeNodeId),
    [scopeNodes]
  );
  const hasFolderRoot = savedRootNodes.some(
    (node) => node.nodeType === "folder"
  );
  const hasExpandableFolder = useMemo(
    () => tree.some(hasExpandableTreeNode),
    [tree]
  );
  const previewUnavailable =
    tree.length > 0 &&
    tree.every(
      (node) =>
        isGenericScopeNodeName(node) &&
        node.children.length === 0 &&
        !node.hasMoreChildren
    );
  const isBusy = operationState !== "idle";
  const hasScopeCandidate =
    savedRootNodes.length > 0 || scopeInput.trim().length > 0;

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
        setSelectionDirty(false);
        setExpandedNodeIds(new Set());
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
      const savedItems = savedRootNodes.flatMap((node) =>
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
      const configuredNodes = await apiClient.configureGoogleDriveScope(
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
      const knownNodeIds = new Set(scopeNodes.map((node) => node.scopeNodeId));
      const nextSelectedIds = selectionDirty
        ? new Set([
            ...[...selectedScopeNodeIds].filter((id) =>
              configuredNodes.some((node) => node.scopeNodeId === id)
            ),
            ...configuredNodes
              .filter((node) => !knownNodeIds.has(node.scopeNodeId) && node.selected)
              .map((node) => node.scopeNodeId)
          ])
        : new Set(
            configuredNodes
              .filter((node) => node.selected)
              .map((node) => node.scopeNodeId)
          );
      const updatedNodes = await apiClient.updateSyncScope(workspaceId, {
        selectedScopeNodeIds: [...nextSelectedIds]
      });
      setScopeNodes(updatedNodes);
      setSelectedScopeNodeIds(nextSelectedIds);
      await apiClient.configureGoogleDriveAutoSync(workspaceId, sourceId, {
        autoSyncEnabled,
        autoSyncFrequency: autoSyncEnabled ? autoSyncFrequency : undefined
      });
      setScopeInput("");
      setHasUnsavedChanges(false);
      setSelectionDirty(false);
      setSuccessMessage("Synchronization scope updated.");
      onScopeSaved?.();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  function handleToggleNode(node: SyncScopeTreeNode) {
    if (!node.selectable || isBusy) return;
    setSelectedScopeNodeIds((current) => {
      const next = new Set(current);
      const descendantIds = collectNodeIds(node);
      const shouldSelect = !isTreeNodeFullySelected(node, current);
      for (const id of descendantIds) {
        const candidate = scopeNodes.find((item) => item.scopeNodeId === id);
        if (!candidate?.selectable) continue;
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
      normalizeFolderSelections(tree, next);
      if (next.size === 0) setAutoSyncEnabled(false);
      return next;
    });
    setSelectionDirty(true);
    setHasUnsavedChanges(true);
    setSuccessMessage(null);
  }

  function handleSelectAll() {
    setSelectedScopeNodeIds(
      new Set(scopeNodes.filter((node) => node.selectable).map((node) => node.scopeNodeId))
    );
    setSelectionDirty(true);
    setHasUnsavedChanges(true);
  }

  function handleClearSelection() {
    setSelectedScopeNodeIds(new Set());
    setAutoSyncEnabled(false);
    setSelectionDirty(true);
    setHasUnsavedChanges(true);
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
            <div className="knowledge-base-rag-sync-scope-saved">
              <div className="knowledge-base-rag-sync-scope-section">
                <h3>Selected Drive content</h3>
                <p>
                  Choose which saved Google Drive files and folders are included
                  in Knowledge Base sync.
                </p>
              </div>
              {tree.length > 0 && !previewUnavailable ? (
                <>
                  <div className="knowledge-base-rag-sync-scope-tree-actions">
                    {hasExpandableFolder ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNodeIds(
                              new Set(
                                scopeNodes
                                  .filter((node) => node.nodeType === "folder")
                                  .map((node) => node.scopeNodeId)
                              )
                            )
                          }
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedNodeIds(new Set())}
                        >
                          Collapse all
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={handleSelectAll}>Select all</button>
                    <button type="button" onClick={handleClearSelection}>
                      Clear selection
                    </button>
                  </div>
                  <div className="knowledge-base-rag-sync-scope-tree" role="tree">
                    {tree.map((node) => (
                      <SyncScopeTreeItem
                        expandedNodeIds={expandedNodeIds}
                        key={node.scopeNodeId}
                        node={node}
                        onToggle={handleToggleNode}
                        onToggleExpanded={(nodeId) =>
                          setExpandedNodeIds((current) => {
                            const next = new Set(current);
                            if (next.has(nodeId)) next.delete(nodeId);
                            else next.add(nodeId);
                            return next;
                          })
                        }
                        selectedScopeNodeIds={selectedScopeNodeIds}
                      />
                    ))}
                  </div>
                  {tree.some((node) => isGenericScopeNodeName(node)) ? (
                    <p className="knowledge-base-rag-sync-scope-note" role="status">
                      Drive preview is unavailable. Saved items can still be synced.
                    </p>
                  ) : null}
                </>
              ) : previewUnavailable ? (
                <div className="knowledge-base-rag-sync-scope-preview-unavailable">
                  <strong>{formatSelectedDriveItemCount(scopeNodes, selectedScopeNodeIds)}</strong>
                  <p role="status">
                    Drive preview is unavailable. Saved items can still be synced.
                  </p>
                  <div className="knowledge-base-rag-sync-scope-tree-actions">
                    <button type="button" onClick={handleSelectAll}>Select all</button>
                    <button type="button" onClick={handleClearSelection}>
                      Clear selection
                    </button>
                  </div>
                </div>
              ) : (
                <p className="knowledge-base-rag-sync-scope-saved__empty">
                  No Drive content selected yet. Paste a Drive file or folder URL
                  above, then save scope.
                </p>
              )}
            </div>

            <div className="knowledge-base-rag-sync-scope-section">
              <h3>Sync settings</h3>
              <p>
                Google Drive automatic sync keeps selected Drive files and folders
                updated in the Knowledge Base on a schedule.
              </p>
            </div>
            <div className="knowledge-base-rag-sync-scope-config">
              {hasFolderRoot ? (
                <label>
                  <span className="knowledge-base-rag-sync-scope-checkbox-label">
                    <input
                      type="checkbox"
                      aria-label="Include subfolders in future sync"
                      checked={recursive}
                      onChange={(event) => {
                        setRecursive(event.target.checked);
                        setHasUnsavedChanges(true);
                      }}
                    />
                    Include subfolders in future sync
                  </span>
                  <span>
                    When enabled, new files added inside subfolders of selected
                    folders will be included during future syncs.
                  </span>
                </label>
              ) : null}
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
                  disabled={
                    selectedScopeNodeIds.size === 0 &&
                    scopeInput.trim().length === 0
                  }
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
                  disabled={
                    isBusy ||
                    selectedScopeNodeIds.size === 0 ||
                    hasUnsavedChanges
                  }
                  title={
                    hasUnsavedChanges
                      ? "Save selection and settings before syncing."
                      : selectedScopeNodeIds.size === 0
                        ? "Select at least one Drive file or folder before syncing."
                        : undefined
                  }
                  onClick={() => void handleRequestManualSync()}
                >
                  {operationState === "syncing" ? "Syncing..." : "Sync now"}
                </button>
                {selectedScopeNodeIds.size === 0 ? (
                  <span>Select at least one Drive file or folder before syncing.</span>
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

function SyncScopeTreeItem(props: {
  node: SyncScopeTreeNode;
  selectedScopeNodeIds: Set<string>;
  expandedNodeIds: Set<string>;
  onToggle: (node: SyncScopeTreeNode) => void;
  onToggleExpanded: (nodeId: string) => void;
}) {
  const {
    node,
    selectedScopeNodeIds,
    expandedNodeIds,
    onToggle,
    onToggleExpanded
  } = props;
  const checkboxRef = useRef<HTMLInputElement>(null);
  const selectedState = getTreeNodeSelectionState(node, selectedScopeNodeIds);
  const isFolder = node.nodeType === "folder";
  const expanded = expandedNodeIds.has(node.scopeNodeId);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectedState === "mixed";
    }
  }, [selectedState]);

  return (
    <div
      className="knowledge-base-rag-sync-scope-tree__node"
      role="treeitem"
      aria-expanded={isFolder ? expanded : undefined}
    >
      <div className="knowledge-base-rag-sync-scope-tree__row">
        <label>
          <input
            checked={selectedState === "selected"}
            disabled={!node.selectable}
            onChange={() => onToggle(node)}
            ref={checkboxRef}
            type="checkbox"
          />
          <span>{getScopeNodeDisplayName(node)}</span>
        </label>
        <span className="knowledge-base-rag-sync-scope-saved__type">
          {isFolder ? "Folder" : node.selectable ? "File" : "Unsupported"}
        </span>
        {isFolder && (node.children.length > 0 || node.hasMoreChildren) ? (
          <button
            aria-label={`${expanded ? "Collapse" : "Expand"} ${getScopeNodeDisplayName(node)}`}
            type="button"
            onClick={() => onToggleExpanded(node.scopeNodeId)}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      {node.unsupportedReason ? <p>{node.unsupportedReason}</p> : null}
      {expanded && node.children.length > 0 ? (
        <div className="knowledge-base-rag-sync-scope-tree__children" role="group">
          {node.children.map((child) => (
            <SyncScopeTreeItem
              {...props}
              key={child.scopeNodeId}
              node={child}
            />
          ))}
        </div>
      ) : null}
      {expanded && node.hasMoreChildren ? (
        <p>Folder contains more items than this preview can show.</p>
      ) : null}
    </div>
  );
}

function buildScopeTree(nodes: SyncScopeNodeDto[]): SyncScopeTreeNode[] {
  const byId = new Map<string, SyncScopeTreeNode>(
    nodes.map((node) => [node.scopeNodeId, { ...node, children: [] }])
  );
  const roots: SyncScopeTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentScopeNodeId
      ? byId.get(node.parentScopeNodeId)
      : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function collectNodeIds(node: SyncScopeTreeNode): string[] {
  return [
    node.scopeNodeId,
    ...node.children.flatMap((child) => collectNodeIds(child))
  ];
}

function getTreeNodeSelectionState(
  node: SyncScopeTreeNode,
  selectedIds: Set<string>
): "selected" | "unselected" | "mixed" {
  const selectableIds = collectNodeIds(node).filter((id) => {
    if (id === node.scopeNodeId) return node.selectable;
    return findTreeNode(node.children, id)?.selectable;
  });
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
  if (selectedCount === 0) return "unselected";
  if (selectedCount === selectableIds.length) return "selected";
  return "mixed";
}

function findTreeNode(
  nodes: SyncScopeTreeNode[],
  nodeId: string
): SyncScopeTreeNode | undefined {
  for (const node of nodes) {
    if (node.scopeNodeId === nodeId) return node;
    const child = findTreeNode(node.children, nodeId);
    if (child) return child;
  }
  return undefined;
}

function isTreeNodeFullySelected(
  node: SyncScopeTreeNode,
  selectedIds: Set<string>
): boolean {
  return getTreeNodeSelectionState(node, selectedIds) === "selected";
}

function normalizeFolderSelections(
  nodes: SyncScopeTreeNode[],
  selectedIds: Set<string>
) {
  for (const node of nodes) {
    normalizeFolderSelections(node.children, selectedIds);
    if (node.nodeType !== "folder" || node.children.length === 0) continue;
    const selectableChildren = node.children.filter((child) => child.selectable);
    if (
      selectableChildren.length > 0 &&
      selectableChildren.every((child) => isTreeNodeFullySelected(child, selectedIds))
    ) {
      selectedIds.add(node.scopeNodeId);
    } else {
      selectedIds.delete(node.scopeNodeId);
    }
  }
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

function isGenericScopeNodeName(node: SyncScopeNodeDto): boolean {
  return getScopeNodeDisplayName(node).startsWith("Google Drive ");
}

function hasExpandableTreeNode(node: SyncScopeTreeNode): boolean {
  return (
    (node.nodeType === "folder" &&
      (node.children.length > 0 || node.hasMoreChildren === true)) ||
    node.children.some(hasExpandableTreeNode)
  );
}

function formatSelectedDriveItemCount(
  nodes: SyncScopeNodeDto[],
  selectedIds: Set<string>
): string {
  const selected = nodes.filter((node) => selectedIds.has(node.scopeNodeId));
  if (selected.length !== 1) return `${selected.length} Drive items selected`;
  return selected[0]?.nodeType === "folder"
    ? "1 Drive folder selected"
    : "1 Drive file selected";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Knowledge Base / RAG API could not be reached.";
}
