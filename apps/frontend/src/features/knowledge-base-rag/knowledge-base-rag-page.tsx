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
  placeholderItems: string[];
};

const knowledgeBaseViews: KnowledgeBaseRagView[] = [
  {
    id: "documents",
    label: "Documents",
    shortLabel: "Docs",
    eyebrow: "Document list management",
    title: "Documents",
    description:
      "This placeholder will become the document list view for uploaded and synchronized knowledge files.",
    placeholderItems: [
      "Show uploaded and synchronized documents.",
      "Display metadata such as source, type, size, and updated date.",
      "Surface ingestion status without implementing the table in this issue."
    ]
  },
  {
    id: "upload-documents",
    label: "Upload Documents",
    shortLabel: "Upload",
    eyebrow: "Document upload",
    title: "Upload Documents",
    description:
      "This placeholder will become the upload flow for adding internal files to the workspace knowledge base.",
    placeholderItems: [
      "Provide a drag-and-drop upload area in a later issue.",
      "Show selected files and validation feedback in a later issue.",
      "Keep upload logic out of issue #36."
    ]
  },
  {
    id: "data-sources",
    label: "Data Sources",
    shortLabel: "Sources",
    eyebrow: "External knowledge sources",
    title: "Data Sources",
    description:
      "This placeholder will become the management view for external sources such as Google Drive, Notion, and Confluence.",
    placeholderItems: [
      "Show connected and not connected source cards later.",
      "Expose manual sync actions later.",
      "Keep OAuth and API integration out of issue #36."
    ]
  },
  {
    id: "synchronization-scope",
    label: "Synchronization Scope",
    shortLabel: "Scope",
    eyebrow: "Sync scope selection",
    title: "Synchronization Scope",
    description:
      "This placeholder will become the screen for selecting folders, pages, or spaces to synchronize.",
    placeholderItems: [
      "Show a hierarchical scope selector later.",
      "Display selected folders/pages summary later.",
      "Keep checkbox tree logic out of issue #36."
    ]
  },
  {
    id: "processing-status",
    label: "Processing Status",
    shortLabel: "Status",
    eyebrow: "Ingestion and sync monitoring",
    title: "Processing Status",
    description:
      "This placeholder will become the monitoring screen for ingestion and synchronization jobs.",
    placeholderItems: [
      "Show ingestion and synchronization job status later.",
      "Display progress and failure messages later.",
      "Keep processing tables and mock jobs out of issue #36."
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
            <p className="knowledge-base-rag-kicker">Phase 4 Prototype</p>
            <h1>Knowledge Base / RAG Management</h1>
            <p>
              Manage internal documents and synchronized knowledge sources before they
              are used by RAG-enabled agents.
            </p>
          </div>

          <div className="knowledge-base-rag-issue-badge">Issue #36</div>
        </header>

        <section className="knowledge-base-rag-content-card">
          <div className="knowledge-base-rag-content-header">
            <div>
              <p>{activeView.eyebrow}</p>
              <h2>{activeView.title}</h2>
            </div>
            <span>Placeholder view</span>
          </div>

          <p className="knowledge-base-rag-content-description">
            {activeView.description}
          </p>

          <div className="knowledge-base-rag-placeholder-grid">
            {activeView.placeholderItems.map((item) => (
              <div className="knowledge-base-rag-placeholder-item" key={item}>
                <span aria-hidden="true" />
                <p>{item}</p>
              </div>
            ))}
          </div>

          <div className="knowledge-base-rag-scope-note">
            <strong>Issue #36 scope:</strong> base layout, local navigation, active
            state, and placeholder content only. Detailed upload, validation, data
            source, synchronization, and processing logic will be implemented in later
            issues.
          </div>
        </section>
      </main>
    </section>
  );
}
