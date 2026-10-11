import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

// Pioneer Members (board decision, Oct 2026): the first 250 memberships whose first payment was
// SUBMITTED by 31 Dec 2026, Malaysia time, including members who joined before the offer;
// the offer closes when the spots are taken or at the cutoff, whichever comes first.
// Order = when the first non-rejected payment was submitted, so a December payer verified in
// January keeps their place, and a submitted payment holds a spot until it is rejected.
// The mark shows once the membership has a Member ID (its payment was verified).
// A corporate membership is one spot.
export const PIONEER_CUTOFF = "2026-12-31T16:00:00.000Z"; // = 1 Jan 2027 00:00 in Kuala Lumpur
export const PIONEER_SPOTS = 250;

// Membership ids holding a spot (the cutoff is a string, not a Date: postgres-js would send
// Date.toString())
const spotHolders = sql`(
  select r.id from (
    select q.id, row_number() over (order by q.first_at, q.id) as rn from (
      select m.id, min(p.created_at) as first_at
      from memberships m join orders o on o.membership_id = m.id join payments p on p.order_id = o.id
      where p.status <> 'rejected' and m.status not in ('rejected', 'cancelled') and not m.imported
      group by m.id
      union all
      select m.id, m.start_date::timestamptz from memberships m
      where m.imported and m.start_date is not null and m.status not in ('rejected', 'cancelled')
    ) q where q.first_at < ${PIONEER_CUTOFF}::timestamptz
  ) r where r.rn <= ${PIONEER_SPOTS}
)`;

// The rule as a SQL condition on the memberships table, for lists and exports
export const pioneerSql = sql<boolean>`(${schema.memberships.memberCode} is not null and ${schema.memberships.id} in ${spotHolders})`;

type Holder = { id: string; member_code: string | null };

// Who has the mark, how many spots are left, and whether the public offer is still open
export async function pioneerStatus() {
  const db = await getDb();
  const res = (await db.execute(sql`select h.id, m.member_code from ${spotHolders} h join memberships m on m.id = h.id`)) as unknown;
  // PGlite returns { rows }, postgres-js returns the rows array
  const holders = (Array.isArray(res) ? res : (res as { rows: Holder[] }).rows) as Holder[];
  const spotsLeft = Math.max(0, PIONEER_SPOTS - holders.length);
  return {
    pioneers: new Set(holders.filter((h) => h.member_code).map((h) => h.id)),
    spotsLeft,
    open: spotsLeft > 0 && Date.now() < Date.parse(PIONEER_CUTOFF),
  };
}
