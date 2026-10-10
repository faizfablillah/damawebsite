// Removes named accounts with everything they own (memberships, orders, payments, receipts, their
// corporate organisations and uploads), keeps everyone else's data, and restarts Member ID and
// receipt numbering after the highest number still in use (at 0001 when none is left).
// Use it instead of launch-reset.ts when a real application is already waiting and must be kept.
//
//   npx tsx --env-file=.env.production.local scripts/remove-accounts.ts --remove=a@x.com,b@y.com            shows what it would delete
//   npx tsx --env-file=.env.production.local scripts/remove-accounts.ts --remove=a@x.com,b@y.com --confirm  does it
//
// Everything is first saved to remove-accounts-backup-<time>.json.gz in this folder.
import { arg, connect, dump, saveLocal, TABLES } from "./db";

async function main() {
  const emails = (arg("remove") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) throw new Error("Name the account(s) to remove, e.g. --remove=test@example.com");
  const db = await connect();
  console.log(`Target: ${db.label}\n`);

  const users = (await db.query(`select id, email, role from users`)) as { id: string; email: string; role: string }[];
  const missing = emails.filter((e) => !users.some((u) => u.email === e));
  if (missing.length) throw new Error(`No account for: ${missing.join(", ")}`);
  const ids = users.filter((u) => emails.includes(u.email)).map((u) => u.id);
  if (!users.some((u) => !ids.includes(u.id) && u.role === "super_admin")) throw new Error("At least one super admin must remain.");

  const orgs = (await db.query(`select id, name from organisations where contact_user_id = any($1::uuid[])`, [ids])) as { id: string; name: string }[];
  const orgIds = orgs.map((o) => o.id);
  const ms = (await db.query(
    `select m.id, m.member_code, m.status, coalesce(u.email, o.name) as owner from memberships m
       left join users u on u.id = m.user_id left join organisations o on o.id = m.organisation_id
      where m.user_id = any($1::uuid[]) or m.organisation_id = any($2::uuid[]) order by m.created_at`,
    [ids, orgIds],
  )) as { id: string; member_code: string | null; status: string; owner: string }[];
  const msIds = ms.map((m) => m.id);
  const receipts = (await db.query(`select r.receipt_no from receipts r join orders o on o.id = r.order_id where o.membership_id = any($1::uuid[])`, [msIds])) as {
    receipt_no: string;
  }[];
  const files = (
    (await db.query(
      `select p.proof_key as key from payments p join orders o on o.id = p.order_id where o.membership_id = any($1::uuid[]) and p.proof_key is not null
       union all select student_proof_key from memberships where id = any($1::uuid[]) and student_proof_key is not null
       union all select file_key from org_documents where organisation_id = any($2::uuid[])
       union all select ep.proof_key from event_payments ep join event_registrations r on r.id = ep.registration_id where r.user_id = any($3::uuid[]) and ep.proof_key is not null`,
      [msIds, orgIds, ids],
    )) as { key: string }[]
  ).map((f) => f.key);

  console.log(`  delete accounts      ${emails.join(", ")}`);
  for (const m of ms) console.log(`  delete membership    ${m.member_code ?? "(no ID yet)"} ${m.status} — ${m.owner}`);
  for (const o of orgs) console.log(`  delete organisation  ${o.name}`);
  console.log(`  delete receipts      ${receipts.map((r) => r.receipt_no).join(", ") || "-"}`);
  console.log(`  delete files         ${files.length}`);
  const kept = (await db.query(`select coalesce(u.email, o.name) as owner, m.member_code, m.status from memberships m
       left join users u on u.id = m.user_id left join organisations o on o.id = m.organisation_id
      where not (m.id = any($1::uuid[]))`, [msIds])) as { owner: string; member_code: string | null; status: string }[];
  for (const m of kept) console.log(`  keep   membership    ${m.member_code ?? "(no ID yet)"} ${m.status} — ${m.owner}`);
  console.log(`  keep   accounts      ${users.filter((u) => !ids.includes(u.id)).map((u) => u.email).join(", ")}`);
  if (arg("confirm") === undefined) {
    console.log("\nDry run only. Add --confirm to do it.");
    return db.close();
  }

  const file = saveLocal("remove-accounts-backup", await dump(db.query, TABLES));
  console.log(`\nEverything saved first to ${file}`);
  await db.transaction(async (q) => {
    // Loose references from records that stay (e.g. a payment they verified, settings they saved)
    await q(`update payments set verified_by = null where verified_by = any($1::uuid[])`, [ids]);
    await q(`update payments set submitted_by = null where submitted_by = any($1::uuid[])`, [ids]);
    await q(`update organisations set assigned_pic_id = null where assigned_pic_id = any($1::uuid[])`, [ids]);
    await q(`update org_notes set author_id = null where author_id = any($1::uuid[])`, [ids]);
    await q(`update org_documents set uploaded_by = null where uploaded_by = any($1::uuid[])`, [ids]);
    await q(`update seat_requests set requested_by = null where requested_by = any($1::uuid[])`, [ids]);
    await q(`update seat_requests set decided_by = null where decided_by = any($1::uuid[])`, [ids]);
    await q(`update settings set updated_by = null where updated_by = any($1::uuid[])`, [ids]);
    // Their records (orders, payments, receipts, seats, reminders go with the membership)
    await q(`delete from memberships where id = any($1::uuid[])`, [msIds]);
    await q(`delete from organisations where id = any($1::uuid[])`, [orgIds]);
    await q(`delete from email_log where to_email = any($1::text[])`, [emails]);
    await q(`delete from users where id = any($1::uuid[])`, [ids]);
    // Numbering continues after the highest number still in use
    await q(`delete from counters where key like 'member:%' or key like 'receipt:%'`);
    await q(`insert into counters (key, value)
               select 'member:' || category || ':' || (join_year % 100)::text, max(seq) from memberships
                where seq is not null group by category, join_year`);
    await q(`insert into counters (key, value)
               select 'receipt:' || split_part(receipt_no, '/', 3), max(split_part(receipt_no, '/', 4)::int) from receipts group by split_part(receipt_no, '/', 3)`);
  });
  console.log("Accounts removed. Numbering now continues after the highest number in use (0001 when none).");
  await db.close();

  if (!files.length) return;
  if (!process.env.S3_BUCKET) {
    console.log(`\nDelete these uploads in Supabase → Storage → dama-files:\n  ${files.join("\n  ")}`);
    return;
  }
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  for (const key of files) await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  console.log(`Deleted ${files.length} uploaded files.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
