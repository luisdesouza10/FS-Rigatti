export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalized terms with naive plural stemming (notebooks → notebook). */
export function searchTerms(query: string): string[] {
  return normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
    .slice(0, 8);
}
