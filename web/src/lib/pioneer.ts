import "server-only";
import { sql } from "drizzle-orm";
import { schema } from "@/db";
import type { MembershipBundle } from "@/lib/queries";

// Pioneer Members (board decision, Oct 2026): everyone whose first payment was SUBMITTED by
// 31 Dec 2026, Malaysia time, including members who joined before the offer. The submission
// time counts, not the verification time, so late-December payers verified in January qualify.
// The mark shows once the membership has a Member ID (its payment was verified).
export const PIONEER_CUTOFF = "2026-12-31T16:00:00.000Z"; // = 1 Jan 2027 00:00 in Kuala Lumpur

// The public offer (Join page; membership.html hides its copy with data-until) ends at the cutoff
export function pioneerOfferOpen() {
  return Date.now() < Date.parse(PIONEER_CUTOFF);
}

export function isPioneer(b: MembershipBundle) {
  const m = b.membership;
  if (!m.memberCode) return false;
  if (m.imported) return !!m.startDate && m.startDate < "2027-01-01";
  const cutoff = new Date(PIONEER_CUTOFF).getTime();
  return b.orders.some((o) => o.payments.some((p) => p.status !== "rejected" && p.createdAt.getTime() < cutoff));
}

// The same rule as a SQL condition on the memberships table, for lists and exports.
// (A string, not a Date: postgres-js would send Date.toString().)
export const pioneerSql = sql<boolean>`(${schema.memberships.memberCode} is not null and (
  exists (
    select 1 from payments p join orders o on o.id = p.order_id
    where o.membership_id = ${schema.memberships.id} and p.status <> 'rejected' and p.created_at < ${PIONEER_CUTOFF}::timestamptz
  )
  or (${schema.memberships.imported} and ${schema.memberships.startDate} < '2027-01-01')
))`;
