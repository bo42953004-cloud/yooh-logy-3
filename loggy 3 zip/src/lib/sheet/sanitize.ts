const ADDRESS_RE = /^[A-Z]{1,2}\d{1,4}$/;
const MAX_CELLS = 20000;
const MAX_CELL_LENGTH = 2000;

/** Keeps only well-formed cell addresses with string values. */
export function sanitizeCells(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string" || !ADDRESS_RE.test(key)) continue;
    if (value === "") continue;
    out[key] = value.slice(0, MAX_CELL_LENGTH);
    count++;
    if (count >= MAX_CELLS) break;
  }
  return out;
}
