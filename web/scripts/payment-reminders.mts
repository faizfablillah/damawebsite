// Payment reminder emails for unpaid individual applications (step 1 of the unpaid-applications
// procedure in HANDOVER.md §9). Preview first, check it, then send exactly what was previewed.
//
//   AUTO_MIGRATE=false node --env-file=.env.production.local --conditions=react-server --import tsx scripts/payment-reminders.mts
//       builds the emails into <out>/preview.html + reminders.json; sends nothing
//   ... same command with --send
//       sends the frozen reminders.json, skipping anyone who has paid since; logged as `paymentReminder`
//
// <out> defaults to a folder in the system temp dir (the preview holds personal data; never commit it).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { pioneerStatus, PIONEER_SPOTS } from "@/lib/pioneer";
import { orderBalance } from "@/lib/membership";
import { rm } from "@/lib/format";
import { APP_URL, ORG } from "@/lib/config";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? path.join(os.tmpdir(), "dama-reminders");
const FROZEN = path.join(OUT, "reminders.json");
const SEND = process.argv.includes("--send");
const db = await getDb();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Same layout as src/lib/email.ts
function layout(title: string, bodyHtml: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f4fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#071b41;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:bold">${esc(ORG.shortName)}<div style="height:4px;width:60px;background:#4de1c7;margin-top:10px;border-radius:2px"></div></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
<h1 style="font-size:20px;color:#071b41;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
<p style="margin:28px 0"><a href="${cta.url}" style="background:#00906d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link into your browser:<br>${cta.url}</p>
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;font-size:12px;color:#6b7280">${esc(ORG.registeredName)} · ROS ${ORG.rosNo}<br>${ORG.email}</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
const textOf = (html: string) =>
  html.replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();

async function pending() {
  return db
    .select({ m: schema.memberships, o: schema.orders, u: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.orders, eq(schema.orders.membershipId, schema.memberships.id))
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.category, "I"), eq(schema.memberships.status, "pending"), eq(schema.orders.status, "awaiting_payment"), eq(schema.orders.kind, "new")))
    .orderBy(schema.memberships.createdAt);
}

const myt = (d: Date | string) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

if (!SEND) {
  const s = await getSettings();
  const pio = await pioneerStatus();
  const rows = await pending();
  const subject = "Your DAMA Malaysia membership: one step left";
  const mails = rows.map(({ m, o, u }) => {
    const amount = rm(orderBalance(o));
    const paras = [
      `Hi ${esc(u.name)},`,
      `Thank you for applying for DAMA Malaysia Individual membership. Your application is ready; it only needs your payment to be complete.`,
      [
        `<strong>Amount:</strong> ${amount} (early-bird price)`,
        `<strong>Bank:</strong> ${esc(s.bank.bankName)}`,
        `<strong>Account name:</strong> ${esc(s.bank.accountName)}`,
        `<strong>Account no.:</strong> ${esc(s.bank.accountNumber)}`,
        `<strong>Reference:</strong> ${esc(o.paymentReference)}`,
      ].join("<br>"),
      `After transferring, upload your receipt at <a href="${APP_URL}/portal">${APP_URL.replace(/^https?:\/\//, "")}/portal</a>. We verify payments within 3 business days and email your receipt and Member ID.`,
      ...(pio.open ? [`You're also in time for our Pioneer Member offer (the first ${PIONEER_SPOTS} members), and a submitted payment holds your spot.`] : []),
      `If anything got in the way, just reply to this email and we'll help.`,
      `Warm regards,<br>DAMA Malaysia Membership Team`,
    ];
    const body = paras.map(p).join("");
    const cta = { label: "Go to payment", url: `${APP_URL}/portal` };
    return {
      to: u.email, name: u.name, phone: u.phone, applied: m.createdAt, userId: u.id, membershipId: m.id, orderId: o.id,
      amount, reference: o.paymentReference,
      mail: { subject, html: layout(subject, body, cta), text: `${subject}\n\n${textOf(body)}\n\n${cta.label}: ${cta.url}\n\n${ORG.shortName}` },
    };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(FROZEN, JSON.stringify({ builtAt: new Date().toISOString(), spotsLeft: pio.spotsLeft, mails }, null, 2));
  const wa = (x: (typeof mails)[number]) =>
    `Hi ${x.name.split(" ")[0]}, this is [your name] from DAMA Malaysia. Thank you for applying for membership on ${myt(x.applied).split(",")[0]}! Your application just needs the ${x.amount} transfer to be complete. I've emailed you the bank details and your reference (${x.reference}). If anything is stuck, reply here and I'll help.`;
  const html = `<!doctype html><meta charset="utf-8"><title>Payment reminders preview</title>
<body style="font-family:Arial,sans-serif;background:#e5e7eb;margin:0;padding:24px">
<h1 style="margin:0 0 4px">Payment reminders: preview (nothing sent)</h1>
<p>Built ${myt(new Date())} MYT · ${mails.length} emails · from "DAMA Malaysia" &lt;info@dama.org.my&gt; · Pioneer spots left: ${pio.spotsLeft}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;background:#fff;margin-bottom:24px"><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Applied (MYT)</th><th>Amount</th><th>Reference</th></tr>
${mails.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.to)}</td><td>${esc(x.phone ?? "")}</td><td>${myt(x.applied)}</td><td>${x.amount}</td><td>${esc(x.reference)}</td></tr>`).join("")}</table>
${mails.map((x, i) => `<h2>${i + 1}. To: ${esc(x.to)} | Subject: ${esc(x.mail.subject)}</h2><iframe style="width:680px;height:820px;border:0;background:#fff" srcdoc="${esc(x.mail.html)}"></iframe>`).join("")}
<h2>WhatsApp texts (applied 12 Oct), to send by hand</h2>
${mails.filter((x) => myt(x.applied).startsWith("12")).map((x) => `<p><strong>${esc(x.name)} · ${esc(x.phone ?? "")}</strong><br><textarea rows="4" cols="100">${esc(wa(x))}</textarea></p>`).join("")}
</body>`;
  fs.writeFileSync(path.join(OUT, "preview.html"), html);
  console.log(`Preview: ${mails.length} emails, nothing sent. Pioneer spots left ${pio.spotsLeft}, open ${pio.open}.`);
  for (const x of mails) console.log(" ", myt(x.applied), x.amount, x.reference);
} else {
  const { sendEmail } = await import("@/lib/email");
  const frozen = JSON.parse(fs.readFileSync(FROZEN, "utf8"));
  const still = new Set((await pending()).map((r) => r.o.id));
  for (const x of frozen.mails) {
    if (!still.has(x.orderId)) {
      console.log("SKIP (no longer unpaid)", x.to);
      continue;
    }
    await sendEmail(x.to, "paymentReminder" as never, x.mail, { userId: x.userId, membershipId: x.membershipId });
    console.log("sent", x.to);
    await new Promise((r) => setTimeout(r, 4000));
  }
}
process.exit(0);
