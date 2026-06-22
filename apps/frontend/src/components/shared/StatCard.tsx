import { ReactNode } from "react";

interface StatCardProps {
  title?: string;
  label?: string; // backwards compatibility
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export function StatCard({ title, label, value, description, icon }: StatCardProps) {
  const displayTitle = title || label || "";
  return (
    <article className="stat-card">
      <div className="stat-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span>{displayTitle}</span>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <strong>{value}</strong>
      {description && (
        <p className="stat-card-desc" style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "12px" }}>
          {description}
        </p>
      )}
    </article>
  );
}
