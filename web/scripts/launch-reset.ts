// Launch day: removes all test sign-ups, payments, receipts and logs, and restarts Member ID and
// receipt numbering at 0001. Keeps Settings (prices, bank details) and the accounts named in --keep.
//
//   npx tsx --env-file=.env.production.local scripts/launch-reset.ts --keep=you@example.com            shows what it would delete
//   npx tsx --env-file=.env.production.local scripts/launch-reset.ts --keep=you@example.com --confirm  does it
//
// Everything is first saved to launch-reset-backup-<time>.json.gz in this folder.
// Uploaded test files (payment proofs, student cards) are deleted from the bucket when S3_* settings
// are available; otherwise empty those folders in the Supabase dashboard (Storage → dama-files).
import { arg, connect, dump, saveLocal, TABLES, TRANSIENT } from "./db";

const WIPE = [
  "org_notes",
  "org_documents",
  "seat_requests",
  "seats",
  "receipts",
  "payments",
  "orders",
  "renewal_reminders",
  "memberships",
  "organisations",
  "email_log",
  "audit_log",
  "counters",
  ...TRANSIENT,
];
const FILE_FOLDERS = ["payment-proof/", "student-proof/", "corporate-docs/"];

async function main() {
  const keep = (arg("keep") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!keep.length) throw new Error("Name the account(s) to keep, e.g. --keep=you@example.com");
  const db = await connect();
  console.log(`Target: ${db.label}\n`);

  const users = (await db.query(`select email, role from users order by created_at`)) as { email: string; role: string }[];
  const missing = keep.filter((e) => !users.some((u) => u.email === e));
  if (missing.length) throw new Error(`No account for: ${missing.join(", ")}`);
  if (!users.some((u) => keep.includes(u.email) && u.role === "super_admin")) throw new Error("Keep at least one super admin account.");

  for (const t of WIPE) {
    const [{ n }] = await db.query(`select count(*)::int as n from "${t}"`);
    console.log(`  delete ${String(n).padStart(4)} rows from ${t}`);
  }
  const drop = users.filter((u) => !keep.includes(u.email));
  console.log(`  delete ${String(drop.length).padStart(4)} accounts: ${drop.map((u) => u.email).join(", ") || "-"}`);
  console.log(`  keep   ${keep.join(", ")} and all Settings`);
  if (arg("confirm") === undefined) {
    console.log("\nDry run only. Add --confirm to do it.");
    return db.close();
  }

  const file = saveLocal("launch-reset-backup", await dump(db.query, TABLES));
  console.log(`\nEverything saved first to ${file}`);
  await db.transaction(async (q) => {
    await q(`truncate ${WIPE.map((t) => `"${t}"`).join(", ")} cascade`);
    await q(`update settings set updated_by = null`);
    await q(`delete from users where not (email = any($1::text[]))`, [keep]);
  });
  console.log("Database reset. Member IDs and receipt numbers restart at 0001.");
  await db.close();

  if (!process.env.S3_BUCKET) {
    console.log(`\nNow delete the test uploads: Supabase → Storage → dama-files → folders ${FILE_FOLDERS.join(", ")}`);
    return;
  }
  const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  let removed = 0;
  for (const prefix of FILE_FOLDERS) {
    let token: string | undefined;
    do {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
      for (const o of res.Contents ?? []) {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: o.Key! }));
        removed++;
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  }
  console.log(`Deleted ${removed} uploaded test files.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
