export function getRelativeTime(isoString) {
  const now = new Date();
  const past = new Date(isoString);
  const diffMs = now.getTime() - past.getTime();

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isNew(isoString) {
  const now = new Date();
  const past = new Date(isoString);
  const diffHours = (now.getTime() - past.getTime()) / 3600000;
  return diffHours < 24;
}
