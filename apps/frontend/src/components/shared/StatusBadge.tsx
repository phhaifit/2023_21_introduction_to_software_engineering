type StatusBadgeProps = {
  status: "Running" | "Completed" | "Draft";
};

const statusClass = {
  Running: "running",
  Completed: "completed",
  Draft: "draft",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${statusClass[status]}`}>{status}</span>;
}
