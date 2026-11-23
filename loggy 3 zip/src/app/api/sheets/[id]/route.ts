import { eq } from "drizzle-orm";
import { db, withDatabase } from "@/db";
import { sheets } from "@/db/schema";
import { sanitizeCells } from "@/lib/sheet/sanitize";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function readId(context: Context): Promise<number | null> {
  const { id } = await context.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const invalidId = () => Response.json({ error: "Invalid id." }, { status: 400 });
const notFound = () => Response.json({ error: "Sheet not found." }, { status: 404 });

export function GET(_request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    const [row] = await db.select().from(sheets).where(eq(sheets.id, id)).limit(1);
    return row ? Response.json({ sheet: row }) : notFound();
  });
}

/** Saves the cell map and metadata of an existing spreadsheet. */
export function PUT(request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Request body must be JSON." }, { status: 400 });

    const patch: Partial<typeof sheets.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 120) || "Untitled sheet";
    if (body.data !== undefined) patch.data = sanitizeCells(body.data);
    if (typeof body.rowCount === "number" && Number.isFinite(body.rowCount)) {
      patch.rowCount = Math.min(100000, Math.max(10, Math.round(body.rowCount)));
    }

    const [row] = await db.update(sheets).set(patch).where(eq(sheets.id, id)).returning();
    return row ? Response.json({ sheet: row }) : notFound();
  });
}

export function DELETE(_request: Request, context: Context) {
  return withDatabase(async () => {
    const id = await readId(context);
    if (!id) return invalidId();

    await db.delete(sheets).where(eq(sheets.id, id));
    return Response.json({ ok: true });
  });
}
