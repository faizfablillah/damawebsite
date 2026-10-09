import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/db";
import type { Event, EventRegistration, EventRegistrationStatus, ReceiptSnapshot, User } from "@/db/schema";
import { APP_URL } from "./config";
import { addDays, fmtEventWhen, rm, todayKL } from "./format";
import { getSettings } from "./settings";
import { audit } from "./audit";
import { sendEmail, templates } from "./email";
import { receiptPdf } from "./receipt-pdf";
import { membershipsForUser } from "./queries";
import { BusinessError, nextCounter, seatCode } from "./membership";

// Events: public or members-only, free or paid (bank transfer + proof, verified by Finance).
// A registration holds a place while it is awaiting payment or under review.

const HOLDS_PLACE: EventRegistrationStatus[] = ["awaiting_payment", "payment_review", "confirmed"];

export const eventInfo = (e: Event) => ({ title: e.title, when: fmtEventWhen(e.startsAt, e.endsAt), venue: e.venue, slug: e.slug });
export const payUrl = (registrationId: string) => `${APP_URL}/portal/events/${registrationId}`;

// ---------- membership check ----------

// Active (or in-grace) member through their own membership, a corporate membership they manage,
// or a corporate seat they hold. Returns the Member ID to show on the registration.
export async function memberStatus(user: User): Promise<{ member: boolean; memberCode: string | null }> {
  const { bundles, heldSeats } = await membershipsForUser(user);
  const own = bundles.find((b) => ["active", "grace"].includes(b.membership.status));
  if (own) return { member: true, memberCode: own.membership.memberCode };
  const seat = heldSeats[0];
  if (seat) return { member: true, memberCode: seatCode(seat.membership.memberCode, seat.seat.seatNo) };
  return { member: false, memberCode: null };
}

// ---------- reading ----------

export async function placesTaken(eventId: string, tx?: Tx) {
  const db = tx ?? (await getDb());
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.eventRegistrations)
    .where(and(eq(schema.eventRegistrations.eventId, eventId), inArray(schema.eventRegistrations.status, HOLDS_PLACE)));
  return row.n;
}

export async function publishedEvents(when: "upcoming" | "past", limit = 50) {
  const db = await getDb();
  // Raw SQL parameters aren't typed, so dates go in as ISO strings (postgres-js would send Date.toString())
  const now = new Date();
  // An event counts as upcoming until it has ended (or 3 hours after it starts if no end time)
  const endExpr = sql`coalesce(${schema.events.endsAt}, ${schema.events.startsAt} + interval '3 hours')`;
  return db
    .select()
    .from(schema.events)
    .where(and(inArray(schema.events.status, ["published", "cancelled"]), when === "upcoming" ? sql`${endExpr} >= ${now.toISOString()}::timestamptz` : sql`${endExpr} < ${now.toISOString()}::timestamptz`))
    .orderBy(when === "upcoming" ? asc(schema.events.startsAt) : desc(schema.events.startsAt))
    .limit(limit);
}

export const hasEnded = (e: Event) => (e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3_600_000)).getTime() < Date.now();

export function registrationClosed(e: Event) {
  if (e.status !== "published") return "This event is not open for registration.";
  if (e.externalUrl) return "Registration for this partner event is on the organiser's website.";
  const closes = e.registrationClosesAt ?? e.startsAt;
  if (closes.getTime() <= Date.now()) return "Registration for this event has closed.";
  return null;
}

// What this person would pay; null = not allowed (members-only and not a member)
export function priceFor(e: Event, member: boolean): number | null {
  if (member) return e.memberPrice;
  if (e.audience === "members" || e.nonMemberPrice === null) return null;
  return e.nonMemberPrice;
}

export async function registrationFor(eventId: string, userId: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(schema.eventRegistrations)
    .where(and(eq(schema.eventRegistrations.eventId, eventId), eq(schema.eventRegistrations.userId, userId)));
  return r ?? null;
}

export async function loadRegistration(registrationId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ r: schema.eventRegistrations, e: schema.events })
    .from(schema.eventRegistrations)
    .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
    .where(eq(schema.eventRegistrations.id, registrationId));
  if (!row) return null;
  const payments = await db
    .select()
    .from(schema.eventPayments)
    .where(eq(schema.eventPayments.registrationId, registrationId))
    .orderBy(asc(schema.eventPayments.createdAt));
  return { registration: row.r, event: row.e, payments };
}

// ---------- calendar invite ----------

function ics(e: Event) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 3_600_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DAMA Kuala Lumpur & Selangor//Events//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@dama-kl-selangor`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(e.title)}`,
    `DESCRIPTION:${text(`${e.summary}\n\n${APP_URL}/events/${e.slug}`)}`,
    ...(e.venue ? [`LOCATION:${text(e.venue)}`] : []),
    `URL:${APP_URL}/events/${e.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function sendConfirmation(r: EventRegistration, e: Event, receipt?: { pdf: Buffer; receiptNo: string }) {
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [{ filename: "event.ics", content: Buffer.from(ics(e)), contentType: "text/calendar" }];
  if (receipt) attachments.push({ filename: `DAMA Receipt ${receipt.receiptNo.replace(/\//g, "-")}.pdf`, content: receipt.pdf, contentType: "application/pdf" });
  await sendEmail(r.email, "eventConfirmed", templates.eventConfirmed(r.name, eventInfo(e), e.onlineUrl), { userId: r.userId }, attachments);
}

// ---------- registering ----------

export async function registerForEvent(user: User, eventId: string) {
  const db = await getDb();
  const status = await memberStatus(user);
  const result = await db.transaction(async (tx) => {
    // Lock the event so two people can't take the last place at the same moment
    await tx.execute(sql`select id from events where id = ${eventId} for update`);
    const [e] = await tx.select().from(schema.events).where(eq(schema.events.id, eventId));
    if (!e) throw new BusinessError("Event not found.");
    const closed = registrationClosed(e);
    if (closed) throw new BusinessError(closed);
    const price = priceFor(e, status.member);
    if (price === null) throw new BusinessError("This event is for DAMA members only.");
    const [existing] = await tx
      .select()
      .from(schema.eventRegistrations)
      .where(and(eq(schema.eventRegistrations.eventId, e.id), eq(schema.eventRegistrations.userId, user.id)));
    if (existing && existing.status !== "cancelled") throw new BusinessError("You're already registered for this event.");
    if (e.capacity !== null && (await placesTaken(e.id, tx)) >= e.capacity) throw new BusinessError("Sorry, this event is fully booked.");
    const values = {
      eventId: e.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      organisation: user.organisation,
      memberCode: status.memberCode,
      rate: status.member ? ("member" as const) : ("non_member" as const),
      amount: price,
      paymentReference: price > 0 ? `DAMA EVT ${todayKL(e.startsAt).slice(2).replace(/-/g, "")} ${user.name}`.slice(0, 60) : null,
      status: price > 0 ? ("awaiting_payment" as const) : ("confirmed" as const),
      confirmedAt: price > 0 ? null : new Date(),
      cancelledAt: null,
      attended: false,
      reminderSentAt: null,
      createdAt: new Date(),
    };
    const [r] = existing
      ? await tx.update(schema.eventRegistrations).set(values).where(eq(schema.eventRegistrations.id, existing.id)).returning()
      : await tx.insert(schema.eventRegistrations).values(values).returning();
    await audit(user.id, "event.registered", "event", e.id, { registrationId: r.id, amount: price }, tx);
    return { r, e };
  });
  const { r, e } = result;
  if (r.status === "confirmed") await sendConfirmation(r, e);
  else await sendEmail(r.email, "eventPaymentNeeded", templates.eventPaymentNeeded(r.name, eventInfo(e), rm(r.amount), r.paymentReference!, payUrl(r.id)), { userId: r.userId });
  return r;
}

export async function cancelOwnRegistration(user: User, registrationId: string) {
  const db = await getDb();
  const [r] = await db.select().from(schema.eventRegistrations).where(eq(schema.eventRegistrations.id, registrationId));
  if (!r || r.userId !== user.id) throw new BusinessError("Registration not found.");
  if (r.status === "cancelled") return;
  // Paid places are only cancelled by the team (refunds are handled by hand)
  if (r.status !== "awaiting_payment" && r.amount > 0) throw new BusinessError("Please email us to cancel a paid registration.");
  await db.update(schema.eventRegistrations).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(schema.eventRegistrations.id, r.id));
  await audit(user.id, "event.registration_cancelled", "event", r.eventId, { registrationId: r.id, by: "member" });
}

// ---------- payments ----------

export async function submitEventPayment(input: { registrationId: string; userId: string; amount: number; paymentDate: string; reference: string; proof: { key: string; name: string } }) {
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(schema.eventRegistrations).where(eq(schema.eventRegistrations.id, input.registrationId));
    if (!r || r.userId !== input.userId) throw new BusinessError("Registration not found.");
    if (r.status !== "awaiting_payment" && r.status !== "payment_review") throw new BusinessError("This registration doesn't need a payment.");
    const [p] = await tx
      .insert(schema.eventPayments)
      .values({ registrationId: r.id, amount: input.amount, paymentDate: input.paymentDate, reference: input.reference, proofKey: input.proof.key, proofName: input.proof.name })
      .returning();
    await tx.update(schema.eventRegistrations).set({ status: "payment_review" }).where(eq(schema.eventRegistrations.id, r.id));
    await audit(input.userId, "event.payment_submitted", "event", r.eventId, { paymentId: p.id, amount: input.amount }, tx);
    return { r, p };
  });
  await sendEmail(res.r.email, "paymentSubmitted", templates.paymentSubmitted(res.r.name, rm(input.amount)), { userId: res.r.userId });
}

export async function verifyEventPayment(paymentId: string, adminId: string, amountReceived: number) {
  const db = await getDb();
  const { website } = await getSettings();
  const res = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.eventPayments).where(eq(schema.eventPayments.id, paymentId));
    if (!p || p.status !== "submitted") throw new BusinessError("This payment has already been processed.");
    const [r] = await tx.select().from(schema.eventRegistrations).where(eq(schema.eventRegistrations.id, p.registrationId));
    const [e] = await tx.select().from(schema.events).where(eq(schema.events.id, r.eventId));
    if (amountReceived < r.amount) {
      throw new BusinessError(`The event fee is ${rm(r.amount)}. If less was received, reject the payment with a reason so the attendee can pay the difference.`);
    }
    const year = todayKL().slice(0, 4);
    const seq = await nextCounter(tx, `event-receipt:${year}`);
    const receiptNo = `MY/EVT/${year}/${String(seq).padStart(4, "0")}`;
    const receipt: ReceiptSnapshot = {
      kind: "event",
      event: { title: e.title, date: todayKL(e.startsAt) },
      receiptNo,
      receiptDate: todayKL(),
      category: "I",
      memberCode: r.memberCode,
      periodStart: null,
      periodEnd: null,
      periodNote: null,
      payer: [
        { label: "Name", value: r.name },
        { label: "Organisation", value: r.organisation ?? "" },
        { label: "Email", value: r.email },
        { label: "Phone", value: r.phone ?? "" },
      ],
      method: "Bank transfer",
      paymentDate: p.paymentDate,
      paymentReference: p.reference,
      itemCode: r.rate === "member" ? "EVT-MBR" : "EVT-STD",
      description: `${e.title} — ${r.rate === "member" ? "member" : "non-member"} registration`,
      unitPrice: r.amount,
      discount: 0,
      total: r.amount,
      amountReceived,
      previouslyPaid: 0,
      balance: 0,
      status: "PAID IN FULL",
      seats: null,
    };
    const [updated] = await tx
      .update(schema.eventPayments)
      .set({ status: "verified", amount: amountReceived, verifiedBy: adminId, verifiedAt: new Date(), receiptNo, receipt })
      .where(and(eq(schema.eventPayments.id, p.id), eq(schema.eventPayments.status, "submitted")))
      .returning();
    if (!updated) throw new BusinessError("This payment has already been processed.");
    const [confirmed] = await tx
      .update(schema.eventRegistrations)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(schema.eventRegistrations.id, r.id))
      .returning();
    await audit(adminId, "event.payment_verified", "event", e.id, { paymentId: p.id, receiptNo, amount: amountReceived }, tx);
    return { r: confirmed, e, receipt };
  });
  const pdf = await receiptPdf(res.receipt, website);
  await sendConfirmation(res.r, res.e, { pdf, receiptNo: res.receipt.receiptNo });
  return res.receipt.receiptNo;
}

export async function rejectEventPayment(paymentId: string, adminId: string, reason: string) {
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [p] = await tx
      .update(schema.eventPayments)
      .set({ status: "rejected", rejectReason: reason, verifiedBy: adminId, verifiedAt: new Date() })
      .where(and(eq(schema.eventPayments.id, paymentId), eq(schema.eventPayments.status, "submitted")))
      .returning();
    if (!p) throw new BusinessError("This payment has already been processed.");
    const [r] = await tx.select().from(schema.eventRegistrations).where(eq(schema.eventRegistrations.id, p.registrationId));
    const others = await tx
      .select({ id: schema.eventPayments.id })
      .from(schema.eventPayments)
      .where(and(eq(schema.eventPayments.registrationId, r.id), eq(schema.eventPayments.status, "submitted")));
    if (!others.length && r.status === "payment_review") {
      await tx.update(schema.eventRegistrations).set({ status: "awaiting_payment" }).where(eq(schema.eventRegistrations.id, r.id));
    }
    const [e] = await tx.select().from(schema.events).where(eq(schema.events.id, r.eventId));
    await audit(adminId, "event.payment_rejected", "event", e.id, { paymentId: p.id, reason }, tx);
    return { r, e };
  });
  await sendEmail(res.r.email, "eventPaymentRejected", templates.eventPaymentRejected(res.r.name, eventInfo(res.e), reason, payUrl(res.r.id)), { userId: res.r.userId });
}

// ---------- admin ----------

export async function adminCancelRegistration(registrationId: string, adminId: string, note: string) {
  const db = await getDb();
  const [r] = await db
    .update(schema.eventRegistrations)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(schema.eventRegistrations.id, registrationId), ne(schema.eventRegistrations.status, "cancelled")))
    .returning();
  if (!r) throw new BusinessError("This registration is already cancelled.");
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, r.eventId));
  await audit(adminId, "event.registration_cancelled", "event", e.id, { registrationId: r.id, by: "admin", note });
  await sendEmail(r.email, "eventCancelled", templates.eventCancelled(r.name, eventInfo(e), note), { userId: r.userId });
}

export async function setAttended(registrationId: string, attended: boolean, adminId: string) {
  const db = await getDb();
  const [r] = await db.update(schema.eventRegistrations).set({ attended }).where(eq(schema.eventRegistrations.id, registrationId)).returning();
  if (r) await audit(adminId, attended ? "event.attended" : "event.not_attended", "event", r.eventId, { registrationId });
}

export async function eventAttendees(eventId: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId))
    .orderBy(asc(schema.eventRegistrations.createdAt));
}

// Email everyone with a confirmed place (or every active registration)
export async function emailAttendees(eventId: string, adminId: string, subject: string, message: string, includePending: boolean) {
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!e) throw new BusinessError("Event not found.");
  const rows = await db
    .select()
    .from(schema.eventRegistrations)
    .where(and(eq(schema.eventRegistrations.eventId, eventId), inArray(schema.eventRegistrations.status, includePending ? HOLDS_PLACE : ["confirmed"])));
  let sent = 0;
  for (const r of rows) {
    if (await sendEmail(r.email, "eventMessage", templates.eventMessage(subject, message, eventInfo(e)), { userId: r.userId })) sent++;
  }
  await audit(adminId, "event.emailed", "event", e.id, { subject, recipients: rows.length, sent });
  return { recipients: rows.length, sent };
}

// ---------- daily reminders ----------

// Confirmed attendees of events starting tomorrow (Malaysia date) get one reminder
export async function sendEventReminders() {
  const db = await getDb();
  const tomorrow = addDays(todayKL(), 1);
  const from = new Date(`${tomorrow}T00:00:00+08:00`);
  const to = new Date(`${addDays(tomorrow, 1)}T00:00:00+08:00`);
  const rows = await db
    .select({ r: schema.eventRegistrations, e: schema.events })
    .from(schema.eventRegistrations)
    .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
    .where(
      and(
        eq(schema.events.status, "published"),
        gte(schema.events.startsAt, from),
        lt(schema.events.startsAt, to),
        eq(schema.eventRegistrations.status, "confirmed"),
        isNull(schema.eventRegistrations.reminderSentAt),
      ),
    );
  let sent = 0;
  for (const { r, e } of rows) {
    await sendEmail(r.email, "eventReminder", templates.eventReminder(r.name, eventInfo(e), e.onlineUrl), { userId: r.userId });
    await db.update(schema.eventRegistrations).set({ reminderSentAt: new Date() }).where(eq(schema.eventRegistrations.id, r.id));
    sent++;
  }
  return sent;
}

// Registrations a member should see in their portal (upcoming, not cancelled)
export async function myEventRegistrations(userId: string) {
  const db = await getDb();
  return db
    .select({ r: schema.eventRegistrations, e: schema.events })
    .from(schema.eventRegistrations)
    .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
    .where(and(eq(schema.eventRegistrations.userId, userId), ne(schema.eventRegistrations.status, "cancelled"), gt(schema.events.startsAt, new Date(Date.now() - 30 * 86_400_000))))
    .orderBy(asc(schema.events.startsAt));
}

// Event payments waiting for Finance
export async function eventPaymentsToVerify() {
  const db = await getDb();
  return db
    .select({ p: schema.eventPayments, r: schema.eventRegistrations, e: schema.events })
    .from(schema.eventPayments)
    .innerJoin(schema.eventRegistrations, eq(schema.eventPayments.registrationId, schema.eventRegistrations.id))
    .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
    .where(eq(schema.eventPayments.status, "submitted"))
    .orderBy(asc(schema.eventPayments.createdAt));
}

// URL-friendly, unique slug: "data-governance-workshop-2026-11"
export async function uniqueSlug(title: string, startsAt: Date, exceptId?: string) {
  const base =
    `${title}-${todayKL(startsAt).slice(0, 7)}`
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "event";
  const db = await getDb();
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.slug, slug));
    if (!hit || hit.id === exceptId) return slug;
  }
}
