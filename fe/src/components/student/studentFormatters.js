export const PROFICIENCY_LEVELS = [
  { value: 1, label: "Beginner" },
  { value: 2, label: "Intermediate" },
  { value: 3, label: "Advanced" },
  { value: 4, label: "Expert" },
];

export function proficiencyLabel(level) {
  const numeric = Number(level);
  return (
    PROFICIENCY_LEVELS.find((item) => item.value === numeric)?.label ||
    (numeric >= 4 ? "Expert" : "Intermediate")
  );
}

export function resolvePresence(presence, user) {
  const key = String(user?.id)
  const users = presence?.users || {}
  if (Object.prototype.hasOwnProperty.call(users, key)) {
    return {
      online: Boolean(users[key].online),
      last_seen: users[key].last_seen,
    }
  }
  return {
    online: Boolean(user?.is_online),
    last_seen: user?.last_seen,
  }
}

export function formatLastSeen(value) {
  if (!value) return "Last seen unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last seen unknown";
  return `Last seen ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
