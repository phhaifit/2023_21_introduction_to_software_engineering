import { FileEdit, CheckCircle2, Loader2, XCircle, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  
  let statusClass = "draft";
  let icon = <FileEdit size={14} strokeWidth={2.5} />;
  
  if (normalizedStatus === "published") {
    statusClass = "published";
    icon = <CheckCircle2 size={14} strokeWidth={2.5} />;
  } else if (normalizedStatus === "running") {
    statusClass = "running";
    icon = <Loader2 size={14} strokeWidth={2.5} style={{ animation: "spin 2s linear infinite" }} />;
  } else if (normalizedStatus === "completed" || normalizedStatus === "active" || normalizedStatus === "success") {
    statusClass = "completed";
    icon = <CheckCircle2 size={14} strokeWidth={2.5} />;
  } else if (normalizedStatus === "failed") {
    statusClass = "failed";
    icon = <AlertCircle size={14} strokeWidth={2.5} />;
  } else if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
    statusClass = "draft";
    icon = <XCircle size={14} strokeWidth={2.5} />;
  } else if (normalizedStatus === "inactive" || normalizedStatus === "draft") {
    statusClass = "draft";
    icon = <FileEdit size={14} strokeWidth={2.5} />;
  } else {
    statusClass = normalizedStatus;
  }

  // Generate a style string for border opacity since border-opacity isn't standard
  let borderColor = "rgba(71, 84, 103, 0.3)"; // default draft
  if (statusClass === "running") borderColor = "rgba(161, 98, 7, 0.3)";
  else if (statusClass === "completed") borderColor = "rgba(21, 128, 61, 0.3)";
  else if (statusClass === "failed") borderColor = "rgba(185, 28, 28, 0.3)";
  else if (statusClass === "published") borderColor = "rgba(99, 102, 241, 0.3)";

  return (
    <span 
      className={`badge ${statusClass}`} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '6px', 
        padding: '6px 12px', 
        borderRadius: '999px', 
        fontSize: '12px',
        fontWeight: 600,
        border: `1px solid ${borderColor}`,
        letterSpacing: '0.02em',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      {icon}
      <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </span>
  );
}
