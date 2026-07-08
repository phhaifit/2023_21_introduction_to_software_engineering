import type { ReactNode } from "react";

import type {
  ExternalDataSourceStatus,
  KnowledgeDocumentStatus,
  KnowledgeDocumentType,
  ProcessingJobStatus,
  SyncJobStatus,
  UploadValidationStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-components.css";

export type KnowledgeBaseStatus =
  | KnowledgeDocumentStatus
  | UploadValidationStatus
  | ProcessingJobStatus
  | ExternalDataSourceStatus
  | SyncJobStatus;

type KnowledgeBaseStatusBadgeProps = { status: KnowledgeBaseStatus; className?: string };
type KnowledgeBaseSectionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};
type KnowledgeBaseMetricCardProps = {
  label: string;
  value: ReactNode;
  helperText?: string;
  className?: string;
};
type KnowledgeBaseProgressBarProps = { value: number; label?: string; className?: string };
type KnowledgeBaseEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};
type KnowledgeBaseMetadataItem = { label: string; value: ReactNode };
type KnowledgeBaseMetadataListProps = {
  items: KnowledgeBaseMetadataItem[];
  className?: string;
};
type KnowledgeBaseFileTypeBadgeProps = { type: KnowledgeDocumentType; className?: string };
type KnowledgeBaseTabItem = { id: string; label: string };
type KnowledgeBaseTabsProps = {
  items: KnowledgeBaseTabItem[];
  activeItemId: string;
  onSelect: (itemId: string) => void;
  className?: string;
};

const statusLabels: Record<KnowledgeBaseStatus, string> = {
  ready: "Ready",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
  valid: "Valid",
  invalid: "Invalid",
  running: "Running",
  completed: "Completed",
  connected: "Connected",
  "not-connected": "Not connected",
  syncing: "Syncing"
};

const fileTypeLabels: Record<KnowledgeDocumentType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  csv: "CSV",
  markdown: "MD",
  page: "Page"
};

export function KnowledgeBaseStatusBadge({ status, className }: KnowledgeBaseStatusBadgeProps) {
  return (
    <span
      className={joinClassNames(
        "kb-rag-status-badge",
        `kb-rag-status-badge--${status}`,
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function KnowledgeBaseSectionCard(props: KnowledgeBaseSectionCardProps) {
  const { title, eyebrow, description, children, className } = props;

  return (
    <section className={joinClassNames("kb-rag-section-card", className)}>
      <div className="kb-rag-section-card__header">
        {eyebrow ? <p className="kb-rag-section-card__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? (
          <p className="kb-rag-section-card__description">{description}</p>
        ) : null}
      </div>
      <div className="kb-rag-section-card__body">{children}</div>
    </section>
  );
}

export function KnowledgeBaseMetricCard(props: KnowledgeBaseMetricCardProps) {
  const { label, value, helperText, className } = props;

  return (
    <article className={joinClassNames("kb-rag-metric-card", className)}>
      <p className="kb-rag-metric-card__label">{label}</p>
      <p className="kb-rag-metric-card__value">{value}</p>
      {helperText ? <p className="kb-rag-metric-card__helper">{helperText}</p> : null}
    </article>
  );
}

export function KnowledgeBaseProgressBar({ value, label, className }: KnowledgeBaseProgressBarProps) {
  const progressValue = clampProgress(value);

  return (
    <div className={joinClassNames("kb-rag-progress", className)}>
      {label ? <p className="kb-rag-progress__label">{label}</p> : null}
      <div
        className="kb-rag-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        aria-label={label ?? "Progress"}
      >
        <span
          className="kb-rag-progress__bar"
          style={{ width: `${progressValue}%` }}
        />
      </div>
      <span className="kb-rag-progress__value">{progressValue}%</span>
    </div>
  );
}

export function KnowledgeBaseEmptyState(props: KnowledgeBaseEmptyStateProps) {
  const { title, description, action, className } = props;

  return (
    <div className={joinClassNames("kb-rag-empty-state", className)}>
      <div className="kb-rag-empty-state__icon" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="kb-rag-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function KnowledgeBaseMetadataList({ items, className }: KnowledgeBaseMetadataListProps) {
  return (
    <dl className={joinClassNames("kb-rag-metadata-list", className)}>
      {items.map((item) => (
        <div className="kb-rag-metadata-list__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KnowledgeBaseFileTypeBadge({ type, className }: KnowledgeBaseFileTypeBadgeProps) {
  return (
    <span
      className={joinClassNames(
        "kb-rag-file-type-badge",
        `kb-rag-file-type-badge--${type}`,
        className
      )}
    >
      {fileTypeLabels[type]}
    </span>
  );
}

export function KnowledgeBaseTabs(props: KnowledgeBaseTabsProps) {
  const { items, activeItemId, onSelect, className } = props;

  return (
    <div className={joinClassNames("kb-rag-tabs", className)} role="list">
      {items.map((item) => {
        const isActive = item.id === activeItemId;

        return (
          <button
            key={item.id}
            type="button"
            className={joinClassNames(
              "kb-rag-tabs__item",
              isActive ? "kb-rag-tabs__item--active" : undefined
            )}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
