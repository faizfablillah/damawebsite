import "server-only";
import crypto from "node:crypto";
import Papa from "papaparse";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CORPORATE_TIERS, STATE_CODES, TIERS, type TierCode } from "./config";
import { hashPassword } from "./auth";
import { addDays, parseRinggit, termEnd, todayKL } from "./format";
import { getSettings, priceFor } from "./settings";
import { audit } from "./audit";
import { bumpCounterTo, formatMemberCode, MEMBER_CODE_RE, nextCounter, paymentReference } from "./membership";

// Bring in members who joined through the Google/Microsoft forms before this system existed.
// Their accounts get a random password; they use "Forgot password" to sign in for the first time.

export const IMPORT_COLUMNS = [
  "tier", // EDU, IND, COR_S, COR_M, COR_L, COR_P
  "member_id", // existing ID, e.g. IMYKL26-0003 (leave blank to generate)
  "name", // member name, or corporate contact person
  "email",
  "phone",
  "job_title",
  "organisation", // company (individual) / institution (student) / organisation name (corporate)
  "ssm_no", // corporate only
  "state", // two-letter code, e.g. KL
  "address",
  "start_date", // YYYY-MM-DD
  "end_date", // optional; default 12 months from start
  "amount_paid", // RM
  "payment_date", // YYYY-MM-DD
  "payment_reference",
] as const;

export const IMPORT_TEMPLATE =
  IMPORT_COLUMNS.join(",") +
  "\nIND,IMYKL26-0003,Example Person,person@example.com,0123456789,Data Analyst,Example Sdn Bhd,,KL,\"1 Jalan Example, Kuala Lumpur\",2026-08-20,,150,2026-08-20,DAMA MBRP IND Example Person\n";

type Row = Record<(typeof IMPORT_COLUMNS)[number], string>;

export async function importMembers(csv: string, adminId: string, dryRun: boolean) {
  const parsed = Papa.parse<Row>(csv.replace(/^﻿/, ""), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const errors: string[] = [];
  const rows = parsed.data;
  const db = await getDb();
  const settings = await getSettings();
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  rows.forEach((r, i) => {
    const line = `Row ${i + 2}`;
    const tier = r.tier?.trim().toUpperCase() as TierCode;
    if (!TIERS[tier]) errors.push(`${line}: tier must be one of EDU, IND, COR_S, COR_M, COR_L, COR_P.`);
    if (!r.name?.trim()) errors.push(`${line}: name is required.`);
    if (!/^\S+@\S+\.\S+$/.test(r.email?.trim() ?? "")) errors.push(`${line}: a valid email is required.`);
    const state = r.state?.trim().toUpperCase();
    if (!STATE_CODES.includes(state as never)) errors.push(`${line}: state must be a two-letter code such as KL or SL.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.start_date?.trim() ?? "")) errors.push(`${line}: start_date must be YYYY-MM-DD.`);
    if (r.end_date?.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(r.end_date.trim())) errors.push(`${line}: end_date must be YYYY-MM-DD.`);
    const code = r.member_id?.trim().toUpperCase();
    if (code) {
      const m = code.match(MEMBER_CODE_RE);
      if (!m) errors.push(`${line}: member_id "${code}" doesn't match the format IMYKL26-0001.`);
      else if (TIERS[tier] && m[1] !== TIERS[tier].category) errors.push(`${line}: member_id category doesn't match tier ${tier}.`);
      if (seenCodes.has(code)) errors.push(`${line}: member_id ${code} appears twice.`);
      seenCodes.add(code);
    }
    if (CORPORATE_TIERS.includes(tier) && (!r.organisation?.trim() || !r.ssm_no?.trim())) errors.push(`${line}: corporate rows need organisation and ssm_no.`);
    const email = r.email?.trim().toLowerCase();
    if (!CORPORATE_TIERS.includes(tier) && email) {
      if (seenEmails.has(email)) errors.push(`${line}: ${email} appears twice for a personal membership.`);
      seenEmails.add(email);
    }
  });

  for (const code of seenCodes) {
    const [hit] = await db.select().from(schema.memberships).where(eq(schema.memberships.memberCode, code));
    if (hit) errors.push(`member_id ${code} already exists in the system.`);
  }
  if (errors.length || dryRun) return { count: rows.length, errors };

  await db.transaction(async (tx) => {
    for (const r of rows) {
      const tier = r.tier.trim().toUpperCase() as TierCode;
      const t = TIERS[tier];
      const email = r.email.trim().toLowerCase();
      const state = r.state.trim().toUpperCase();
      let [user] = await tx.select().from(schema.users).where(eq(schema.users.email, email));
      if (!user) {
        [user] = await tx
          .insert(schema.users)
          .values({
            email,
            passwordHash: await hashPassword(crypto.randomBytes(24).toString("base64url")),
            name: r.name.trim(),
            phone: r.phone?.trim() || "-",
            jobTitle: r.job_title?.trim() || null,
            organisation: t.category === "C" ? null : r.organisation?.trim() || null,
            address: r.address?.trim() || null,
            stateCode: state,
          })
          .returning();
      }
      let organisationId: string | null = null;
      if (t.category === "C") {
        const [org] = await tx
          .insert(schema.organisations)
          .values({
            name: r.organisation.trim(),
            ssmNo: r.ssm_no.trim(),
            address: r.address?.trim() || null,
            stateCode: state,
            contactUserId: user.id,
            contactName: r.name.trim(),
            contactJobTitle: r.job_title?.trim() || null,
            contactEmail: email,
            contactPhone: r.phone?.trim() || "-",
            pipelineStatus: "pending_user_list",
          })
          .returning();
        organisationId = org.id;
      }
      const start = r.start_date.trim();
      const end = r.end_date?.trim() || termEnd(start);
      const today = todayKL();
      const status = end >= today ? "active" : today <= addDays(end, settings.graceDays) ? "grace" : "expired";

      let code = r.member_id?.trim().toUpperCase() || null;
      let joinYear: number;
      let seq: number;
      if (code) {
        const m = code.match(MEMBER_CODE_RE)!;
        joinYear = 2000 + Number(m[3]);
        seq = Number(m[4]);
        await bumpCounterTo(tx, `member:${t.category}:${m[3]}`, seq);
      } else {
        const yy = Number(start.slice(2, 4));
        seq = await nextCounter(tx, `member:${t.category}:${yy}`);
        joinYear = 2000 + yy;
        code = formatMemberCode(t.category, state, yy, seq);
      }

      const [m] = await tx
        .insert(schema.memberships)
        .values({
          category: t.category,
          tier,
          userId: t.category === "C" ? null : user.id,
          organisationId,
          stateCode: state,
          memberCode: code,
          joinYear,
          seq,
          status,
          eligibilityStatus: t.category === "E" ? "approved" : "not_required",
          institution: t.category === "E" ? r.organisation?.trim() || null : null,
          startDate: start,
          endDate: end,
          activatedAt: new Date(`${start}T00:00:00+08:00`),
          imported: true,
        })
        .returning();
      const price = priceFor(tier, settings);
      const paid = parseRinggit(r.amount_paid ?? "") ?? price.unitPrice;
      const [o] = await tx
        .insert(schema.orders)
        .values({
          membershipId: m.id,
          kind: "new",
          itemCode: price.itemCode,
          description: price.description,
          unitPrice: price.unitPrice,
          discount: Math.max(0, price.unitPrice - paid),
          amountPaid: paid,
          status: "paid",
          paymentReference: paymentReference(tier, t.category === "C" ? r.organisation.trim() : r.name.trim()),
          periodStart: start,
          periodEnd: end,
          paidAt: new Date(),
        })
        .returning();
      await tx.insert(schema.payments).values({
        orderId: o.id,
        amount: paid,
        method: "bank_transfer",
        paymentDate: r.payment_date?.trim() || start,
        reference: r.payment_reference?.trim() || "Imported",
        status: "verified",
        note: "Imported from earlier manual records; receipt issued outside this system.",
        verifiedBy: adminId,
        verifiedAt: new Date(),
      });
      if (t.category === "C") {
        for (let n = 1; n <= t.seats; n++) await tx.insert(schema.seats).values({ membershipId: m.id, seatNo: n });
      }
      await audit(adminId, "membership.imported", "membership", m.id, { code }, tx);
    }
  });
  return { count: rows.length, errors };
}
