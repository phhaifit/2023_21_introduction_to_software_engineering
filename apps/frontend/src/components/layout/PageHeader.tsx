import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  onCreate?: () => void;
  eyebrow?: string;
  children?: ReactNode;
};

export function PageHeader({ title, onCreate, eyebrow = "Workspace", children }: PageHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
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
