import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseFileTypeBadge,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import { mockKnowledgeDocuments } from "./knowledge-base-rag-mock-data.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentSource,
  KnowledgeDocumentStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-documents.css";

const documentSourceLabels: Record<KnowledgeDocumentSource, string> = {
  upload: "Upload",
  "google-drive": "Google Drive",
  notion: "Notion",
  confluence: "Confluence"
};

export function KnowledgeBaseDocumentsScreen() {
  const documents = mockKnowledgeDocuments;
  const metrics = createDocumentMetrics(documents);

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
        {documents.length > 0 ? (
          <div className="knowledge-base-rag-document-list" role="list">
            {documents.map((document) => (
              <DocumentListItem document={document} key={document.id} />
            ))}
          </div>
        ) : (
          <KnowledgeBaseEmptyState
            title="No documents available"
            description="Add workspace documents to make internal knowledge available for retrieval."
          />
        )}
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
