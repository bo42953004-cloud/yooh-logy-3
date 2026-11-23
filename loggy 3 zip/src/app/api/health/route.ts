import { sql } from "drizzle-orm";
import { databaseConfigured, db, describeDatabaseError, ensureSchema, DatabaseNotConfigured } from "@/db";

export const dynamic = "force-dynamic";

/** Reports whether the app and its database are ready. */
export async function GET() {
  if (!databaseConfigured()) {
    return Response.json(
      { ok: false, database: "missing", message: new DatabaseNotConfigured().message },
      { status: 503 },
    );
  }
  try {
    await ensureSchema();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch (err) {
    return Response.json({ ok: false, database: "error", message: describeDatabaseError(err) }, { status: 503 });
  }
}
