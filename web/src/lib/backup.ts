import "server-only";
import zlib from "node:zlib";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { addDays, todayKL } from "./format";
import { deleteObject, listObjects, putObject } from "./storage";

// Nightly database backup: every table as JSON, gzipped, in the private bucket under backups/.
// Restore with `npx tsx scripts/restore-backup.ts <file>` (see the script for details).
export const BACKUP_PREFIX = "backups/";
export const BACKUP_KEEP_DAYS = 30;

// Short-lived security data is left out: logins, one-time links and rate-limit counters
const SKIP = new Set(["sessions", "auth_tokens", "auth_attempts"]);

// Parents before children, so a restore can insert them in this order (same list as scripts/db.ts)
export const BACKUP_TABLES = [
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
  "events",
  "event_registrations",
  "event_payments",
];

// A table added to the schema but not to the list above would silently be missing from backups
function checkCoverage() {
  const all = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable)).map((t) => getTableName(t));
  const missing = all.filter((t) => !SKIP.has(t) && !BACKUP_TABLES.includes(t));
  if (missing.length) throw new Error(`Backup table list is missing: ${missing.join(", ")}`);
}

type Rows = Record<string, unknown>[];

export async function createBackup() {
  checkCoverage();
  const db = await getDb();
  const tables: Record<string, Rows> = {};
  for (const name of BACKUP_TABLES) {
    const res = (await db.execute(sql`select coalesce(json_agg(t), '[]'::json) as data from ${sql.identifier(name)} t`)) as unknown;
    // PGlite returns { rows }, postgres-js returns the rows array
    const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { data: Rows | string }[];
    const data = rows[0].data;
    tables[name] = typeof data === "string" ? JSON.parse(data) : data;
  }
  const body = zlib.gzipSync(JSON.stringify({ format: "dama-backup-v1", createdAt: new Date().toISOString(), order: BACKUP_TABLES, tables }));
  const key = `${BACKUP_PREFIX}dama-${todayKL()}.json.gz`;
  await putObject(key, body, "application/gzip");

  // Keep the last BACKUP_KEEP_DAYS days
  const cutoff = addDays(todayKL(), -BACKUP_KEEP_DAYS);
  let removed = 0;
  for (const o of await listObjects(BACKUP_PREFIX)) {
    const day = o.key.match(/dama-(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1];
    if (day && day < cutoff) {
      await deleteObject(o.key);
      removed++;
    }
  }
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  return { key, bytes: body.length, removed, counts };
}

export async function listBackups() {
  const all = await listObjects(BACKUP_PREFIX);
  return all.filter((o) => o.key.endsWith(".json.gz")).sort((a, b) => b.key.localeCompare(a.key));
}
