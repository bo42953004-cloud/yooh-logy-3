import { isFileKey, type FileKey } from "@/lib/studio/languages";
import { blockSize, blocksFor, snippetLines } from "@/lib/studio/snippets";
import { buildWebsite } from "@/lib/studio/website";

export const dynamic = "force-dynamic";

/** Hosts such as Vercel stop a function at its time limit. 60 seconds is allowed on every Vercel plan. */
export const maxDuration = 60;

/** One request never streams for longer than this, whatever speed was asked for. */
const MAX_STREAM_MS = 45_000;

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Streams generated code line by line as plain text.
 * - kind "website": "@@FILE:<name>" markers followed by index.html, styles.css and script.js.
 *   Optional `siteType` (Landing, Portfolio, Shop, Cafe, Blog, Fitness, Education, Event, Agency, SaaS).
 * - kind "snippet": `count` lines (or `blocks` whole blocks) in `language`, any supported language.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const kind = body.kind === "website" ? "website" : "snippet";
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : "";
  const siteType = typeof body.siteType === "string" ? body.siteType.slice(0, 20) : undefined;
  const delayMs = clamp(body.delayMs, 0, 500, 12);

  const language: FileKey = isFileKey(body.language) ? body.language : "html";

  // Either a line count ("about 200 lines") or an exact number of blocks (used when the client wants
  // the same cards in HTML, CSS and JS so the three files stay wired together).
  const requestedBlocks = Number(body.blocks);
  const snippetCount =
    Number.isFinite(requestedBlocks) && requestedBlocks > 0
      ? clamp(requestedBlocks, 1, 200, 1) * blockSize(language)
      : clamp(body.count, 1, 2000, 200);
  const snippetBlocks = kind === "snippet" ? blocksFor(language, snippetCount) : 0;
  const startSeq = clamp(body.seq, 1, 1_000_000, 1);

  // Everything is generated first, then sent line by line.
  const parts: { file?: string; lines: string[] }[] = [];
  if (kind === "website") {
    const files = buildWebsite(prompt, siteType);
    parts.push(
      { file: "index.html", lines: files.html.split("\n") },
      { file: "styles.css", lines: files.css.split("\n") },
      { file: "script.js", lines: files.js.split("\n") },
    );
  } else {
    parts.push({ lines: snippetLines(language, prompt, snippetCount, startSeq) });
  }

  // Slow the pace only as far as the time limit allows.
  const totalLines = parts.reduce((n, part) => n + part.lines.length, 0);
  const pause = Math.min(delayMs, Math.floor(MAX_STREAM_MS / Math.max(1, totalLines)));

  const signal = request.signal;
  let stopped = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const part of parts) {
          if (part.file) controller.enqueue(encoder.encode(`@@FILE:${part.file}\n`));
          for (const line of part.lines) {
            if (stopped || signal.aborted) return;
            controller.enqueue(encoder.encode(line + "\n"));
            if (pause > 0) await sleep(pause);
          }
        }
      } catch {
        // The reader went away mid-stream; nothing left to send.
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed or cancelled */
        }
      }
    },
    cancel() {
      stopped = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "X-Blocks": String(snippetBlocks),
    },
  });
}
