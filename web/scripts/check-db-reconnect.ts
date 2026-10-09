// Checks the database client recovers after a pause (read-only). Run from web/:
//   node --conditions=react-server --env-file=.env.production.local --import tsx scripts/check-db-reconnect.ts
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";

async function round(label: string) {
  const db = await getDb();
  const t = Date.now();
  // Same shape as the admin dashboard: many queries at once
  await Promise.all(Array.from({ length: 13 }, () => db.execute(sql`select count(*) from memberships`)));
  console.log(`${label}: 13 parallel queries in ${Date.now() - t} ms`);
}

async function main() {
  process.env.AUTO_MIGRATE = "false";
  await round("first");
  await round("immediately again (same client)");
  console.log("waiting 12 s (longer than the 10 s stale limit)…");
  await new Promise((r) => setTimeout(r, 12_000));
  await round("after pause (fresh client)");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
