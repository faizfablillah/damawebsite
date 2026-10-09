"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { createSession, destroyAllSessions, getCurrentUser, hashPassword, requireVerifiedUser, verifyPassword } from "@/lib/auth";
import { CORPORATE_TIERS, isAcademicEmail, STATE_CODES, type TierCode } from "@/lib/config";
import { parseRinggit, todayKL } from "@/lib/format";
import { invalid, keepValues, plain, type FormState } from "@/lib/form-state";
import { saveFile, UploadError, validateUpload } from "@/lib/storage";
import { assignSeat, BusinessError, createApplication, createRenewalOrder, submitPayment } from "@/lib/membership";
import { loadMembership, ownsBundle } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { flashStamp, setFlash } from "@/lib/flash";

const list = (data: FormData, key: string) => data.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, 20);

function fail(data: FormData, e: unknown): FormState {
  if (e instanceof UploadError || e instanceof BusinessError) return { error: e.message, values: keepValues(data) };
  throw e;
}

// ---------- apply ----------

const personalSchema = z.object({
  stateCode: z.enum(STATE_CODES, { message: "Select your state." }),
  background: z.string().trim().max(1000).optional(),
  confirmTier: z.literal("yes", { message: "Please confirm your membership tier." }),
});

const studentSchema = personalSchema.extend({
  institution: z.string().trim().min(2, "Enter your university or college.").max(160),
  graduationYear: z.coerce
    .number({ message: "Enter your expected graduation year." })
    .int()
    .min(2020, "Enter a valid year.")
    .max(2040, "Enter a valid year."),
});

const corporateSchema = z.object({
  tier: z.enum(CORPORATE_TIERS as [TierCode, ...TierCode[]], { message: "Select a corporate tier." }),
  orgName: plain(z.string().trim().min(2, "Enter your company's registered name.").max(200)),
  ssmNo: z.string().trim().min(3, "Enter the SSM / company registration number.").max(60),
  industry: z.string().trim().min(2, "Enter your industry.").max(120),
  orgSize: z.string().trim().min(1, "Select your organisation size."),
  address: z.string().trim().min(5, "Enter the registered office address.").max(400),
  stateCode: z.enum(STATE_CODES, { message: "Select the registered office state." }),
  contactName: plain(z.string().trim().min(2, "Enter the contact person's name.").max(120)),
  contactJobTitle: plain(z.string().trim().min(2, "Enter the contact person's job title.").max(120)),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid business email."),
  contactPhone: z.string().trim().regex(/^\+?[0-9\s-]{9,16}$/, "Enter a valid phone number, e.g. 60123456789."),
  remarks: z.string().trim().max(2000).optional(),
  declaration: z.literal("yes", { message: "Please confirm the declaration." }),
});

export async function applyAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireVerifiedUser("/portal");
  const kind = data.get("kind");
  try {
    if (kind === "student" || kind === "individual") {
      const parsed = (kind === "student" ? studentSchema : personalSchema).safeParse(Object.fromEntries(data));
      if (!parsed.success) return invalid(data, parsed.error);
      const d = parsed.data as z.infer<typeof studentSchema>;
      let proof: { key: string; name: string } | null = null;
      if (kind === "student") {
        if (!isAcademicEmail(user.email)) {
          return { error: "A .edu or .edu.my email is required for Student membership. Please update your email or select another tier.", values: keepValues(data) };
        }
        const upload = await validateUpload(data.get("studentProof"), "your student card or offer letter");
        proof = { key: await saveFile("student-proof", upload!), name: upload!.name };
      }
      const { order } = await createApplication({
        user,
        tier: kind === "student" ? "EDU" : "IND",
        stateCode: d.stateCode,
        background: d.background || null,
        topics: list(data, "topics"),
        preferences: list(data, "preferences"),
        institution: kind === "student" ? d.institution : null,
        graduationYear: kind === "student" ? d.graduationYear : null,
        studentProof: proof,
      });
      redirect(`/portal/pay/${order.id}?new=1`);
    }

    if (kind === "corporate") {
      const parsed = corporateSchema.safeParse(Object.fromEntries(data));
      if (!parsed.success) return invalid(data, parsed.error);
      const d = parsed.data;
      const wantsCall = data.get("wantsCall") === "yes";
      const { order } = await createApplication({
        user,
        tier: d.tier,
        stateCode: d.stateCode,
        topics: list(data, "topics"),
        organisation: {
          name: d.orgName,
          ssmNo: d.ssmNo,
          industry: d.industry,
          orgSize: d.orgSize,
          address: d.address,
          stateCode: d.stateCode,
          contactName: d.contactName,
          contactJobTitle: d.contactJobTitle,
          contactEmail: d.contactEmail,
          contactPhone: d.contactPhone,
          areasOfInterest: list(data, "areas"),
          remarks: d.remarks || null,
          wantsCall,
        },
      });
      redirect(wantsCall ? `/portal?lead=1` : `/portal/pay/${order.id}?new=1`);
    }
    return { error: "Please choose a membership type." };
  } catch (e) {
    return fail(data, e);
  }
}

// ---------- payment proof ----------

const paymentSchema = z.object({
  amount: z.string().trim().min(1, "Enter the amount you transferred."),
  paymentDate: z.iso.date({ message: "Enter the date of your transfer." }),
  reference: z.string().trim().min(3, "Enter the reference number from your bank receipt.").max(120),
});

export async function submitPaymentAction(orderId: string, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireVerifiedUser("/portal");
  const parsed = paymentSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const amount = parseRinggit(parsed.data.amount);
  if (!amount) return { error: "Enter the amount you transferred.", fieldErrors: { amount: "Enter an amount in RM." }, values: keepValues(data) };
  if (parsed.data.paymentDate > todayKL()) return { error: "The payment date can't be in the future.", fieldErrors: { paymentDate: "Date is in the future." }, values: keepValues(data) };
  try {
    const upload = await validateUpload(data.get("proof"), "your bank transfer receipt");
    const key = await saveFile("payment-proof", upload!);
    await submitPayment({ orderId, userId: user.id, amount, paymentDate: parsed.data.paymentDate, reference: parsed.data.reference, proof: { key, name: upload!.name } });
  } catch (e) {
    return fail(data, e);
  }
  redirect("/portal?submitted=1");
}

// ---------- renewal ----------

export async function renewAction(membershipId: string) {
  const user = await requireVerifiedUser("/portal");
  const bundle = await loadMembership(membershipId);
  if (!bundle || !ownsBundle(bundle, user)) redirect("/portal");
  const order = await createRenewalOrder(membershipId, user.id);
  redirect(`/portal/pay/${order.id}`);
}

// ---------- profile ----------

const profileSchema = z.object({
  name: plain(z.string().trim().min(2, "Enter your full name.").max(120)),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{9,16}$/, "Enter a valid phone number."),
  jobTitle: plain(z.string().trim().max(120)).optional(),
  organisation: plain(z.string().trim().max(160)).optional(),
  address: z.string().trim().min(5, "Enter your correspondence address.").max(400),
  stateCode: z.enum(STATE_CODES, { message: "Select your state." }),
});

export async function updateProfileAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const db = await getDb();
  const d = parsed.data;
  await db
    .update(schema.users)
    .set({ name: d.name, phone: d.phone, jobTitle: d.jobTitle || null, organisation: d.organisation || null, address: d.address, stateCode: d.stateCode })
    .where(eq(schema.users.id, user.id));
  await audit(user.id, "user.profile_updated", "user", user.id);
  revalidatePath("/portal");
  return { ok: "Your details have been saved. Your Member ID does not change if you move state.", values: keepValues(data) };
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), password: z.string().min(8, "Use at least 8 characters.").max(200), confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });

export async function changePasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = passwordSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Your current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password." } };
  }
  const db = await getDb();
  await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(schema.users.id, user.id));
  await audit(user.id, "user.password_changed", "user", user.id);
  // Sign out every other device, then keep this one signed in
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return { ok: "Your password has been changed. Any other devices have been logged out." };
}

// ---------- corporate seats (contact person) ----------

const seatSchema = z.object({
  name: plain(z.string().trim().min(2, "Enter the person's full name.").max(120)),
  jobTitle: plain(z.string().trim().max(120)).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().max(30).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function assignSeatAction(membershipId: string, seatId: string, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireVerifiedUser("/portal");
  const parsed = seatSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  let msg: string;
  try {
    const d = parsed.data;
    const result = await assignSeat({ seatId, actorId: user.id, asAdmin: false, name: d.name, jobTitle: d.jobTitle || null, email: d.email, phone: d.phone || null, reason: d.reason || null });
    msg =
      result === "requested"
        ? "Thanks — your seat change request has been sent to the DAMA team for approval."
        : `Seat assigned. We've emailed ${d.email} an invitation.`;
  } catch (e) {
    return fail(data, e);
  }
  revalidatePath("/portal", "layout");
  // The seat's form collapses once it's filled, so confirm at the top of the page instead
  await setFlash(msg);
  redirect(`/portal/organisation/${membershipId}?done=${flashStamp()}`);
}
