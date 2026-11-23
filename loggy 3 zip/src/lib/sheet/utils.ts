export const MAX_COLS = 26;
export const DEFAULT_ROWS = 100;

/** 0 -> "A", 25 -> "Z" */
export function colToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "A" -> 0, "AA" -> 26 */
export function letterToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** "B3" -> { col: 1, row: 3 } (row is 1-based). Returns null when invalid. */
export function parseAddress(ref: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const col = letterToCol(m[1]);
  const row = Number(m[2]);
  if (col < 0 || row < 1) return null;
  return { col, row };
}

export function toAddress(col: number, row: number): string {
  return `${colToLetter(col)}${row}`;
}

/** Returns the largest row index that has any content, or 0. */
export function lastUsedRow(data: Record<string, string>): number {
  let last = 0;
  for (const key of Object.keys(data)) {
    if (!data[key] || data[key].trim() === "") continue;
    const addr = parseAddress(key);
    if (addr && addr.row > last) last = addr.row;
  }
  return last;
}
