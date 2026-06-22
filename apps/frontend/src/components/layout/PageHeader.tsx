import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  onCreate?: () => void;
  eyebrow?: string;
  children?: ReactNode;
};

export function PageHeader({ title, description, onCreate, eyebrow = "Workspace", children }: PageHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && (
          <p className="page-subtitle" style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "14px" }}>
            {description}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {children}
        {onCreate && (
          <button className="primary-action" type="button" onClick={onCreate}>
            Create
          </button>
        )}
      </div>
    </header>
  );
}
