import { useMemo, useState } from "react";

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
    shortLabel: "Docs",
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
    shortLabel: "Upload",
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
    shortLabel: "Sources",
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
    shortLabel: "Scope",
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
    shortLabel: "Status",
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

export function KnowledgeBaseRagPage() {
  const [activeViewId, setActiveViewId] = useState<KnowledgeBaseRagViewId>("documents");

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
                  {view.shortLabel.slice(0, 1)}
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

        <section className="knowledge-base-rag-content-card">
          <div className="knowledge-base-rag-content-header">
            <div>
              <p>{activeView.eyebrow}</p>
              <h2>{activeView.title}</h2>
            </div>
          </div>

          <p className="knowledge-base-rag-content-description">
            {activeView.description}
          </p>

          <div className="knowledge-base-rag-summary-grid">
            {activeView.summaryItems.map((item) => (
              <div className="knowledge-base-rag-summary-item" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </section>
  );
}
