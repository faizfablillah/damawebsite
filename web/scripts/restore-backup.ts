// Restores a nightly backup (backups/dama-YYYY-MM-DD.json.gz, downloadable in Admin → Export).
//
//   npx tsx --env-file=.env.production.local scripts/restore-backup.ts <file.json.gz>            shows what it would do
//   npx tsx --env-file=.env.production.local scripts/restore-backup.ts <file.json.gz> --confirm  restores
//
// Replaces ALL data with the backup's (everyone is logged out). The current data is first saved to
// restore-safety-<time>.json.gz in this folder, so a restore can itself be undone.
// Uploaded files are not touched: they live in the storage bucket, not in the backup.
import fs from "node:fs";
import zlib from "node:zlib";
import { arg, connect, dump, saveLocal, TABLES, TRANSIENT } from "./db";

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: restore-backup.ts <backup.json.gz> [--confirm]");
  const backup = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  if (backup.format !== "dama-backup-v1") throw new Error("Not a DAMA backup file");
  // Insert parents before children whatever order the file lists them in
  const inFile = Object.keys(backup.tables);
  const order = [...TABLES.filter((t) => inFile.includes(t)), ...inFile.filter((t) => !TABLES.includes(t))];

  const db = await connect();
  console.log(`Target: ${db.label}`);
  console.log(`Backup from ${backup.createdAt}:`);
  for (const t of order) console.log(`  ${t.padEnd(18)} ${backup.tables[t].length} rows`);
  if (arg("confirm") === undefined) {
    console.log("\nDry run only. Add --confirm to replace the current data with this backup.");
    return db.close();
  }

  const safety = saveLocal("restore-safety", await dump(db.query, order));
  console.log(`\nCurrent data saved to ${safety}`);
  await db.transaction(async (q) => {
    await q(`truncate ${[...order, ...TRANSIENT].map((t) => `"${t}"`).join(", ")} cascade`);
    for (const t of order) {
      const rows = backup.tables[t];
      if (rows.length) await q(`insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::json)`, [JSON.stringify(rows)]);
    }
  });
  console.log("Restore complete. Everyone has been logged out.");
  await db.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
