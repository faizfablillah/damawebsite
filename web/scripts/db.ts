// Shared helpers for the maintenance scripts (run with tsx, outside Next.js).
// Production: pass the env file, e.g. `npx tsx --env-file=.env.production.local scripts/<script>.ts`.
// Without DATABASE_URL the scripts use the local embedded database in DATA_DIR (default .data).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export async function connect(): Promise<{
  query: Query;
  transaction: <T>(fn: (q: Query) => Promise<T>) => Promise<T>;
  label: string;
  close: () => Promise<void>;
}> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
    const wrap =
      (s: typeof sql): Query =>
      async (text, params = []) =>
        (await s.unsafe(text, params as never[])) as unknown as Record<string, unknown>[];
    return {
      query: wrap(sql),
      transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as typeof sql))) as never,
      label: `Postgres at ${new URL(url).hostname}`,
      close: () => sql.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.resolve(process.env.DATA_DIR || ".data", "pglite");
  if (!fs.existsSync(dir)) throw new Error(`No local database at ${dir}`);
  const db = new PGlite(dir);
  const wrap =
    (d: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Query =>
    async (text, params) =>
      (await d.query(text, params)).rows as Record<string, unknown>[];
  return {
    query: wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    label: `local database ${dir}`,
    close: () => db.close(),
  };
}

// Same table list (parents before children) and file format as src/lib/backup.ts
export const TABLES = [
  "users",
  "organisations",
  "org_notes",
  "org_documents",
  "memberships",
  "orders",
  "payments",
  "receipts",
  "seats",
  "seat_requests",
  "counters",
  "settings",
  "email_log",
  "renewal_reminders",
  "audit_log",
];
// Logins, one-time links and rate-limit counters: never backed up, cleared on restore
export const TRANSIENT = ["sessions", "auth_tokens", "auth_attempts"];

export async function dump(query: Query, tables = TABLES) {
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    const [row] = await query(`select coalesce(json_agg(x), '[]'::json) as data from "${t}" x`);
    out[t] = typeof row.data === "string" ? JSON.parse(row.data) : (row.data as unknown[]);
  }
  return { format: "dama-backup-v1", createdAt: new Date().toISOString(), order: tables, tables: out };
}

export function saveLocal(prefix: string, data: unknown) {
  const file = path.resolve(`${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(data)));
  return file;
}

// --name or --name=value; undefined when absent
export function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}
