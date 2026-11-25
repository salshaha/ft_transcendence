export function upsertById(items, item) {
  if (!item || item.id === undefined || item.id === null) return items;
  const exists = items.some((existing) => existing.id === item.id);
  return exists
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export function removeById(items, id) {
  return items.filter((item) => item.id !== id);
}
