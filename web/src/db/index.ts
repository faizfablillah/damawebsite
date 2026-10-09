import "server-only";
import path from "node:path";
import fs from "node:fs";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";

// Local development uses an embedded Postgres (PGlite) stored in DATA_DIR.
// Production sets DATABASE_URL (e.g. Supabase pooler, port 6543).
type DB = ReturnType<typeof drizzlePglite<typeof schema>>;

// turbopackIgnore: these are runtime paths, not files to bundle (migrations are included via next.config)
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data");
const MIGRATIONS = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

const g = globalThis as unknown as { __damaDb?: Promise<DB>; __damaMigrated?: boolean; __damaUsedAt?: number; __damaEnd?: () => Promise<void> };

// On Vercel the app is paused between requests; sockets to the database can die silently while
// paused, and a query sent on a dead socket hangs until the 300 s function timeout. So connections
// are closed after a few idle seconds, and after any longer gap the whole client is replaced.
const IDLE_SECONDS = 5;
const STALE_AFTER_MS = 10_000;

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: IDLE_SECONDS, max_lifetime: 60 * 10, connect_timeout: 10 });
    g.__damaEnd = () => client.end({ timeout: 30 });
    const db = drizzlePostgres(client, { schema });
    if (process.env.AUTO_MIGRATE !== "false" && !g.__damaMigrated) {
      await migratePostgres(db, { migrationsFolder: MIGRATIONS });
      g.__damaMigrated = true;
    }
    return db as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const client = new PGlite(path.join(DATA_DIR, "pglite"));
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db;
}

export function getDb(): Promise<DB> {
  const now = Date.now();
  if (g.__damaDb && process.env.DATABASE_URL && g.__damaUsedAt && now - g.__damaUsedAt > STALE_AFTER_MS) {
    // Quiet for a while (possibly paused): start a fresh client rather than trust old sockets
    const end = g.__damaEnd;
    g.__damaDb = undefined;
    end?.().catch(() => {});
  }
  g.__damaUsedAt = now;
  if (!g.__damaDb) g.__damaDb = create();
  return g.__damaDb;
}

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
