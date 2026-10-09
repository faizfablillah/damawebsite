import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/db";
import type { Membership, Order, Organisation, Payment, PipelineStatus, ReceiptSnapshot, User } from "@/db/schema";
import { CATEGORY_LABEL, TIERS, type TierCode } from "./config";
import { addDays, daysBetween, fmtDate, rm, termEnd, todayKL } from "./format";
import { getSettings, priceFor } from "./settings";
import { audit } from "./audit";
import { sendEmail, templates } from "./email";
import { receiptPdf } from "./receipt-pdf";
import { pruneAttempts } from "./rate-limit";

export class BusinessError extends Error {}

// ---------- numbering ----------

export async function nextCounter(tx: Tx, key: string, atLeast = 0): Promise<number> {
  const [row] = await tx
    .insert(schema.counters)
    .values({ key, value: Math.max(1, atLeast + 1) })
    .onConflictDoUpdate({
      target: schema.counters.key,
      set: { value: sql`greatest(${schema.counters.value}, ${atLeast}) + 1` },
    })
    .returning();
  return row.value;
}

export async function bumpCounterTo(tx: Tx, key: string, value: number) {
  await tx
    .insert(schema.counters)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.counters.key, set: { value: sql`greatest(${schema.counters.value}, ${value})` } });
}

// IMYKL26-0001 — category, MY, state, 2-digit join year, running number per category per year
export function formatMemberCode(category: string, stateCode: string, yy: number, seq: number) {
  return `${category}MY${stateCode}${String(yy).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
}
export const MEMBER_CODE_RE = /^([EIC])MY([A-Z]{2})(\d{2})-(\d{4})$/;
export const seatCode = (memberCode: string | null, seatNo: number) =>
  memberCode ? `${memberCode}/S${String(seatNo).padStart(2, "0")}` : `Seat ${seatNo}`;

async function ensureMemberCode(tx: Tx, m: Membership): Promise<Membership> {
  if (m.memberCode) return m;
  const today = todayKL();
  const yy = Number(today.slice(2, 4));
  const seq = await nextCounter(tx, `member:${m.category}:${yy}`);
  if (seq > 9999) throw new BusinessError("Member running number exhausted for this year.");
  const [updated] = await tx
    .update(schema.memberships)
    .set({ memberCode: formatMemberCode(m.category, m.stateCode, yy, seq), joinYear: 2000 + yy, seq })
    .where(eq(schema.memberships.id, m.id))
    .returning();
  return updated;
}

async function nextReceiptNo(tx: Tx) {
  const year = todayKL().slice(0, 4);
  const seq = await nextCounter(tx, `receipt:${year}`);
  return `MY/MEM/${year}/${String(seq).padStart(4, "0")}`;
}

// ---------- lookups ----------

export type Owner = { userId: string; name: string; email: string; organisation: Organisation | null; user: User };

export async function ownerOf(tx: Tx, m: Membership): Promise<Owner> {
  if (m.category === "C") {
    const [org] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, m.organisationId!));
    const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, org.contactUserId));
    return { userId: user.id, name: org.contactName, email: org.contactEmail, organisation: org, user };
  }
  const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, m.userId!));
  return { userId: user.id, name: user.name, email: user.email, organisation: null, user };
}

export const orderTotal = (o: Order) => Math.max(0, o.unitPrice - o.discount);
export const orderBalance = (o: Order) => Math.max(0, orderTotal(o) - o.amountPaid);

export function paymentReference(tier: TierCode, name: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
  return `${TIERS[tier].refPrefix} ${clean}`;
}

async function setPipeline(tx: Tx, organisationId: string | null, status: PipelineStatus, onlyFrom?: PipelineStatus[]) {
  if (!organisationId) return;
  const where = onlyFrom
    ? and(eq(schema.organisations.id, organisationId), inArray(schema.organisations.pipelineStatus, onlyFrom))
    : eq(schema.organisations.id, organisationId);
  await tx.update(schema.organisations).set({ pipelineStatus: status }).where(where);
}

// ---------- applications ----------

type ApplicationInput = {
  user: User;
  tier: TierCode;
  stateCode: string;
  background?: string | null;
  topics?: string[];
  preferences?: string[];
  institution?: string | null;
  graduationYear?: number | null;
  studentProof?: { key: string; name: string } | null;
  organisation?: Omit<typeof schema.organisations.$inferInsert, "contactUserId" | "pipelineStatus">;
};

export async function createApplication(input: ApplicationInput) {
  const db = await getDb();
  const settings = await getSettings();
  const tier = TIERS[input.tier];
  const price = priceFor(input.tier, settings);

  const result = await db.transaction(async (tx) => {
    // Lock the applicant so a double-submitted form can't create two memberships
    await tx.execute(sql`select id from users where id = ${input.user.id} for update`);
    if (tier.category !== "C") {
      const existing = await tx
        .select()
        .from(schema.memberships)
        .where(and(eq(schema.memberships.userId, input.user.id), inArray(schema.memberships.status, ["pending", "active", "grace", "suspended"])));
      if (existing.length) throw new BusinessError("You already have a membership. You can manage it from your member portal.");
    }

    let organisationId: string | null = null;
    if (tier.category === "C") {
      const org = input.organisation!;
      const [created] = await tx
        .insert(schema.organisations)
        .values({ ...org, contactUserId: input.user.id, pipelineStatus: org.wantsCall ? "new_lead" : "pending_payment" })
        .returning();
      organisationId = created.id;
    }

    const [m] = await tx
      .insert(schema.memberships)
      .values({
        category: tier.category,
        tier: input.tier,
        userId: tier.category === "C" ? null : input.user.id,
        organisationId,
        stateCode: input.stateCode,
        eligibilityStatus: tier.category === "E" ? "pending" : "not_required",
        institution: input.institution ?? null,
        graduationYear: input.graduationYear ?? null,
        studentProofKey: input.studentProof?.key ?? null,
        studentProofName: input.studentProof?.name ?? null,
        background: input.background ?? null,
        topics: input.topics ?? [],
        preferences: input.preferences ?? [],
      })
      .returning();

    const refName = tier.category === "C" ? input.organisation!.name : input.user.name;
    const [o] = await tx
      .insert(schema.orders)
      .values({
        membershipId: m.id,
        kind: "new",
        itemCode: price.itemCode,
        description: price.description,
        unitPrice: price.unitPrice,
        paymentReference: paymentReference(input.tier, refName),
      })
      .returning();
    await audit(input.user.id, "membership.applied", "membership", m.id, { tier: input.tier }, tx);
    return { membership: m, order: o };
  });

  const links = { userId: input.user.id, membershipId: result.membership.id, organisationId: result.membership.organisationId };
  if (tier.category === "C" && input.organisation?.wantsCall) {
    await sendEmail(input.organisation.contactEmail, "corporateLead", templates.corporateLead(input.organisation.contactName, input.organisation.name), links);
  } else {
    const to = tier.category === "C" ? input.organisation!.contactEmail : input.user.email;
    const name = tier.category === "C" ? input.organisation!.contactName : input.user.name;
    await sendEmail(
      to,
      "applicationReceived",
      templates.applicationReceived(name, tier.category === "C" ? `Corporate — ${tier.label}` : tier.label, rm(orderTotal(result.order)), result.order.paymentReference),
      links,
    );
  }
  return result;
}

export async function createRenewalOrder(membershipId: string, actorId: string) {
  const db = await getDb();
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
    if (!m || !m.memberCode) throw new BusinessError("Only activated memberships can be renewed.");
    if (!["active", "grace", "expired"].includes(m.status)) throw new BusinessError("This membership cannot be renewed right now.");
    const open = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.membershipId, m.id), inArray(schema.orders.status, ["awaiting_payment", "pending_verification", "part_paid"])));
    if (open.length) return open[0];
    const owner = await ownerOf(tx, m);
    const price = priceFor(m.tier, settings);
    const [o] = await tx
      .insert(schema.orders)
      .values({
        membershipId: m.id,
        kind: "renewal",
        itemCode: price.itemCode,
        description: price.description,
        unitPrice: price.unitPrice,
        paymentReference: paymentReference(m.tier, owner.organisation?.name ?? owner.name),
      })
      .returning();
    await audit(actorId, "membership.renewal_started", "membership", m.id, { orderId: o.id }, tx);
    return o;
  });
}

// ---------- payments ----------

export async function submitPayment(input: {
  orderId: string;
  userId: string;
  amount: number;
  paymentDate: string;
  reference: string;
  proof: { key: string; name: string };
}) {
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, input.orderId));
    if (!o || ["paid", "cancelled"].includes(o.status)) throw new BusinessError("This payment is no longer open.");
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, o.membershipId));
    if (["rejected", "cancelled"].includes(m.status)) throw new BusinessError("This application is closed.");
    const owner = await ownerOf(tx, m);
    if (owner.userId !== input.userId) throw new BusinessError("Not allowed.");
    const [p] = await tx
      .insert(schema.payments)
      .values({
        orderId: o.id,
        amount: input.amount,
        paymentDate: input.paymentDate,
        reference: input.reference,
        proofKey: input.proof.key,
        proofName: input.proof.name,
        submittedBy: input.userId,
      })
      .returning();
    await tx.update(schema.orders).set({ status: "pending_verification" }).where(eq(schema.orders.id, o.id));
    await setPipeline(tx, m.organisationId, "payment_review", ["new_lead", "pic_contacted", "invoice_sent", "pending_payment"]);
    await audit(input.userId, "payment.submitted", "payment", p.id, { amount: input.amount }, tx);
    return { payment: p, membership: m, owner };
  });
  await sendEmail(res.owner.email, "paymentSubmitted", templates.paymentSubmitted(res.owner.name, rm(input.amount)), {
    userId: res.owner.userId,
    membershipId: res.membership.id,
    organisationId: res.membership.organisationId,
  });
  return res.payment;
}

type Activation = { kind: "new" | "renewal"; start: string; end: string };

// graceDays is read before the transaction: queries outside `tx` would wait on the open transaction.
async function tryActivate(tx: Tx, membershipId: string, orderId: string, graceDays: number): Promise<Activation | null> {
  const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (o.status !== "paid" || o.periodStart) return null;
  if (m.category === "E" && m.eligibilityStatus !== "approved") return null;
  if (["rejected", "cancelled"].includes(m.status)) return null;

  const today = todayKL();
  const continuous = o.kind === "renewal" && m.endDate && today <= addDays(m.endDate, graceDays);
  const start = continuous ? addDays(m.endDate!, 1) : today;
  const end = termEnd(start);

  await tx.update(schema.orders).set({ periodStart: start, periodEnd: end }).where(eq(schema.orders.id, o.id));
  await tx
    .update(schema.memberships)
    .set({
      status: "active",
      startDate: continuous ? m.startDate : start,
      endDate: end,
      activatedAt: m.activatedAt ?? new Date(),
    })
    .where(eq(schema.memberships.id, m.id));

  if (m.category === "C") {
    const want = TIERS[m.tier].seats;
    const existing = await tx.select().from(schema.seats).where(eq(schema.seats.membershipId, m.id));
    for (let n = existing.length + 1; n <= want; n++) await tx.insert(schema.seats).values({ membershipId: m.id, seatNo: n });
    const filled = existing.filter((s) => s.email).length;
    await setPipeline(tx, m.organisationId, filled ? "active" : "pending_user_list");
  }
  return { kind: o.kind, start, end };
}

const METHOD_LABEL: Record<string, string> = { bank_transfer: "Bank Transfer", duitnow: "DuitNow", cheque: "Cheque", cash: "Cash", other: "Other" };

async function issueReceipt(tx: Tx, p: Payment, o: Order, m: Membership, previouslyPaid: number): Promise<ReceiptSnapshot & { id: string }> {
  const owner = await ownerOf(tx, m);
  const total = orderTotal(o);
  const payer =
    m.category === "C"
      ? [
          { label: "Organisation Name", value: owner.organisation!.name },
          { label: "Company Reg. No.", value: owner.organisation!.ssmNo },
          { label: "Contact Person", value: owner.organisation!.contactName },
          { label: "Job Title", value: owner.organisation!.contactJobTitle ?? "" },
          { label: "Email Address", value: owner.organisation!.contactEmail },
          { label: "Phone Number", value: owner.organisation!.contactPhone },
          { label: "State", value: owner.organisation!.stateCode },
        ]
      : [
          { label: "Full Name", value: owner.user.name },
          { label: "Email Address", value: owner.user.email },
          { label: "Phone Number", value: owner.user.phone },
          { label: m.category === "E" ? "Institution" : "Company Name", value: (m.category === "E" ? m.institution : owner.user.organisation) ?? "" },
          { label: "Job Title", value: owner.user.jobTitle ?? (m.category === "E" ? "Student" : "") },
          { label: "State", value: m.stateCode },
        ];
  const snapshot: ReceiptSnapshot = {
    receiptNo: await nextReceiptNo(tx),
    receiptDate: todayKL(),
    category: m.category,
    memberCode: m.memberCode,
    periodStart: o.periodStart,
    periodEnd: o.periodEnd,
    periodNote: o.periodStart ? null : o.status === "paid" ? "Starts on activation" : "Starts on full payment",
    payer,
    method: METHOD_LABEL[p.method] ?? p.method,
    paymentDate: p.paymentDate,
    paymentReference: p.reference,
    itemCode: o.itemCode,
    description: o.description,
    unitPrice: o.unitPrice,
    discount: o.discount,
    total,
    amountReceived: p.amount,
    previouslyPaid,
    balance: Math.max(0, total - previouslyPaid - p.amount),
    status: previouslyPaid + p.amount >= total ? "PAID IN FULL" : "PART PAYMENT",
    seats: m.category === "C" ? TIERS[m.tier].seats : null,
  };
  const [r] = await tx.insert(schema.receipts).values({ receiptNo: snapshot.receiptNo, orderId: o.id, paymentId: p.id, data: snapshot }).returning();
  return { ...snapshot, id: r.id };
}

async function receiptAttachment(snapshot: ReceiptSnapshot) {
  const { website } = await getSettings();
  return { filename: `DAMA Receipt ${snapshot.receiptNo.replace(/\//g, "-")}.pdf`, content: await receiptPdf(snapshot, website), contentType: "application/pdf" };
}

// After a payment is verified (or recorded): update order, assign ID, activate if possible, issue receipt.
async function applyVerifiedPayment(tx: Tx, p: Payment, graceDays: number) {
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, p.orderId));
  let [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, o.membershipId));
  const previouslyPaid = o.amountPaid;
  const paid = previouslyPaid + p.amount;
  const status = paid >= orderTotal(o) ? "paid" : "part_paid";
  await tx
    .update(schema.orders)
    .set({ amountPaid: paid, status, paidAt: status === "paid" ? new Date() : null })
    .where(eq(schema.orders.id, o.id));
  m = await ensureMemberCode(tx, m);
  const activation = await tryActivate(tx, m.id, o.id, graceDays);
  if (status === "part_paid") await setPipeline(tx, m.organisationId, "pending_payment", ["payment_review"]);
  const [freshOrder] = await tx.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  const [freshM] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, m.id));
  const receipt = await issueReceipt(tx, p, freshOrder, freshM, previouslyPaid);
  return { membership: freshM, order: freshOrder, activation, receipt };
}

async function notifyAfterPayment(result: Awaited<ReturnType<typeof applyVerifiedPayment>>) {
  const db = await getDb();
  const owner = await ownerOf(db as unknown as Tx, result.membership);
  const links = { userId: owner.userId, membershipId: result.membership.id, organisationId: result.membership.organisationId };
  const attachment = await receiptAttachment(result.receipt);
  const m = result.membership;
  const a = result.activation;
  if (a?.kind === "new") {
    if (m.category === "C") {
      await sendEmail(owner.email, "corporateActive", templates.corporateActive(owner.name, owner.organisation!.name, m.memberCode!, TIERS[m.tier].seats, fmtDate(a.end)), links, [attachment]);
    } else {
      await sendEmail(owner.email, "welcome", templates.welcome(owner.name, `${CATEGORY_LABEL[m.category]} — ${TIERS[m.tier].label}`, m.memberCode!, fmtDate(a.start), fmtDate(a.end)), links, [attachment]);
    }
  } else if (a?.kind === "renewal") {
    await sendEmail(owner.email, "renewed", templates.renewed(owner.name, m.memberCode!, fmtDate(a.start), fmtDate(a.end)), links, [attachment]);
  } else if (result.order.status === "part_paid") {
    await sendEmail(owner.email, "partPayment", templates.partPayment(owner.name, rm(result.receipt.amountReceived), rm(result.receipt.balance), result.receipt.receiptNo), links, [attachment]);
  } else if (m.category === "E" && m.eligibilityStatus === "pending") {
    await sendEmail(owner.email, "awaitingEligibility", templates.awaitingEligibility(owner.name), links, [attachment]);
  } else {
    await sendEmail(owner.email, "receiptIssued", templates.receiptIssued(owner.name, rm(result.receipt.amountReceived), result.receipt.receiptNo), links, [attachment]);
  }
}

export async function verifyPayment(paymentId: string, adminId: string, amount?: number) {
  const db = await getDb();
  const { graceDays } = await getSettings();
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.payments).where(eq(schema.payments.id, paymentId));
    if (!p || p.status !== "submitted") throw new BusinessError("This payment has already been processed.");
    const [updated] = await tx
      .update(schema.payments)
      .set({ status: "verified", amount: amount ?? p.amount, verifiedBy: adminId, verifiedAt: new Date() })
      .where(and(eq(schema.payments.id, p.id), eq(schema.payments.status, "submitted")))
      .returning();
    if (!updated) throw new BusinessError("This payment has already been processed.");
    const r = await applyVerifiedPayment(tx, updated, graceDays);
    await audit(adminId, "payment.verified", "payment", p.id, { amount: updated.amount, receiptNo: r.receipt.receiptNo }, tx);
    return r;
  });
  await notifyAfterPayment(result);
  return result;
}

export async function recordOfflinePayment(input: {
  orderId: string;
  adminId: string;
  amount: number;
  method: Payment["method"];
  paymentDate: string;
  reference: string;
  note?: string | null;
}) {
  const db = await getDb();
  const { graceDays } = await getSettings();
  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, input.orderId));
    if (!o || ["paid", "cancelled"].includes(o.status)) throw new BusinessError("This order is not open for payment.");
    const [p] = await tx
      .insert(schema.payments)
      .values({
        orderId: o.id,
        amount: input.amount,
        method: input.method,
        paymentDate: input.paymentDate,
        reference: input.reference,
        note: input.note ?? null,
        status: "verified",
        submittedBy: input.adminId,
        verifiedBy: input.adminId,
        verifiedAt: new Date(),
      })
      .returning();
    const r = await applyVerifiedPayment(tx, p, graceDays);
    await audit(input.adminId, "payment.recorded", "payment", p.id, { amount: input.amount, receiptNo: r.receipt.receiptNo }, tx);
    return r;
  });
  await notifyAfterPayment(result);
  return result;
}

export async function rejectPayment(paymentId: string, adminId: string, reason: string) {
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.payments).where(eq(schema.payments.id, paymentId));
    if (!p || p.status !== "submitted") throw new BusinessError("This payment has already been processed.");
    // Only a still-submitted payment can be rejected (guards against a verify landing at the same moment)
    const [rejected] = await tx
      .update(schema.payments)
      .set({ status: "rejected", rejectReason: reason, verifiedBy: adminId, verifiedAt: new Date() })
      .where(and(eq(schema.payments.id, p.id), eq(schema.payments.status, "submitted")))
      .returning();
    if (!rejected) throw new BusinessError("This payment has already been processed.");
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, p.orderId));
    const others = await tx.select().from(schema.payments).where(and(eq(schema.payments.orderId, o.id), eq(schema.payments.status, "submitted")));
    if (!others.length) {
      await tx.update(schema.orders).set({ status: o.amountPaid > 0 ? "part_paid" : "awaiting_payment" }).where(eq(schema.orders.id, o.id));
    }
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, o.membershipId));
    await setPipeline(tx, m.organisationId, "pending_payment", ["payment_review"]);
    await audit(adminId, "payment.rejected", "payment", p.id, { reason }, tx);
    return { p, m, owner: await ownerOf(tx, m) };
  });
  await sendEmail(res.owner.email, "paymentRejected", templates.paymentRejected(res.owner.name, rm(res.p.amount), reason), {
    userId: res.owner.userId,
    membershipId: res.m.id,
    organisationId: res.m.organisationId,
  });
}

export async function setOrderDiscount(orderId: string, discount: number, adminId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!o || ["paid", "cancelled"].includes(o.status)) throw new BusinessError("Discounts can only be changed before the order is fully paid.");
    if (discount < 0 || discount > o.unitPrice) throw new BusinessError("Discount must be between 0 and the unit price.");
    await tx.update(schema.orders).set({ discount }).where(eq(schema.orders.id, orderId));
    await audit(adminId, "order.discount", "order", orderId, { discount }, tx);
  });
}

// ---------- student eligibility ----------

export async function decideEligibility(membershipId: string, adminId: string, approve: boolean, note: string | null) {
  const db = await getDb();
  const { graceDays } = await getSettings();
  const res = await db.transaction(async (tx) => {
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
    if (!m || m.category !== "E") throw new BusinessError("Not a student membership.");
    await tx
      .update(schema.memberships)
      .set({ eligibilityStatus: approve ? "approved" : "rejected", eligibilityNote: note, status: approve ? m.status : "rejected" })
      .where(eq(schema.memberships.id, m.id));
    await audit(adminId, approve ? "eligibility.approved" : "eligibility.rejected", "membership", m.id, { note }, tx);
    let activation: Activation | null = null;
    let lastReceipt: ReceiptSnapshot | null = null;
    if (approve) {
      const [paidOrder] = await tx
        .select()
        .from(schema.orders)
        .where(and(eq(schema.orders.membershipId, m.id), eq(schema.orders.status, "paid")))
        .orderBy(desc(schema.orders.createdAt))
        .limit(1);
      if (paidOrder) {
        activation = await tryActivate(tx, m.id, paidOrder.id, graceDays);
        const [r] = await tx.select().from(schema.receipts).where(eq(schema.receipts.orderId, paidOrder.id)).orderBy(desc(schema.receipts.issuedAt)).limit(1);
        lastReceipt = r?.data ?? null;
      }
    } else {
      await tx
        .update(schema.orders)
        .set({ status: "cancelled" })
        .where(and(eq(schema.orders.membershipId, m.id), inArray(schema.orders.status, ["awaiting_payment", "pending_verification"])));
    }
    const [fresh] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, m.id));
    return { m: fresh, activation, lastReceipt, owner: await ownerOf(tx, fresh) };
  });
  const links = { userId: res.owner.userId, membershipId: res.m.id };
  if (!approve) {
    await sendEmail(res.owner.email, "eligibilityRejected", templates.eligibilityRejected(res.owner.name, note || "We could not verify your student status."), links);
  } else if (res.activation && res.m.memberCode) {
    const attachments = res.lastReceipt ? [await receiptAttachment({ ...res.lastReceipt, periodStart: res.activation.start, periodEnd: res.activation.end, periodNote: null })] : [];
    await sendEmail(res.owner.email, "welcome", templates.welcome(res.owner.name, "Student — Educational (Student)", res.m.memberCode, fmtDate(res.activation.start), fmtDate(res.activation.end)), links, attachments);
  }
}

// ---------- admin status changes ----------

export async function setMembershipStatus(membershipId: string, status: "active" | "suspended" | "cancelled", adminId: string, note?: string) {
  const db = await getDb();
  const { graceDays } = await getSettings();
  await db.transaction(async (tx) => {
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
    if (!m) throw new BusinessError("Membership not found.");
    if (status === "active" && (!m.endDate || !m.memberCode)) throw new BusinessError("Only memberships that have been activated before can be reactivated.");
    let next: Membership["status"] = status;
    if (status === "active") {
      const today = todayKL();
      next = m.endDate! >= today ? "active" : today <= addDays(m.endDate!, graceDays) ? "grace" : "expired";
    }
    await tx.update(schema.memberships).set({ status: next }).where(eq(schema.memberships.id, m.id));
    await audit(adminId, `membership.${status}`, "membership", m.id, { from: m.status, to: next, note }, tx);
  });
}

// ---------- corporate seats ----------

export async function assignSeat(input: { seatId: string; actorId: string; asAdmin: boolean; name: string; jobTitle: string | null; email: string; phone: string | null; reason?: string | null }) {
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [seat] = await tx.select().from(schema.seats).where(eq(schema.seats.id, input.seatId));
    if (!seat) throw new BusinessError("Seat not found.");
    const [m] = await tx.select().from(schema.memberships).where(eq(schema.memberships.id, seat.membershipId));
    const [org] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, m.organisationId!));
    if (!input.asAdmin) {
      if (org.contactUserId !== input.actorId) throw new BusinessError("Not allowed.");
      if (!["active", "grace"].includes(m.status)) throw new BusinessError("Seats can be assigned once the membership is active.");
    }
    const email = input.email.toLowerCase();
    const dup = await tx
      .select()
      .from(schema.seats)
      .where(and(eq(schema.seats.membershipId, m.id), sql`lower(${schema.seats.email}) = ${email}`));
    if (dup.some((d) => d.id !== seat.id)) throw new BusinessError("This person already holds a seat in your membership.");

    if (seat.email && !input.asAdmin) {
      // Replacing someone needs approval from the chapter (receipt note 4)
      const [req] = await tx
        .insert(schema.seatRequests)
        .values({ seatId: seat.id, requestedBy: input.actorId, name: input.name, jobTitle: input.jobTitle, email, phone: input.phone, reason: input.reason ?? null })
        .returning();
      await audit(input.actorId, "seat.change_requested", "seat", seat.id, { requestId: req.id }, tx);
      return { kind: "requested" as const };
    }
    await tx
      .update(schema.seats)
      .set({ name: input.name, jobTitle: input.jobTitle, email, phone: input.phone, assignedAt: todayKL() })
      .where(eq(schema.seats.id, seat.id));
    await setPipeline(tx, org.id, "active", ["pending_user_list"]);
    await audit(input.actorId, "seat.assigned", "seat", seat.id, { email, previous: seat.email }, tx);
    return { kind: "assigned" as const, code: seatCode(m.memberCode, seat.seatNo), org, m };
  });
  if (res.kind === "assigned") {
    await sendEmail(input.email, "seatInvite", templates.seatInvite(input.name, res.org.name, res.code), { membershipId: res.m.id, organisationId: res.org.id });
  }
  return res.kind;
}

export async function clearSeat(seatId: string, adminId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [seat] = await tx.select().from(schema.seats).where(eq(schema.seats.id, seatId));
    await tx.update(schema.seats).set({ name: null, jobTitle: null, email: null, phone: null, assignedAt: null }).where(eq(schema.seats.id, seatId));
    await audit(adminId, "seat.cleared", "seat", seatId, { previous: seat?.email }, tx);
  });
}

export async function decideSeatRequest(requestId: string, adminId: string, approve: boolean) {
  const db = await getDb();
  const [req] = await db.select().from(schema.seatRequests).where(eq(schema.seatRequests.id, requestId));
  if (!req || req.status !== "pending") throw new BusinessError("This request has already been handled.");
  if (approve) {
    await assignSeat({ seatId: req.seatId, actorId: adminId, asAdmin: true, name: req.name, jobTitle: req.jobTitle, email: req.email, phone: req.phone });
  }
  await db.update(schema.seatRequests).set({ status: approve ? "approved" : "rejected", decidedBy: adminId, decidedAt: new Date() }).where(eq(schema.seatRequests.id, requestId));
  await audit(adminId, approve ? "seat.request_approved" : "seat.request_rejected", "seat_request", requestId);
}

// ---------- daily tasks: statuses and renewal reminders ----------

export async function refreshStatuses() {
  const db = await getDb();
  const { graceDays } = await getSettings();
  const today = todayKL();
  const graceCutoff = addDays(today, -graceDays);
  await db
    .update(schema.memberships)
    .set({ status: "grace" })
    .where(and(eq(schema.memberships.status, "active"), lt(schema.memberships.endDate, today), sql`${schema.memberships.endDate} >= ${graceCutoff}`));
  await db
    .update(schema.memberships)
    .set({ status: "expired" })
    .where(and(inArray(schema.memberships.status, ["active", "grace"]), lt(schema.memberships.endDate, graceCutoff)));
  // Early renewals that start today make lapsed rows active again
  await db
    .update(schema.memberships)
    .set({ status: "active" })
    .where(and(inArray(schema.memberships.status, ["grace", "expired"]), sql`${schema.memberships.endDate} >= ${today}`));
}

export async function runDailyTasks() {
  await refreshStatuses();
  await pruneAttempts();
  const db = await getDb();
  const settings = await getSettings();
  const today = todayKL();
  const thresholds = [...settings.reminderDays].sort((a, b) => b - a);
  const rows = await db
    .select()
    .from(schema.memberships)
    .where(and(inArray(schema.memberships.status, ["active", "grace", "expired"]), isNotNull(schema.memberships.endDate), isNotNull(schema.memberships.memberCode)))
    .orderBy(asc(schema.memberships.endDate));
  let sent = 0;
  for (const m of rows) {
    const daysLeft = daysBetween(today, m.endDate!);
    let kind: string | null = null;
    if (m.status === "active" && daysLeft >= 0) {
      const applicable = thresholds.filter((t) => daysLeft <= t);
      if (applicable.length) kind = String(applicable[applicable.length - 1]);
    } else if (m.status === "grace") kind = "grace";
    else if (m.status === "expired" && daysLeft >= -(settings.graceDays + 7)) kind = "expired";
    if (!kind) continue;
    const done = await db
      .select()
      .from(schema.renewalReminders)
      .where(and(eq(schema.renewalReminders.membershipId, m.id), eq(schema.renewalReminders.endDate, m.endDate!)));
    const doneKinds = new Set(done.map((d) => d.kind));
    if (doneKinds.has(kind)) continue;
    // Skip a renewal that is already paid and waiting to start
    const owner = await ownerOf(db as unknown as Tx, m);
    const links = { userId: owner.userId, membershipId: m.id, organisationId: m.organisationId };
    const mail =
      kind === "grace"
        ? templates.graceReminder(owner.name, m.memberCode!, fmtDate(m.endDate), fmtDate(addDays(m.endDate!, settings.graceDays)))
        : kind === "expired"
          ? templates.expired(owner.name, m.memberCode!)
          : templates.renewalReminder(owner.name, m.memberCode!, fmtDate(m.endDate), Math.max(daysLeft, 0));
    await sendEmail(owner.email, kind === "grace" ? "graceReminder" : kind === "expired" ? "expired" : "renewalReminder", mail, links);
    // Record this reminder and any larger thresholds that were skipped
    const toRecord = /^\d+$/.test(kind) ? thresholds.filter((t) => t >= Number(kind)).map(String) : [kind];
    for (const k of toRecord) {
      if (!doneKinds.has(k)) await db.insert(schema.renewalReminders).values({ membershipId: m.id, endDate: m.endDate!, kind: k }).onConflictDoNothing();
    }
    sent++;
  }
  return { sent };
}
