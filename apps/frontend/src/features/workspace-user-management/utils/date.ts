export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Never";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${hh}:${mm}, ${dd}/${month}/${yyyy}`;
}
