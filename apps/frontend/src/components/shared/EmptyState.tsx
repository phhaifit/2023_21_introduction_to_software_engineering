interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <article className="empty-state">
      <span className="empty-label">Notice</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}
