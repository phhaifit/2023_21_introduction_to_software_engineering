interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  
  let statusClass = "draft";
  if (normalizedStatus === "published") statusClass = "published";
  else if (normalizedStatus === "running") statusClass = "running";
  else if (normalizedStatus === "completed") statusClass = "completed";
  else if (normalizedStatus === "failed") statusClass = "failed";
  else if (normalizedStatus === "active") statusClass = "completed"; // map Active to completed green style
  else if (normalizedStatus === "inactive") statusClass = "draft"; // map Inactive to draft gray style
  else if (normalizedStatus === "draft") statusClass = "draft";
  else {
    statusClass = normalizedStatus;
  }

  return (
    <span className={`badge ${statusClass}`}>
      {status}
    </span>
  );
}
