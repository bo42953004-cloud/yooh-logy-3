import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * Database access built for serverless hosts such as Vercel:
 * - Nothing connects (or throws) at import time, so `next build` works with no database settings.
 * - The address is read from DATABASE_URL, or from the POSTGRES_* names Vercel's database
 *   integrations create.
 * - Encryption is decided here, because the driver would otherwise let the address override it.
 * - A database that cannot be reached fails after a few seconds instead of hanging the request.
 * - The tables are created on first use, safely even when several instances start at once.
 */

const globalForDb = globalThis as typeof globalThis & {
  __appPgPool?: Pool;
  __appDb?: NodePgDatabase;
  __appSchemaReady?: Promise<void>;
  __appDbFailure?: { at: number; error: unknown };
};

const CONNECT_TIMEOUT_MS = 8000;
/** After a failed connection, later requests fail at once for this long instead of each waiting. */
const RETRY_AFTER_MS = 10_000;
/** Any fixed number: instances that start together take turns creating the tables. */
const SCHEMA_LOCK_ID = 4917201;

const URL_VARIABLES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("No database is connected. Add DATABASE_URL in your hosting settings.");
    this.name = "DatabaseNotConfigured";
  }
}

function databaseUrl(): string | undefined {
  for (const name of URL_VARIABLES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function databaseConfigured(): boolean {
  return Boolean(databaseUrl());
}

function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"].includes(host);
}

type Ssl = PoolConfig["ssl"];
const ENCRYPT: Ssl = { rejectUnauthorized: false };
const ENCRYPT_AND_VERIFY: Ssl = { rejectUnauthorized: true };

/**
 * Works out the connection settings. `sslmode` and `ssl` are taken out of the address and applied
 * here: the driver gives the address priority over these settings, and reads sslmode=require as
 * "verify the certificate", which fails for databases whose certificate is not publicly signed.
 *
 * Encryption is on for every remote database. The certificate is checked only when asked for,
 * with sslmode=verify-full in the address or DATABASE_SSL=verify.
 */
export function connectionSettings(raw: string, sslSetting = process.env.DATABASE_SSL ?? ""): PoolConfig {
  let connectionString = raw;
  let host = "";
  let mode = "";
  try {
    const url = new URL(raw);
    const params = url.searchParams;
    host = url.hostname;
    if (params.has("sslmode")) mode = (params.get("sslmode") ?? "").toLowerCase();
    else if (params.has("ssl")) mode = /^(0|false|off|no)$/i.test(params.get("ssl") ?? "") ? "disable" : "require";
    if (params.has("sslmode") || params.has("ssl") || params.has("uselibpqcompat")) {
      params.delete("sslmode");
      params.delete("ssl");
      params.delete("uselibpqcompat");
      connectionString = url.toString();
    }
  } catch {
    // Not a URL (for example a socket path): hand it to the driver untouched.
  }

  const setting = sslSetting.trim().toLowerCase();
  let ssl: Ssl;
  if (/^(false|0|off|no|disable)$/.test(setting)) ssl = undefined;
  else if (/^(verify|verify-full|verify-ca|strict)$/.test(setting)) ssl = ENCRYPT_AND_VERIFY;
  else if (/^(true|1|on|yes|require)$/.test(setting)) ssl = ENCRYPT;
  else if (mode === "disable") ssl = undefined;
  else if (mode === "verify-full" || mode === "verify-ca") ssl = ENCRYPT_AND_VERIFY;
  else if (mode) ssl = ENCRYPT;
  else ssl = host && !isLocalHost(host) ? ENCRYPT : undefined;

  return { connectionString, ssl, max: 3, connectionTimeoutMillis: CONNECT_TIMEOUT_MS, idleTimeoutMillis: 20_000 };
}

export function getPool(): Pool {
  if (!globalForDb.__appPgPool) {
    const raw = databaseUrl();
    if (!raw) throw new DatabaseNotConfigured();
    const pool = new Pool(connectionSettings(raw));
    // A hosted database closes idle connections routinely. Without a listener, that error
    // would stop the whole server process.
    pool.on("error", (err) => {
      console.warn("An idle database connection was closed:", err.message);
    });
    globalForDb.__appPgPool = pool;
  }
  return globalForDb.__appPgPool;
}

/** Drizzle client. Created lazily on first access. */
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    if (!globalForDb.__appDb) globalForDb.__appDb = drizzle(getPool());
    const value = Reflect.get(globalForDb.__appDb, prop, receiver);
    return typeof value === "function" ? value.bind(globalForDb.__appDb) : value;
  },
});

/** Returns two rows when both tables already have everything the app needs. */
const SCHEMA_READY_SQL = `
SELECT 1 FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = 'projects' AND column_name = 'extra'
UNION ALL
SELECT 1 FROM information_schema.tables
  WHERE table_schema = current_schema() AND table_name = 'sheets'
`;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "prompt" text DEFAULT '' NOT NULL,
  "html" text DEFAULT '' NOT NULL,
  "css" text DEFAULT '' NOT NULL,
  "js" text DEFAULT '' NOT NULL,
  "extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "extra" jsonb DEFAULT '{}'::jsonb NOT NULL;
CREATE TABLE IF NOT EXISTS "sheets" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "row_count" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;

async function createSchema(): Promise<void> {
  const pool = getPool();
  const ready = await pool.query(SCHEMA_READY_SQL);
  if (ready.rowCount === 2) return;

  // Several instances can start at the same moment on an empty database. The lock makes them
  // take turns; without it PostgreSQL rejects the losers with a duplicate-key error.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(${SCHEMA_LOCK_ID})`);
    await client.query(CREATE_TABLES_SQL);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Makes sure the tables exist. Runs once per server process and is free afterwards.
 * Call this at the start of any request handler that touches the database.
 */
export function ensureSchema(): Promise<void> {
  const failure = globalForDb.__appDbFailure;
  if (failure && Date.now() - failure.at < RETRY_AFTER_MS) return Promise.reject(failure.error);

  if (!globalForDb.__appSchemaReady) {
    globalForDb.__appSchemaReady = createSchema().then(
      () => {
        globalForDb.__appDbFailure = undefined;
      },
      (err: unknown) => {
        // Forget the attempt so a later request tries again.
        globalForDb.__appSchemaReady = undefined;
        globalForDb.__appDbFailure = { at: Date.now(), error: err };
        if (!(err instanceof DatabaseNotConfigured)) console.error("Database connection failed:", err);
        throw err;
      },
    );
  }
  return globalForDb.__appSchemaReady;
}

/** A short, plain explanation of a database problem that is safe to show on the page. */
export function describeDatabaseError(err: unknown): string {
  if (err instanceof DatabaseNotConfigured) return err.message;
  const { code = "", message = "" } = (err ?? {}) as { code?: string; message?: string };
  if (code === "ETIMEDOUT" || /timeout/i.test(message)) return "The database did not answer in time.";
  if (["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"].includes(code)) {
    return "The database address could not be reached.";
  }
  if (code === "28P01" || code === "28000") return "The database rejected the username or password.";
  if (code === "3D000") return "The database named in the address does not exist.";
  if (/certificate|self-signed/i.test(message)) {
    return "The database's security certificate was not accepted. Remove DATABASE_SSL=verify or sslmode=verify-full.";
  }
  return "The database is not available right now.";
}

/**
 * Runs a request handler that needs the database. If the database is missing or unreachable the
 * caller gets a clear JSON message instead of an empty error page.
 */
export async function withDatabase(run: () => Promise<Response>): Promise<Response> {
  try {
    await ensureSchema();
  } catch (err) {
    return Response.json(
      { error: `Saving and loading are unavailable. ${describeDatabaseError(err)}` },
      { status: 503 },
    );
  }
  try {
    return await run();
  } catch (err) {
    console.error("Request failed:", err);
    return Response.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
  }
}
