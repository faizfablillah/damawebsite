import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Membership, Order, Organisation, Payment, Receipt, Seat, User } from "@/db/schema";

export type OrderBundle = { order: Order; payments: Payment[]; receipts: Receipt[] };
export type MembershipBundle = {
  membership: Membership;
  user: User | null; // Student / Individual member
  organisation: Organisation | null;
  contact: User | null; // Corporate contact person
  orders: OrderBundle[];
  seats: Seat[];
};

export async function loadMembership(membershipId: string): Promise<MembershipBundle | null> {
  const db = await getDb();
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
  if (!m) return null;
  const [user] = m.userId ? await db.select().from(schema.users).where(eq(schema.users.id, m.userId)) : [];
  const [org] = m.organisationId ? await db.select().from(schema.organisations).where(eq(schema.organisations.id, m.organisationId)) : [];
  const [contact] = org ? await db.select().from(schema.users).where(eq(schema.users.id, org.contactUserId)) : [];
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.membershipId, m.id)).orderBy(desc(schema.orders.createdAt));
  const ids = orders.map((o) => o.id);
  const payments = ids.length ? await db.select().from(schema.payments).where(inArray(schema.payments.orderId, ids)).orderBy(desc(schema.payments.createdAt)) : [];
  const receipts = ids.length ? await db.select().from(schema.receipts).where(inArray(schema.receipts.orderId, ids)).orderBy(desc(schema.receipts.issuedAt)) : [];
  const seats = m.category === "C" ? await db.select().from(schema.seats).where(eq(schema.seats.membershipId, m.id)).orderBy(schema.seats.seatNo) : [];
  return {
    membership: m,
    user: user ?? null,
    organisation: org ?? null,
    contact: contact ?? null,
    orders: orders.map((order) => ({
      order,
      payments: payments.filter((p) => p.orderId === order.id),
      receipts: receipts.filter((r) => r.orderId === order.id),
    })),
    seats,
  };
}

export async function membershipsForUser(user: User) {
  const db = await getDb();
  const own = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id)).orderBy(desc(schema.memberships.createdAt));
  const orgs = await db.select().from(schema.organisations).where(eq(schema.organisations.contactUserId, user.id)).orderBy(desc(schema.organisations.createdAt));
  const orgMemberships = orgs.length
    ? await db.select().from(schema.memberships).where(inArray(schema.memberships.organisationId, orgs.map((o) => o.id)))
    : [];
  const bundles = await Promise.all([...own, ...orgMemberships].map((m) => loadMembership(m.id)));
  const heldSeats = await db
    .select({ seat: schema.seats, membership: schema.memberships, organisation: schema.organisations })
    .from(schema.seats)
    .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
    .innerJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .where(and(sql`lower(${schema.seats.email}) = ${user.email.toLowerCase()}`, inArray(schema.memberships.status, ["active", "grace"])));
  return { bundles: bundles.filter((b): b is MembershipBundle => !!b), heldSeats };
}

// Can this user see this membership? (owner or corporate contact)
export function ownsBundle(b: MembershipBundle, user: User) {
  return b.membership.userId === user.id || b.organisation?.contactUserId === user.id;
}

export const openOrder = (b: MembershipBundle) =>
  b.orders.find((o) => ["awaiting_payment", "pending_verification", "part_paid"].includes(o.order.status));
