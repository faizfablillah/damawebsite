import Papa from "papaparse";

// Cells starting with = + - @ get a leading quote so a member's name can't run as a formula in Excel
const toCsv = (rows: object[]) => Papa.unparse(rows, { escapeFormulae: true });
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CATEGORY_LABEL, TIERS } from "@/lib/config";
import { money, todayKL } from "@/lib/format";
import { IMPORT_TEMPLATE } from "@/lib/import";
import { seatCode } from "@/lib/membership";
import { audit } from "@/lib/audit";

function csv(name: string, body: string) {
  // BOM so Excel opens UTF-8 correctly
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(_req: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user.role, kind === "template" ? "view" : "export")) return new Response("Not allowed", { status: 403 });
  if (kind === "template") return csv("dama-member-import-template.csv", IMPORT_TEMPLATE);
  const db = await getDb();
  const date = todayKL();

  if (kind === "members") {
    const rows = await db
      .select({ m: schema.memberships, u: schema.users, o: schema.organisations })
      .from(schema.memberships)
      .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
      .orderBy(asc(schema.memberships.createdAt));
    await audit(user.id, "export.members", "export", null, { rows: rows.length });
    return csv(
      `dama-members-${date}.csv`,
      toCsv(
        rows.map(({ m, u, o }) => ({
          member_id: m.memberCode ?? "",
          category: CATEGORY_LABEL[m.category],
          tier: TIERS[m.tier].label,
          status: m.status,
          eligibility: m.eligibilityStatus,
          name: o?.name ?? u?.name ?? "",
          contact_person: o?.contactName ?? "",
          email: o?.contactEmail ?? u?.email ?? "",
          phone: o?.contactPhone ?? u?.phone ?? "",
          job_title: o?.contactJobTitle ?? u?.jobTitle ?? "",
          organisation: o ? "" : (m.category === "E" ? m.institution : u?.organisation) ?? "",
          ssm_no: o?.ssmNo ?? "",
          state: m.stateCode,
          start_date: m.startDate ?? "",
          end_date: m.endDate ?? "",
          joined: m.createdAt.toISOString().slice(0, 10),
          topics: m.topics.join("; "),
          imported: m.imported ? "yes" : "",
        })),
      ),
    );
  }

  if (kind === "payments") {
    const rows = await db
      .select({ p: schema.payments, o: schema.orders, m: schema.memberships, u: schema.users, org: schema.organisations, r: schema.receipts })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .innerJoin(schema.memberships, eq(schema.orders.membershipId, schema.memberships.id))
      .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
      .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
      .orderBy(desc(schema.payments.paymentDate));
    await audit(user.id, "export.payments", "export", null, { rows: rows.length });
    return csv(
      `dama-payments-${date}.csv`,
      toCsv(
        rows.map(({ p, o, m, u, org, r }) => ({
          receipt_no: r?.receiptNo ?? "",
          receipt_date: r?.data.receiptDate ?? "",
          payment_date: p.paymentDate,
          status: p.status,
          member_id: m.memberCode ?? "",
          payer: org?.name ?? u?.name ?? "",
          email: org?.contactEmail ?? u?.email ?? "",
          item_code: o.itemCode,
          description: o.description,
          kind: o.kind,
          amount_rm: money(p.amount).replace(/,/g, ""),
          method: p.method,
          bank_reference: p.reference,
          expected_reference: o.paymentReference,
          note: p.note ?? p.rejectReason ?? "",
        })),
      ),
    );
  }

  if (kind === "seats") {
    const rows = await db
      .select({ s: schema.seats, m: schema.memberships, org: schema.organisations })
      .from(schema.seats)
      .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
      .innerJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
      .orderBy(asc(schema.organisations.name), asc(schema.seats.seatNo));
    await audit(user.id, "export.seats", "export", null, { rows: rows.length });
    return csv(
      `dama-corporate-seats-${date}.csv`,
      toCsv(
        rows.map(({ s, m, org }) => ({
          organisation: org.name,
          seat_id: seatCode(m.memberCode, s.seatNo),
          membership_status: m.status,
          name: s.name ?? "",
          job_title: s.jobTitle ?? "",
          email: s.email ?? "",
          phone: s.phone ?? "",
          assigned: s.assignedAt ?? "",
          valid_until: m.endDate ?? "",
        })),
      ),
    );
  }
  return new Response("Not found", { status: 404 });
}
