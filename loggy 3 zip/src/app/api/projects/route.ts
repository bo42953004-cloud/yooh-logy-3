import { desc } from "drizzle-orm";
import { db, withDatabase } from "@/db";
import { projects } from "@/db/schema";
import { sanitizeExtra } from "@/lib/studio/sanitize";

export const dynamic = "force-dynamic";

const MAX_CODE = 200_000;

function text(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

/** Lists saved projects, most recently updated first (without the code bodies). */
export function GET() {
  return withDatabase(async () => {
    const rows = await db
      .select({ id: projects.id, name: projects.name, prompt: projects.prompt, updatedAt: projects.updatedAt })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    return Response.json({ projects: rows });
  });
}

/** Creates a project from { name, prompt, html, css, js, extra }. */
export function POST(request: Request) {
  return withDatabase(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Request body must be JSON." }, { status: 400 });

    const [row] = await db
      .insert(projects)
      .values({
        name: text(body.name, 120).trim() || "Untitled project",
        prompt: text(body.prompt, 4000),
        html: text(body.html, MAX_CODE),
        css: text(body.css, MAX_CODE),
        js: text(body.js, MAX_CODE),
        extra: sanitizeExtra(body.extra),
      })
      .returning();

    return Response.json({ project: row }, { status: 201 });
  });
}
