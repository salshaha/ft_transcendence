export function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatBytes(value) {
  if (value === null || value === undefined) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusTone(status) {
  switch (status) {
    case "done":
    case "on_time":
      return "bg-[#dff8f3] text-[#135D66]";
    case "late":
    case "overdue":
      return "bg-[#fdece6] text-[#a94646]";
    case "review":
      return "bg-[#eef0ff] text-[#4f46a5]";
    case "in_progress":
      return "bg-[#fff4d6] text-[#8a6210]";
    default:
      return "bg-[#eef2f2] text-[#587376]";
  }
}
