import { runSheetTask } from "@/lib/sheet/agent";

export const dynamic = "force-dynamic";

/** Runs a plain-English spreadsheet task and returns the cells it wants written. */
export async function POST(request: Request) {
  let body: { task?: unknown; data?: unknown };
  try {
    body = (await request.json()) as { task?: unknown; data?: unknown };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.slice(0, 500) : "";

  const data: Record<string, string> = {};
  if (body.data && typeof body.data === "object") {
    for (const [key, value] of Object.entries(body.data as Record<string, unknown>)) {
      if (typeof value === "string" && /^[A-Z]{1,2}\d{1,4}$/.test(key)) data[key] = value;
    }
  }

  return Response.json(runSheetTask(task, data));
}
