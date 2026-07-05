import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, BookOpen, Plus, Trash2 } from "lucide-react";

import type { AgentKnowledgeDocumentDto, KnowledgeDocumentDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeBaseRagApiClient } from "../knowledge-base-rag/knowledge-base-rag-api-client.ts";

type AgentKnowledgeAssignmentPanelProps = {
  workspaceId: EntityId<"workspaceId">;
  agentId: EntityId<"agentId">;
  apiClient: KnowledgeBaseRagApiClient;
  canManage: boolean;
};

export function AgentKnowledgeAssignmentPanel({
  workspaceId,
  agentId,
  apiClient,
  canManage
}: AgentKnowledgeAssignmentPanelProps) {
  const [documents, setDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [assignments, setAssignments] = useState<AgentKnowledgeDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] =
    useState<EntityId<"documentId"> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [documentResult, assignedResult] = await Promise.all([
        apiClient.listDocuments(workspaceId, { page: 1, pageSize: 100 }),
        apiClient.listAgentKnowledgeDocuments(workspaceId, agentId)
      ]);
      setDocuments(documentResult.items);
      setAssignments(
        assignedResult.filter(
          (assignment) =>
            assignment.workspaceId === workspaceId &&
            assignment.agentId === agentId &&
            assignment.grantStatus === "active"
        )
      );
    } catch {
      setDocuments([]);
      setAssignments([]);
      setError("Unable to load agent knowledge documents.");
    } finally {
      setIsLoading(false);
    }
  }, [agentId, apiClient, workspaceId]);

  useEffect(() => {
    setSuccess(null);
    void load();
  }, [load]);

  const assignedDocumentIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.document.documentId)),
    [assignments]
  );
  const availableDocuments = useMemo(
    () =>
      documents.filter(
        (document) => !assignedDocumentIds.has(document.documentId)
      ),
    [assignedDocumentIds, documents]
  );

  async function assign(document: KnowledgeDocumentDto) {
    if (pendingDocumentId) return;
    setPendingDocumentId(document.documentId);
    setError(null);
    setSuccess(null);
    try {
      const assignment = await apiClient.assignAgentKnowledgeDocument(
        workspaceId,
        agentId,
        document.documentId
      );
      setAssignments((current) => [
        ...current.filter(
          (item) => item.document.documentId !== document.documentId
        ),
        assignment
      ]);
      setSuccess(`${document.name} assigned.`);
    } catch {
      setError("Unable to assign document.");
    } finally {
      setPendingDocumentId(null);
    }
  }

  async function revoke(assignment: AgentKnowledgeDocumentDto) {
    if (pendingDocumentId) return;
    const { document } = assignment;
    setPendingDocumentId(document.documentId);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.revokeAgentKnowledgeDocument(
        workspaceId,
        agentId,
        document.documentId
      );
      setAssignments((current) =>
        current.filter(
          (item) => item.document.documentId !== document.documentId
        )
      );
      setSuccess(`${document.name} removed.`);
    } catch {
      setError("Unable to remove document.");
    } finally {
      setPendingDocumentId(null);
    }
  }

  return (
    <section
      className="agent-knowledge-panel"
      aria-labelledby="agent-knowledge-title"
      aria-busy={isLoading}
    >
      <div className="agent-info-dialog__section-title">
        <div>
          <h3 id="agent-knowledge-title">Assigned Knowledge</h3>
          <p>Document-level access used by future agent retrieval.</p>
        </div>
        {isLoading ? <span role="status">Loading knowledge...</span> : null}
      </div>

      {error ? (
        <div className="agent-info-dialog__error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <p>{error}</p>
            {isLoading ? null : (
              <button
                type="button"
                className="agent-secondary-button"
                onClick={() => void load()}
                disabled={Boolean(pendingDocumentId)}
                aria-label="Retry knowledge documents"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      ) : null}

      {success ? (
        <p className="agent-knowledge-panel__success" role="status">
          {success}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <div className="agent-knowledge-panel__columns">
          <KnowledgeList
            title="Assigned documents"
            emptyMessage="No knowledge documents are assigned."
            documents={assignments.map((assignment) => assignment.document)}
            action={(document) => {
              const assignment = assignments.find(
                (item) => item.document.documentId === document.documentId
              );
              return canManage && assignment ? (
                <button
                  type="button"
                  className="agent-secondary-button agent-secondary-button--danger"
                  onClick={() => void revoke(assignment)}
                  disabled={Boolean(pendingDocumentId)}
                  aria-label={`Remove ${document.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {pendingDocumentId === document.documentId ? "Removing..." : "Remove"}
                </button>
              ) : null;
            }}
          />
          <KnowledgeList
            title="Available documents"
            emptyMessage={
              documents.length === 0
                ? "No KB/RAG documents are available."
                : "All available documents are assigned."
            }
            documents={availableDocuments}
            action={(document) =>
              canManage ? (
                <button
                  type="button"
                  className="agent-secondary-button"
                  onClick={() => void assign(document)}
                  disabled={Boolean(pendingDocumentId)}
                  aria-label={`Assign ${document.name}`}
                >
                  <Plus size={14} aria-hidden="true" />
                  {pendingDocumentId === document.documentId ? "Assigning..." : "Assign"}
                </button>
              ) : null
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function KnowledgeList({
  title,
  emptyMessage,
  documents,
  action
}: {
  title: string;
  emptyMessage: string;
  documents: KnowledgeDocumentDto[];
  action: (document: KnowledgeDocumentDto) => ReactNode;
}) {
  return (
    <section className="agent-knowledge-panel__list" aria-label={title}>
      <h4>{title}</h4>
      {documents.length === 0 ? (
        <p className="agent-info-dialog__muted">{emptyMessage}</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.documentId}>
              <span className="agent-knowledge-panel__document">
                <BookOpen size={16} aria-hidden="true" />
                <span>
                  <strong>{document.name}</strong>
                  <small>{document.mediaType}</small>
                </span>
              </span>
              {action(document)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
