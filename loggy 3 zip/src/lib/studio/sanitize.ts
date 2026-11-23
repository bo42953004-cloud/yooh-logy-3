const EXTRA_KEYS = ["ts", "json", "md", "py"] as const;

/** Keeps the non-web languages (TypeScript, JSON Lines, Markdown, Python) from a request body. */
export function sanitizeExtra(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const key of EXTRA_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string") out[key] = value.slice(0, 200_000);
  }
  return out;
}
