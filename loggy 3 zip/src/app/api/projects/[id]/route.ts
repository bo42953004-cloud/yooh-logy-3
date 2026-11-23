import { eq } from "drizzle-orm";
import { db, withDatabase } from "@/db";
import { projects } from "@/db/schema";
import { sanitizeExtra } from "@/lib/studio/sanitize";

export const dynamic = "force-dynamic";

const MAX_CODE = 200_000;

type Context = { params: Promise<{ id: string }> };

async function readId(context: Context): Promise<number | null> {
  const { id } = await context.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

const invalidId = () => Response.json({ error: "Invalid id." }, { status: 400 });
const notFound = () => Response.json({ error: "Project not found." }, { status: 404 });

export function GET(_request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return row ? Response.json({ project: row }) : notFound();
  });
}

/** Saves code and metadata for an existing project. */
export function PUT(request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Request body must be JSON." }, { status: 400 });

    const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
    const name = text(body.name, 120);
    if (name !== undefined) patch.name = name.trim() || "Untitled project";
    const prompt = text(body.prompt, 4000);
    if (prompt !== undefined) patch.prompt = prompt;
    const html = text(body.html, MAX_CODE);
    if (html !== undefined) patch.html = html;
    const css = text(body.css, MAX_CODE);
    if (css !== undefined) patch.css = css;
    const js = text(body.js, MAX_CODE);
    if (js !== undefined) patch.js = js;
    if (body.extra !== undefined) patch.extra = sanitizeExtra(body.extra);

    const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
    return row ? Response.json({ project: row }) : notFound();
  });
}

export function DELETE(_request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    await db.delete(projects).where(eq(projects.id, id));
    return Response.json({ ok: true });
  });
}
