import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Category, Role, TierCode } from "@/lib/config";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
// Money is stored in sen (RM 1.00 = 100)

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(), // always lower-case
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  jobTitle: text("job_title"),
  organisation: text("organisation"),
  address: text("address"),
  stateCode: text("state_code"),
  role: text("role").$type<Role>().notNull().default("member"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  consentVersion: text("consent_version"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const authTokens = pgTable("auth_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").$type<"verify_email" | "reset_password">().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export type PipelineStatus =
  | "new_lead"
  | "pic_contacted"
  | "invoice_sent"
  | "pending_payment"
  | "payment_review"
  | "pending_user_list"
  | "active"
  | "closed";

export const organisations = pgTable("organisations", {
  id: id(),
  name: text("name").notNull(),
  ssmNo: text("ssm_no").notNull(),
  industry: text("industry"),
  orgSize: text("org_size"),
  address: text("address"),
  stateCode: text("state_code").notNull(),
  contactUserId: uuid("contact_user_id").notNull().references(() => users.id),
  contactName: text("contact_name").notNull(),
  contactJobTitle: text("contact_job_title"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  areasOfInterest: jsonb("areas_of_interest").$type<string[]>().notNull().default([]),
  remarks: text("remarks"),
  wantsCall: boolean("wants_call").notNull().default(false),
  pipelineStatus: text("pipeline_status").$type<PipelineStatus>().notNull().default("new_lead"),
  assignedPicId: uuid("assigned_pic_id").references(() => users.id),
  createdAt: createdAt(),
});

export const orgNotes = pgTable("org_notes", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const orgDocuments = pgTable("org_documents", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"proposal" | "invoice" | "other">().notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: createdAt(),
});

export type MembershipStatus = "pending" | "active" | "grace" | "expired" | "suspended" | "rejected" | "cancelled";
export type EligibilityStatus = "not_required" | "pending" | "approved" | "rejected";

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    category: text("category").$type<Category>().notNull(),
    tier: text("tier").$type<TierCode>().notNull(),
    userId: uuid("user_id").references(() => users.id), // Student / Individual
    organisationId: uuid("organisation_id").references(() => organisations.id), // Corporate
    stateCode: text("state_code").notNull(),
    memberCode: text("member_code").unique(), // e.g. IMYKL26-0001, assigned on first verified payment
    joinYear: integer("join_year"),
    seq: integer("seq"),
    status: text("status").$type<MembershipStatus>().notNull().default("pending"),
    eligibilityStatus: text("eligibility_status").$type<EligibilityStatus>().notNull().default("not_required"),
    eligibilityNote: text("eligibility_note"),
    institution: text("institution"),
    graduationYear: integer("graduation_year"),
    studentProofKey: text("student_proof_key"),
    studentProofName: text("student_proof_name"),
    background: text("background"),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    preferences: jsonb("preferences").$type<string[]>().notNull().default([]),
    startDate: date("start_date"),
    endDate: date("end_date"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    imported: boolean("imported").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("memberships_user_idx").on(t.userId), index("memberships_org_idx").on(t.organisationId)],
);

export type OrderStatus = "awaiting_payment" | "pending_verification" | "part_paid" | "paid" | "cancelled";

export const orders = pgTable(
  "orders",
  {
    id: id(),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"new" | "renewal">().notNull(),
    itemCode: text("item_code").notNull(),
    description: text("description").notNull(),
    unitPrice: integer("unit_price").notNull(),
    discount: integer("discount").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    status: text("status").$type<OrderStatus>().notNull().default("awaiting_payment"),
    paymentReference: text("payment_reference").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("orders_membership_idx").on(t.membershipId)],
);

export type PaymentStatus = "submitted" | "verified" | "rejected";
export type PaymentMethod = "bank_transfer" | "duitnow" | "cheque" | "cash" | "other";

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: text("method").$type<PaymentMethod>().notNull().default("bank_transfer"),
    paymentDate: date("payment_date").notNull(),
    reference: text("reference").notNull(),
    proofKey: text("proof_key"),
    proofName: text("proof_name"),
    status: text("status").$type<PaymentStatus>().notNull().default("submitted"),
    rejectReason: text("reject_reason"),
    note: text("note"),
    submittedBy: uuid("submitted_by").references(() => users.id),
    verifiedBy: uuid("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_status_idx").on(t.status)],
);

export type ReceiptSnapshot = {
  receiptNo: string;
  receiptDate: string; // YYYY-MM-DD
  category: Category;
  memberCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodNote: string | null;
  payer: { label: string; value: string }[];
  method: string;
  paymentDate: string;
  paymentReference: string;
  itemCode: string;
  description: string;
  unitPrice: number;
  discount: number;
  total: number;
  amountReceived: number; // this payment
  previouslyPaid: number;
  balance: number;
  status: "PAID IN FULL" | "PART PAYMENT";
  seats: number | null;
};

export const receipts = pgTable("receipts", {
  id: id(),
  receiptNo: text("receipt_no").notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").notNull().unique().references(() => payments.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<ReceiptSnapshot>().notNull(),
  issuedAt: createdAt(),
});

export const seats = pgTable(
  "seats",
  {
    id: id(),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    seatNo: integer("seat_no").notNull(),
    name: text("name"),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    assignedAt: date("assigned_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("seats_membership_no_idx").on(t.membershipId, t.seatNo), index("seats_email_idx").on(sql`lower(${t.email})`)],
);

export const seatRequests = pgTable("seat_requests", {
  id: id(),
  seatId: uuid("seat_id").notNull().references(() => seats.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by").references(() => users.id),
  name: text("name").notNull(),
  jobTitle: text("job_title"),
  email: text("email").notNull(),
  phone: text("phone"),
  reason: text("reason"),
  status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const counters = pgTable("counters", {
  key: text("key").primaryKey(), // e.g. member:I:26, receipt:2026
  value: integer("value").notNull().default(0),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "set null" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    status: text("status").$type<"sent" | "failed">().notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("email_log_membership_idx").on(t.membershipId)],
);

export const renewalReminders = pgTable(
  "renewal_reminders",
  {
    id: id(),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id, { onDelete: "cascade" }),
    endDate: date("end_date").notNull(),
    kind: text("kind").notNull(), // "30", "14", "7", "grace", "expired"
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex("renewal_reminders_unique").on(t.membershipId, t.endDate, t.kind)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

// Recent login / password-reset / sign-up attempts, used for rate limiting (pruned daily)
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: id(),
    kind: text("kind").$type<"login_failed" | "reset_request" | "signup">().notNull(),
    key: text("key").notNull(), // "email:<address>" or "ip:<address>"
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_lookup_idx").on(t.kind, t.key, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
