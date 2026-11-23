import Link from "next/link";
import { databaseConfigured, DatabaseNotConfigured, db, describeDatabaseError, ensureSchema } from "@/db";
import { projects, sheets } from "@/db/schema";
import { desc } from "drizzle-orm";

type Recent = { id: number; name: string; updatedAt: Date };

/** Loads the recent lists; if the database is unavailable the page still renders. */
async function loadRecent(): Promise<{ projects: Recent[]; sheets: Recent[]; error: string | null }> {
  if (!databaseConfigured()) {
    return { projects: [], sheets: [], error: new DatabaseNotConfigured().message };
  }
  try {
    await ensureSchema();
    const [p, s] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, updatedAt: projects.updatedAt })
        .from(projects)
        .orderBy(desc(projects.updatedAt))
        .limit(5),
      db
        .select({ id: sheets.id, name: sheets.name, updatedAt: sheets.updatedAt })
        .from(sheets)
        .orderBy(desc(sheets.updatedAt))
        .limit(5),
    ]);
    return { projects: p, sheets: s, error: null };
  } catch (err) {
    return {
      projects: [],
      sheets: [],
      error: describeDatabaseError(err),
    };
  }
}

export const dynamic = "force-dynamic";

const features = {
  studio: [
    "Monaco editor (the engine behind VS Code) for HTML, CSS and JavaScript",
    "Build an attractive, responsive website from one sentence",
    "Non-stop writer: writes a burst of code, deletes half, and keeps going",
    "Live preview that updates as the code changes",
  ],
  sheet: [
    "Excel-style grid with formulas such as =SUM(A1:A10) and =IF(...)",
    "AI agent: plain-English tasks fill and compute cells for you",
    "Non-stop computing: writes rows of live formulas, clears half, repeats",
    "Save to PostgreSQL and export to CSV",
  ],
};

export default async function HomePage() {
  const { projects: recentProjects, sheets: recentSheets, error: dbError } = await loadRecent();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">AI workspace</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Write code and compute spreadsheets without stopping.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Two tools in one app: a VS Code-style studio that writes and builds websites, and an
          Excel-style sheet that computes tasks in cells continuously.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Link
            href="/studio"
            className="group rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-white/10"
          >
            <div className="text-3xl">🧑‍💻</div>
            <h2 className="mt-4 text-2xl font-semibold">Code Studio</h2>
            <p className="mt-2 text-slate-300">HTML · CSS · JavaScript with an AI writer</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              {features.studio.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-cyan-300">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-block rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 group-hover:bg-cyan-300">
              Open Code Studio →
            </span>
          </Link>

          <Link
            href="/sheet"
            className="group rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:-translate-y-1 hover:border-emerald-400/60 hover:bg-white/10"
          >
            <div className="text-3xl">📊</div>
            <h2 className="mt-4 text-2xl font-semibold">Spreadsheet</h2>
            <p className="mt-2 text-slate-300">Excel-style cells with an AI task agent</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              {features.sheet.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-300">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-block rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 group-hover:bg-emerald-300">
              Open Spreadsheet →
            </span>
          </Link>
        </div>

        {dbError && (
          <div className="mt-10 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5 text-sm text-amber-100">
            <p className="font-semibold">Database not connected</p>
            <p className="mt-1 text-amber-200/90">{dbError}</p>
            <p className="mt-2 text-amber-200/70">
              The studio and spreadsheet still work; saving and loading will be available once
              <code className="mx-1 rounded bg-black/30 px-1">DATABASE_URL</code> points at a PostgreSQL database.
            </p>
          </div>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recent projects</h3>
            {recentProjects.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No projects yet. Build your first website in Code Studio.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/10">
                {recentProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href="/studio" className="hover:text-cyan-300">
                      {p.name}
                    </Link>
                    <span className="text-xs text-slate-500">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recent spreadsheets</h3>
            {recentSheets.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No spreadsheets yet. Create one and save it.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/10">
                {recentSheets.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href="/sheet" className="hover:text-emerald-300">
                      {s.name}
                    </Link>
                    <span className="text-xs text-slate-500">{new Date(s.updatedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
