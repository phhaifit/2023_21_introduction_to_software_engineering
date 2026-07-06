import { useEffect, useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDocumentDto } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseFileTypeBadge,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import type {
  KnowledgeDocument,
  KnowledgeDocumentSource,
  KnowledgeDocumentType,
  KnowledgeDocumentStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-documents.css";

const defaultApiClient = createKnowledgeBaseRagApiClient();

const documentSourceLabels: Record<KnowledgeDocumentSource, string> = {
  upload: "Upload",
  "google-drive": "Google Drive",
  notion: "Notion",
  confluence: "Confluence"
};

export type KnowledgeBaseDocumentsScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  refreshKey?: number;
  workspaceId?: EntityId<"workspaceId">;
};

export function KnowledgeBaseDocumentsScreen(props: KnowledgeBaseDocumentsScreenProps) {
  const {
    apiClient = defaultApiClient,
    refreshKey = 0,
    workspaceId = DEMO_WORKSPACE_ID
  } = props;
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const metrics = useMemo(() => createDocumentMetrics(documents), [documents]);

  useEffect(() => {
    let isActive = true;

    setLoadState("loading");
    setErrorMessage(null);

    apiClient
      .listDocuments(workspaceId)
      .then((response) => {
        if (!isActive) return;
        setDocuments(response.items.map(toKnowledgeDocumentViewModel));
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setDocuments([]);
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, refreshKey, retryKey, workspaceId]);

  return (
    <div className="knowledge-base-rag-documents">
      <div className="knowledge-base-rag-documents-metrics" aria-label="Document summary">
        <KnowledgeBaseMetricCard
          label="Total documents"
          value={metrics.total}
          helperText="Documents available in this workspace"
        />
        <KnowledgeBaseMetricCard
          label="Ready"
          value={metrics.ready}
          helperText="Documents available for retrieval"
        />
        <KnowledgeBaseMetricCard
          label="Processing"
          value={metrics.processing}
          helperText="Documents being prepared"
        />
        <KnowledgeBaseMetricCard
          label="Failed"
          value={metrics.failed}
          helperText="Documents needing attention"
        />
      </div>

      <KnowledgeBaseSectionCard
        title="Workspace documents"
        eyebrow="Document inventory"
        description="Review uploaded and synchronized knowledge items prepared for workspace retrieval."
      >
        {loadState === "loading" ? (
          <div className="knowledge-base-rag-documents-feedback" role="status">
            Loading workspace documents...
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="knowledge-base-rag-documents-feedback" role="alert">
            <div>
              <h3>Unable to load documents</h3>
              <p>{errorMessage}</p>
            </div>
            <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {loadState === "loaded" && documents.length > 0 ? (
          <div className="knowledge-base-rag-document-list" role="list">
            {documents.map((document) => (
              <DocumentListItem document={document} key={document.id} />
            ))}
          </div>
        ) : null}

        {loadState === "loaded" && documents.length === 0 ? (
          <KnowledgeBaseEmptyState
            title="No documents available"
            description="Add workspace documents to make internal knowledge available for retrieval."
          />
        ) : null}
      </KnowledgeBaseSectionCard>
    </div>
  );
}

type DocumentListItemProps = {
  document: KnowledgeDocument;
};

function DocumentListItem({ document }: DocumentListItemProps) {
  const indexedMetric = getIndexedMetric(document);
  const description = document.summary ?? document.description ?? "No summary available.";

  return (
    <article className="knowledge-base-rag-document-item" role="listitem">
      <div className="knowledge-base-rag-document-item__main">
        <div className="knowledge-base-rag-document-item__title-row">
          <div>
            <h3>{document.name}</h3>
            <p>{description}</p>
          </div>
          <div className="knowledge-base-rag-document-item__badges">
            <KnowledgeBaseFileTypeBadge type={document.type} />
            <KnowledgeBaseStatusBadge status={document.status} />
          </div>
        </div>

        <KnowledgeBaseMetadataList
          className="knowledge-base-rag-document-item__metadata"
          items={[
            { label: "Source", value: documentSourceLabels[document.source] },
            { label: "Owner", value: document.owner },
            { label: "Updated", value: document.updatedAt },
            { label: indexedMetric.label, value: indexedMetric.value }
          ]}
        />
      </div>
    </article>
  );
}

function createDocumentMetrics(documents: KnowledgeDocument[]) {
  return {
    total: documents.length,
    ready: countDocumentsByStatus(documents, "ready"),
    processing: countDocumentsByStatus(documents, "processing"),
    failed: countDocumentsByStatus(documents, "failed")
  };
}

function countDocumentsByStatus(
  documents: KnowledgeDocument[],
  status: KnowledgeDocumentStatus
): number {
  return documents.filter((document) => document.status === status).length;
}

function getIndexedMetric(document: KnowledgeDocument) {
  if (typeof document.chunkCount === "number") {
    return {
      label: "Chunks",
      value: document.chunkCount.toString()
    };
  }

  return {
    label: "Indexed items",
    value: (document.indexedItemCount ?? 0).toString()
  };
}

function toKnowledgeDocumentViewModel(document: KnowledgeDocumentDto): KnowledgeDocument {
  return {
    id: document.documentId,
    name: document.name,
    source: mapDocumentSource(document.source),
    type: inferDocumentType(document.mediaType, document.name),
    sizeLabel: formatFileSize(document.sizeBytes),
    owner: "Workspace",
    updatedAt: formatDate(document.updatedAt),
    status: mapDocumentStatus(document.status),
    chunkCount: document.chunkCount,
    indexedItemCount: document.indexedChunkCount,
    summary: createDocumentSummary(document)
  };
}

function mapDocumentSource(source: KnowledgeDocumentDto["source"]): KnowledgeDocumentSource {
  return source === "google_drive" ? "google-drive" : source;
}

function mapDocumentStatus(status: KnowledgeIndexStatus): KnowledgeDocumentStatus {
  return status === "ingesting" ? "processing" : status;
}

function inferDocumentType(mediaType: string, fileName: string): KnowledgeDocumentType {
  const normalizedMediaType = mediaType.toLowerCase();
  const normalizedName = fileName.toLowerCase();

  if (normalizedMediaType.includes("pdf") || normalizedName.endsWith(".pdf")) return "pdf";
  if (
    normalizedMediaType.includes("word") ||
    normalizedMediaType.includes("officedocument") ||
    normalizedName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (normalizedMediaType.includes("csv") || normalizedName.endsWith(".csv")) return "csv";
  if (normalizedMediaType.includes("text") || normalizedName.endsWith(".txt")) return "txt";

  return "page";
}

function createDocumentSummary(document: KnowledgeDocumentDto): string {
  if (document.failure) {
    return document.failure.errorMessage;
  }

  return `${document.indexedChunkCount} of ${document.chunkCount} chunks indexed.`;
}

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
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
