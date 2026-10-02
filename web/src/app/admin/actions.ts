"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { PaymentMethod, PipelineStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ROLES, type Role } from "@/lib/config";
import { parseRinggit, todayKL } from "@/lib/format";
import { keepValues, type FormState } from "@/lib/form-state";
import { audit } from "@/lib/audit";
import {
  assignSeat,
  BusinessError,
  clearSeat,
  decideEligibility,
  decideSeatRequest,
  recordOfflinePayment,
  rejectPayment,
  runDailyTasks,
  setMembershipStatus,
  setOrderDiscount,
  verifyPayment,
} from "@/lib/membership";
import { saveFile, UploadError, validateUpload } from "@/lib/storage";
import { saveSettings, getSettings, type Settings } from "@/lib/settings";
import { sendEmail, templates } from "@/lib/email";
import { importMembers } from "@/lib/import";

// After a successful action, go back to the same admin page with a confirmation banner.
// (The row or form that triggered the action often disappears, so an inline message would be lost.)
async function done(msg: string): Promise<never> {
  revalidatePath("/admin", "layout");
  const ref = (await headers()).get("referer");
  const url = new URL(ref && new URL(ref).pathname.startsWith("/admin") ? ref : "http://local/admin");
  url.searchParams.set("msg", msg);
  redirect(`${url.pathname}${url.search}`);
}
function oops(e: unknown, data?: FormData): FormState {
  if (e instanceof BusinessError || e instanceof UploadError) return { error: e.message, values: data ? keepValues(data) : undefined };
  throw e;
}

// ---------- payments ----------

export async function verifyPaymentAction(paymentId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const amount = parseRinggit(String(data.get("amount") ?? ""));
  if (!amount) return { error: "Enter the amount actually received." };
  try {
    const r = await verifyPayment(paymentId, admin.id, amount);
    return done(
      r.order.status === "paid"
        ? `Verified. Receipt ${r.receipt.receiptNo} issued${r.activation ? ` and membership ${r.membership.memberCode} activated` : ""}.`
        : `Part payment verified. Receipt ${r.receipt.receiptNo} issued; balance remains.`,
    );
  } catch (e) {
    return oops(e);
  }
}

export async function rejectPaymentAction(paymentId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const reason = String(data.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Please give the member a short reason." };
  try {
    await rejectPayment(paymentId, admin.id, reason);
    return done("Payment rejected and the member has been emailed.");
  } catch (e) {
    return oops(e);
  }
}

const offlineSchema = z.object({
  amount: z.string().min(1),
  method: z.enum(["bank_transfer", "duitnow", "cheque", "cash", "other"]),
  paymentDate: z.iso.date(),
  reference: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
});

export async function recordPaymentAction(orderId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const parsed = offlineSchema.safeParse(Object.fromEntries(data));
  const amount = parsed.success ? parseRinggit(parsed.data.amount) : null;
  if (!parsed.success || !amount) return { error: "Enter the amount, method, date and reference.", values: keepValues(data) };
  if (parsed.data.paymentDate > todayKL()) return { error: "The payment date can't be in the future.", values: keepValues(data) };
  try {
    const r = await recordOfflinePayment({ orderId, adminId: admin.id, amount, method: parsed.data.method as PaymentMethod, paymentDate: parsed.data.paymentDate, reference: parsed.data.reference, note: parsed.data.note });
    return done(`Payment recorded. Receipt ${r.receipt.receiptNo} issued.`);
  } catch (e) {
    return oops(e, data);
  }
}

export async function discountAction(orderId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const discount = parseRinggit(String(data.get("discount") ?? "0"));
  if (discount === null) return { error: "Enter a valid amount." };
  try {
    await setOrderDiscount(orderId, discount, admin.id);
    return done("Discount saved.");
  } catch (e) {
    return oops(e);
  }
}

// ---------- membership ----------

export async function eligibilityAction(membershipId: string, approve: boolean, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  const note = String(data.get("note") ?? "").trim() || null;
  if (!approve && (!note || note.length < 5)) return { error: "Please give the student a reason." };
  try {
    await decideEligibility(membershipId, admin.id, approve, note);
    return done(approve ? "Eligibility approved." : "Eligibility rejected and the student has been emailed.");
  } catch (e) {
    return oops(e);
  }
}

export async function membershipStatusAction(membershipId: string, status: "active" | "suspended" | "cancelled", _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  try {
    await setMembershipStatus(membershipId, status, admin.id, String(data.get("note") ?? "") || undefined);
    return done("Status updated.");
  } catch (e) {
    return oops(e);
  }
}

export async function resendEmailAction(membershipId: string, kind: "welcome" | "verify", _: FormState): Promise<FormState> {
  const admin = await requireAdmin("members");
  const db = await getDb();
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.id, membershipId));
  if (!m) return { error: "Not found." };
  const { loadMembership } = await import("@/lib/queries");
  const b = (await loadMembership(m.id))!;
  const person = b.user ?? b.contact!;
  if (kind === "verify") {
    if (person.emailVerifiedAt) return { error: "This email address is already verified." };
    const { createAuthToken } = await import("@/lib/auth");
    const token = await createAuthToken(person.id, "verify_email");
    await sendEmail(person.email, "verifyEmail", templates.verifyEmail(person.name, token), { userId: person.id, membershipId: m.id });
  } else {
    if (!m.memberCode || !m.endDate) return { error: "The membership isn't active yet." };
    const name = b.organisation?.contactName ?? person.name;
    const to = b.organisation?.contactEmail ?? person.email;
    await sendEmail(to, "welcome", templates.welcome(name, b.organisation ? `Corporate — ${b.organisation.name}` : "DAMA", m.memberCode, m.startDate ?? "", m.endDate), { userId: person.id, membershipId: m.id, organisationId: m.organisationId });
  }
  await audit(admin.id, `email.resend_${kind}`, "membership", m.id);
  return done("Email sent.");
}

// ---------- corporate ----------

export async function pipelineAction(organisationId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  const status = String(data.get("pipelineStatus")) as PipelineStatus;
  const pic = String(data.get("assignedPicId") ?? "");
  const db = await getDb();
  await db
    .update(schema.organisations)
    .set({ pipelineStatus: status, assignedPicId: pic || null })
    .where(eq(schema.organisations.id, organisationId));
  await audit(admin.id, "organisation.pipeline", "organisation", organisationId, { status, pic });
  return done("Saved.");
}

export async function orgNoteAction(organisationId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  const body = String(data.get("body") ?? "").trim();
  if (!body) return { error: "Write a note first." };
  const db = await getDb();
  await db.insert(schema.orgNotes).values({ organisationId, authorId: admin.id, body });
  return done("Note added.");
}

export async function orgDocumentAction(organisationId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  const kind = String(data.get("kind")) as "proposal" | "invoice" | "other";
  try {
    const upload = await validateUpload(data.get("file"), "a document");
    const key = await saveFile("corporate-docs", upload!);
    const db = await getDb();
    await db.insert(schema.orgDocuments).values({ organisationId, kind, fileKey: key, fileName: upload!.name, uploadedBy: admin.id });
    await audit(admin.id, "organisation.document", "organisation", organisationId, { kind, name: upload!.name });
    return done("Document uploaded.");
  } catch (e) {
    return oops(e);
  }
}

const seatSchema = z.object({
  name: z.string().trim().min(2, "Enter a name."),
  jobTitle: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: z.string().trim().optional(),
});

export async function adminSeatAction(seatId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("members");
  if (data.get("clear") === "yes") {
    await clearSeat(seatId, admin.id);
    return done("Seat cleared.");
  }
  const parsed = seatSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keepValues(data) };
  try {
    await assignSeat({ seatId, actorId: admin.id, asAdmin: true, name: parsed.data.name, jobTitle: parsed.data.jobTitle || null, email: parsed.data.email, phone: parsed.data.phone || null });
    return done("Seat saved and the person has been emailed.");
  } catch (e) {
    return oops(e, data);
  }
}

export async function seatRequestAction(requestId: string, approve: boolean, _: FormState): Promise<FormState> {
  const admin = await requireAdmin("members");
  try {
    await decideSeatRequest(requestId, admin.id, approve);
    return done(approve ? "Seat change approved." : "Seat change rejected.");
  } catch (e) {
    return oops(e);
  }
}

// ---------- renewals / daily tasks ----------

export async function runDailyAction(_: FormState): Promise<FormState> {
  await requireAdmin("members");
  const r = await runDailyTasks();
  return done(`Statuses refreshed. ${r.sent} reminder email${r.sent === 1 ? "" : "s"} sent.`);
}

// ---------- settings ----------

export async function settingsAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("settings");
  const current = await getSettings();
  const price = (k: string) => parseRinggit(String(data.get(k) ?? ""));
  const prices = {
    EDU: price("EDU"),
    IND_EB: price("IND_EB"),
    IND_STD: price("IND_STD"),
    COR_S: price("COR_S"),
    COR_M: price("COR_M"),
    COR_L: price("COR_L"),
    COR_P: price("COR_P"),
  };
  if (Object.values(prices).some((p) => !p)) return { error: "Every price must be a positive amount.", values: keepValues(data) };
  const graceDays = Number(data.get("graceDays"));
  const reminderDays = String(data.get("reminderDays") ?? "")
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 120);
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 120) return { error: "Grace period must be 0–120 days.", values: keepValues(data) };
  const next: Partial<Settings> = {
    prices: prices as Settings["prices"],
    individualPricing: data.get("individualPricing") === "standard" ? "standard" : "early_bird",
    bank: {
      bankName: String(data.get("bankName") ?? "").trim() || current.bank.bankName,
      accountName: String(data.get("accountName") ?? "").trim() || current.bank.accountName,
      accountNumber: String(data.get("accountNumber") ?? "").trim(),
      duitNowNote: String(data.get("duitNowNote") ?? "").trim(),
    },
    graceDays,
    reminderDays: reminderDays.length ? [...new Set(reminderDays)].sort((a, b) => b - a) : current.reminderDays,
    website: String(data.get("website") ?? "").trim(),
  };
  await saveSettings(next, admin.id);
  await audit(admin.id, "settings.updated", "settings", null, next as Record<string, unknown>);
  return done("Settings saved. New prices apply to new applications and renewals.");
}

// ---------- admins ----------

export async function setRoleAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("admins");
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const role = String(data.get("role")) as Role;
  if (![...ADMIN_ROLES, "member"].includes(role)) return { error: "Choose a role." };
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) return { error: "No account with that email. Ask them to sign up first, then add their role here.", values: keepValues(data) };
  if (user.id === admin.id && role !== "super_admin") return { error: "You can't remove your own super admin role." };
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, user.id));
  await audit(admin.id, "user.role", "user", user.id, { role });
  return done(`${user.name} is now ${role === "member" ? "a regular member" : role.replace("_", " ")}.`);
}

// ---------- import ----------

export async function importAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("import");
  const file = data.get("file");
  if (!file || typeof file === "string" || !file.size) return { error: "Choose a CSV file." };
  if (file.size > 2 * 1024 * 1024) return { error: "The file must be under 2 MB." };
  const text = await file.text();
  const dryRun = data.get("dryRun") === "yes";
  const result = await importMembers(text, admin.id, dryRun);
  revalidatePath("/admin", "layout");
  if (result.errors.length) {
    return { error: `${dryRun ? "Check found" : "Import stopped with"} ${result.errors.length} problem(s):\n${result.errors.slice(0, 20).join("\n")}` };
  }
  return { ok: dryRun ? `Check passed: ${result.count} row(s) are ready to import.` : `Imported ${result.count} member(s).` };
}
