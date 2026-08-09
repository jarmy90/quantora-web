/** Compare-basket logic (pure): up to 3 strategies, deduplicated, ordered. */
export const COMPARE_MAX = 3;

export function addToCompare(list: string[], id: string): string[] {
  if (list.includes(id)) return list;
  if (list.length >= COMPARE_MAX) return list;
  return [...list, id];
}

export function removeFromCompare(list: string[], id: string): string[] {
  return list.filter((x) => x !== id);
}
