import { useEffect, useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  SyncJobDto,
  SyncScopeNodeDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import type { ProcessingJobStatus, SyncScopeNodeType } from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-sync-scope.css";

const defaultApiClient = createKnowledgeBaseRagApiClient();

export type KnowledgeBaseSyncScopeScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
};

type SyncScopeTreeNode = SyncScopeNodeDto & {
  children: SyncScopeTreeNode[];
};

export function KnowledgeBaseSyncScopeScreen(props: KnowledgeBaseSyncScopeScreenProps) {
  const { apiClient = defaultApiClient, workspaceId = DEMO_WORKSPACE_ID } = props;
  const [scopeNodes, setScopeNodes] = useState<SyncScopeNodeDto[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJobDto[]>([]);
  const [selectedScopeNodeIds, setSelectedScopeNodeIds] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [operationState, setOperationState] = useState<"idle" | "saving" | "syncing">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const tree = useMemo(() => buildScopeTree(scopeNodes), [scopeNodes]);
  const metrics = useMemo(
    () => ({
      total: scopeNodes.length,
      selected: selectedScopeNodeIds.size,
      selectable: scopeNodes.filter((node) => node.selectable).length,
      syncJobs: syncJobs.length
    }),
    [scopeNodes, selectedScopeNodeIds, syncJobs]
  );
  const isBusy = operationState !== "idle";

  useEffect(() => {
    let isActive = true;

    setLoadState("loading");
    setErrorMessage(null);

    Promise.all([apiClient.getSyncScope(workspaceId), apiClient.listSyncJobs(workspaceId)])
      .then(([nodes, jobs]) => {
        if (!isActive) return;
        setScopeNodes(nodes);
        setSelectedScopeNodeIds(new Set(nodes.filter((node) => node.selected).map((node) => node.scopeNodeId)));
        setSyncJobs(jobs.items);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setScopeNodes([]);
        setSyncJobs([]);
        setSelectedScopeNodeIds(new Set());
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, retryKey, workspaceId]);

  function handleToggleScopeNode(node: SyncScopeNodeDto) {
    if (!node.selectable || isBusy) return;

    setSelectedScopeNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(node.scopeNodeId)) {
        nextIds.delete(node.scopeNodeId);
      } else {
        nextIds.add(node.scopeNodeId);
      }
      return nextIds;
    });
    setSuccessMessage(null);
  }

  async function handleSaveScope() {
    if (isBusy) return;

    setOperationState("saving");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedNodes = await apiClient.updateSyncScope(workspaceId, {
        selectedScopeNodeIds: [...selectedScopeNodeIds]
      });
      setScopeNodes(updatedNodes);
      setSelectedScopeNodeIds(
        new Set(updatedNodes.filter((node) => node.selected).map((node) => node.scopeNodeId))
      );
      setSuccessMessage("Synchronization scope updated.");
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
      const syncJob = await apiClient.requestManualSync(workspaceId, {
        scopeNodeIds: [...selectedScopeNodeIds]
      });
      setSyncJobs((currentJobs) => [syncJob, ...currentJobs]);
      setSuccessMessage("Manual sync requested.");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationState("idle");
    }
  }

  return (
    <div className="knowledge-base-rag-sync-scope">
      <div className="knowledge-base-rag-sync-scope-metrics" aria-label="Synchronization scope summary">
        <KnowledgeBaseMetricCard
          label="Scope nodes"
          value={metrics.total}
          helperText="External items available for sync"
        />
        <KnowledgeBaseMetricCard
          label="Selected"
          value={metrics.selected}
          helperText="Items included in sync scope"
        />
        <KnowledgeBaseMetricCard
          label="Selectable"
          value={metrics.selectable}
          helperText="Items users can include or exclude"
        />
        <KnowledgeBaseMetricCard
          label="Sync jobs"
          value={metrics.syncJobs}
          helperText="Manual or scheduled sync status"
        />
      </div>

      {successMessage ? (
        <div
          className="knowledge-base-rag-sync-scope-feedback knowledge-base-rag-sync-scope-feedback--success"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <KnowledgeBaseSectionCard
        title="Synchronization scope"
        eyebrow="Scope selection"
        description="Choose safe external source nodes to include in future synchronization."
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

        {errorMessage && loadState === "loaded" ? (
          <div className="knowledge-base-rag-sync-scope-feedback" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {loadState === "loaded" && tree.length > 0 ? (
          <>
            <div className="knowledge-base-rag-sync-scope-tree" role="tree">
              {tree.map((node) => (
                <SyncScopeTreeItem
                  key={node.scopeNodeId}
                  node={node}
                  onToggle={handleToggleScopeNode}
                  selectedScopeNodeIds={selectedScopeNodeIds}
                />
              ))}
            </div>

            <div className="knowledge-base-rag-sync-scope-actions" aria-label="Sync scope actions">
              <button type="button" disabled={isBusy} onClick={() => void handleSaveScope()}>
                {operationState === "saving" ? "Saving..." : "Save selection"}
              </button>
              <button
                type="button"
                disabled={isBusy || selectedScopeNodeIds.size === 0}
                onClick={() => void handleRequestManualSync()}
              >
                {operationState === "syncing" ? "Requesting..." : "Request manual sync"}
              </button>
            </div>
          </>
        ) : null}

        {loadState === "loaded" && tree.length === 0 ? (
          <KnowledgeBaseEmptyState
            title="No synchronization scope available"
            description="Connect a source placeholder before selecting sync scope."
          />
        ) : null}
      </KnowledgeBaseSectionCard>

      {loadState === "loaded" ? (
        <KnowledgeBaseSectionCard
          title="Sync jobs"
          eyebrow="Manual sync status"
          description="Review queued or recent sync requests without executing worker runtime in the UI."
        >
          {syncJobs.length > 0 ? (
            <div className="knowledge-base-rag-sync-job-list" role="list">
              {syncJobs.map((job, index) => (
                <SyncJobListItem
                  job={job}
                  key={`${job.jobId}-${job.requestedAt}-${index}`}
                />
              ))}
            </div>
          ) : (
            <KnowledgeBaseEmptyState
              title="No sync jobs available"
              description="Request manual sync to create a queued sync job."
            />
          )}
        </KnowledgeBaseSectionCard>
      ) : null}
    </div>
  );
}

type SyncScopeTreeItemProps = {
  node: SyncScopeTreeNode;
  onToggle: (node: SyncScopeNodeDto) => void;
  selectedScopeNodeIds: Set<string>;
};

function SyncScopeTreeItem({ node, onToggle, selectedScopeNodeIds }: SyncScopeTreeItemProps) {
  const isSelected = selectedScopeNodeIds.has(node.scopeNodeId);

  return (
    <div
      className={`knowledge-base-rag-sync-scope-node knowledge-base-rag-sync-scope-node--${node.nodeType}`}
      role="treeitem"
      aria-selected={isSelected}
    >
      <label>
        <input
          checked={isSelected}
          disabled={!node.selectable}
          onChange={() => onToggle(node)}
          type="checkbox"
        />
        <span>{node.name}</span>
      </label>
      <span className="knowledge-base-rag-sync-scope-node__type">
        {getNodeTypeLabel(node.nodeType)}
      </span>
      {node.children.length > 0 ? (
        <div className="knowledge-base-rag-sync-scope-node__children" role="group">
          {node.children.map((child) => (
            <SyncScopeTreeItem
              key={child.scopeNodeId}
              node={child}
              onToggle={onToggle}
              selectedScopeNodeIds={selectedScopeNodeIds}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SyncJobListItem({ job }: { job: SyncJobDto }) {
  return (
    <article className="knowledge-base-rag-sync-job" role="listitem">
      <div className="knowledge-base-rag-sync-job__header">
        <div>
          <h3>{job.jobId}</h3>
          <p>{job.failure?.errorMessage ?? "Manual sync request recorded."}</p>
        </div>
        <KnowledgeBaseStatusBadge status={mapSyncJobStatus(job.status)} />
      </div>
      <KnowledgeBaseMetadataList
        className="knowledge-base-rag-sync-job__metadata"
        items={[
          { label: "Requested", value: formatDate(job.requestedAt) },
          { label: "Scanned", value: job.scannedItemCount.toString() },
          { label: "Changed", value: job.changedItemCount.toString() }
        ]}
      />
    </article>
  );
}

function buildScopeTree(nodes: SyncScopeNodeDto[]): SyncScopeTreeNode[] {
  const nodesById = new Map<string, SyncScopeTreeNode>();
  const roots: SyncScopeTreeNode[] = [];

  for (const node of nodes) {
    nodesById.set(node.scopeNodeId, { ...node, children: [] });
  }

  for (const node of nodesById.values()) {
    if (node.parentScopeNodeId && nodesById.has(node.parentScopeNodeId)) {
      nodesById.get(node.parentScopeNodeId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getNodeTypeLabel(nodeType: SyncScopeNodeType): string {
  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
}

function mapSyncJobStatus(status: SyncJobDto["status"]): ProcessingJobStatus {
  if (status === "syncing") return "running";
  if (status === "completed" || status === "failed") return status;
  return "pending";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Knowledge Base / RAG API could not be reached.";
}
