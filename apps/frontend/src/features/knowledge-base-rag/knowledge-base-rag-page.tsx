import { useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

import { KnowledgeBaseDataSourcesScreen } from "./knowledge-base-rag-data-sources.tsx";
import { KnowledgeBaseDocumentsScreen } from "./knowledge-base-rag-documents.tsx";
import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import { KnowledgeBaseProcessingStatusScreen } from "./knowledge-base-rag-processing-status.tsx";
import { KnowledgeBaseSyncScopeScreen } from "./knowledge-base-rag-sync-scope.tsx";
import { KnowledgeBaseUploadScreen } from "./knowledge-base-rag-upload.tsx";
import "./knowledge-base-rag-view.css";

type KnowledgeBaseRagViewId =
  | "documents"
  | "upload-documents"
  | "data-sources"
  | "synchronization-scope"
  | "processing-status";

type KnowledgeBaseRagView = {
  id: KnowledgeBaseRagViewId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  summaryItems: string[];
};

const knowledgeBaseViews: KnowledgeBaseRagView[] = [
  {
    id: "documents",
    label: "Documents",
    shortLabel: "D",
    eyebrow: "Document list management",
    title: "Documents",
    description:
      "View uploaded and synchronized knowledge files prepared for workspace agents.",
    summaryItems: [
      "Browse internal and synchronized workspace documents.",
      "Review source, file type, size, and last updated metadata.",
      "Monitor document readiness and ingestion status."
    ]
  },
  {
    id: "upload-documents",
    label: "Upload Documents",
    shortLabel: "U",
    eyebrow: "Document upload",
    title: "Upload Documents",
    description:
      "Add internal files to the workspace knowledge base for future processing and retrieval.",
    summaryItems: [
      "Upload supported knowledge files from the workspace.",
      "Review selected files before adding them to the knowledge base.",
      "Prepare documents for ingestion and indexing."
    ]
  },
  {
    id: "data-sources",
    label: "Data Sources",
    shortLabel: "D",
    eyebrow: "External knowledge sources",
    title: "Data Sources",
    description: "Manage external knowledge sources connected to the workspace.",
    summaryItems: [
      "Review available sources such as Google Drive, Notion, and Confluence.",
      "Check connection status for each external source.",
      "Prepare source content for synchronization."
    ]
  },
  {
    id: "synchronization-scope",
    label: "Synchronization Scope",
    shortLabel: "S",
    eyebrow: "Sync scope selection",
    title: "Synchronization Scope",
    description:
      "Select which external folders, pages, or spaces should be included in synchronization.",
    summaryItems: [
      "Choose the content areas that belong in the workspace knowledge base.",
      "Review selected synchronization scope before syncing.",
      "Keep external knowledge sources organized by workspace needs."
    ]
  },
  {
    id: "processing-status",
    label: "Processing Status",
    shortLabel: "P",
    eyebrow: "Ingestion and sync monitoring",
    title: "Processing Status",
    description:
      "Monitor document ingestion and synchronization activity across the knowledge base.",
    summaryItems: [
      "Track processing status for uploaded and synchronized content.",
      "Review progress, completion, and failure states.",
      "Identify knowledge items that need attention."
    ]
  }
];

const defaultApiClient = createKnowledgeBaseRagApiClient();

export type KnowledgeBaseRagPageProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
};

export function KnowledgeBaseRagPage(props: KnowledgeBaseRagPageProps = {}) {
  const { apiClient = defaultApiClient, workspaceId = DEMO_WORKSPACE_ID } = props;
  const [activeViewId, setActiveViewId] = useState<KnowledgeBaseRagViewId>("documents");
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);

  const activeView = useMemo(
    () =>
      knowledgeBaseViews.find((view) => view.id === activeViewId) ??
      knowledgeBaseViews[0],
    [activeViewId]
  );

  return (
    <section className="knowledge-base-rag-shell" aria-label="Knowledge Base RAG Management">
      <aside className="knowledge-base-rag-sidebar">
        <div className="knowledge-base-rag-brand">
          <div className="knowledge-base-rag-logo" aria-hidden="true">
            K
          </div>
          <div>
            <p className="knowledge-base-rag-brand-title">Knowledge Base</p>
            <p className="knowledge-base-rag-brand-subtitle">Manager</p>
          </div>
        </div>

        <nav className="knowledge-base-rag-nav" aria-label="Knowledge Base views">
          {knowledgeBaseViews.map((view) => {
            const isActive = view.id === activeView.id;

            return (
              <button
                key={view.id}
                type="button"
                className={`knowledge-base-rag-nav-item${
                  isActive ? " knowledge-base-rag-nav-item-active" : ""
                }`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveViewId(view.id)}
              >
                <span className="knowledge-base-rag-nav-icon" aria-hidden="true">
                  {view.shortLabel}
                </span>
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="knowledge-base-rag-main">
        <header className="knowledge-base-rag-header">
          <div>
            <p className="knowledge-base-rag-kicker">Workspace Knowledge</p>
            <h1>Knowledge Base / RAG Management</h1>
            <p>
              Manage internal documents and synchronized knowledge sources before they
              are used by RAG-enabled agents.
            </p>
          </div>
        </header>

        {activeView.id === "documents" && (
          <KnowledgeBaseDocumentsScreen
            apiClient={apiClient}
            refreshKey={documentsRefreshKey}
            workspaceId={workspaceId}
          />
        )}
        {activeView.id === "upload-documents" && (
          <KnowledgeBaseUploadScreen
            apiClient={apiClient}
            onUploadPrepared={() => setDocumentsRefreshKey((current) => current + 1)}
            workspaceId={workspaceId}
          />
        )}
        {activeView.id === "data-sources" && (
          <KnowledgeBaseDataSourcesScreen apiClient={apiClient} workspaceId={workspaceId} />
        )}
        {activeView.id === "synchronization-scope" && (
          <KnowledgeBaseSyncScopeScreen apiClient={apiClient} workspaceId={workspaceId} />
        )}
        {activeView.id === "processing-status" && <KnowledgeBaseProcessingStatusScreen />}
      </main>
    </section>
  );
}
