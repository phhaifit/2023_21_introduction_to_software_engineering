import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  children: ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <article className="panel">
      {title && (
        <div className="panel-heading">
          <h2>{title}</h2>
        </div>
      )}
      {children}
    </article>
  );
}
