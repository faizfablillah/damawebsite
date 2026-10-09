"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { flashStamp, setFlash } from "@/lib/flash";
import { fromKLInput, parseRinggit } from "@/lib/format";
import { keepValues, type FormState } from "@/lib/form-state";
import { BusinessError } from "@/lib/membership";
import { saveFile, UploadError, validateUpload } from "@/lib/storage";
import { adminCancelRegistration, emailAttendees, rejectEventPayment, setAttended, uniqueSlug, verifyEventPayment } from "@/lib/events";

// Back to the page the admin was on, with a confirmation banner
async function done(msg: string, fallback = "/admin/events"): Promise<never> {
  revalidatePath("/admin", "layout");
  revalidatePath("/events", "layout");
  const ref = (await headers()).get("referer");
  const url = new URL(ref && new URL(ref).pathname.startsWith("/admin") ? ref : `http://local${fallback}`);
  url.searchParams.set("done", flashStamp());
  await setFlash(msg);
  redirect(`${url.pathname}${url.search}`);
}
function oops(e: unknown, data?: FormData): FormState {
  if (e instanceof BusinessError || e instanceof UploadError) return { error: e.message, values: data ? keepValues(data) : undefined };
  throw e;
}

const optionalUrl = z.union([z.literal(""), z.url({ message: "Enter a full link starting with https://" })]);
const eventSchema = z.object({
  title: z.string().trim().min(3, "Enter a title.").max(160),
  category: z.string().trim().max(40).optional(),
  summary: z.string().trim().min(10, "Write a one or two sentence summary.").max(300),
  body: z.string().trim().max(10000).optional(),
  startsAt: z.string().min(1, "Choose the start date and time."),
  endsAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  venue: z.string().trim().max(200).optional(),
  onlineUrl: optionalUrl.optional(),
  audience: z.enum(["public", "members"]),
  capacity: z.string().trim().regex(/^\d*$/, "Enter a whole number, or leave empty for no limit.").optional(),
  memberPrice: z.string().trim().optional(),
  nonMemberPrice: z.string().trim().optional(),
  materials: z.string().trim().max(5000).optional(),
  organiser: z.string().trim().max(160).optional(),
  externalUrl: optionalUrl.optional(),
  memberOffer: z.string().trim().max(160).optional(),
  memberOfferDetails: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "published", "cancelled"]),
});

export async function saveEventAction(eventId: string | null, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  const parsed = eventSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { error: "Please check the highlighted fields.", fieldErrors, values: keepValues(data) };
  }
  const d = parsed.data;
  const fail = (field: string, message: string): FormState => ({ error: "Please check the highlighted fields.", fieldErrors: { [field]: message }, values: keepValues(data) });
  const startsAt = fromKLInput(d.startsAt);
  if (!startsAt) return fail("startsAt", "Choose the start date and time.");
  const endsAt = d.endsAt ? fromKLInput(d.endsAt) : null;
  if (d.endsAt && (!endsAt || endsAt <= startsAt)) return fail("endsAt", "The end must be after the start.");
  const closesAt = d.registrationClosesAt ? fromKLInput(d.registrationClosesAt) : null;
  if (d.registrationClosesAt && (!closesAt || closesAt > startsAt)) return fail("registrationClosesAt", "Registration must close before the event starts.");
  const memberPrice = d.memberPrice ? parseRinggit(d.memberPrice) : 0;
  if (memberPrice === null) return fail("memberPrice", "Enter an amount in RM (0 for free).");
  let nonMemberPrice: number | null = null;
  if (d.audience === "public") {
    nonMemberPrice = d.nonMemberPrice ? parseRinggit(d.nonMemberPrice) : 0;
    if (nonMemberPrice === null) return fail("nonMemberPrice", "Enter an amount in RM (0 for free).");
  }
  if (d.status === "published" && !d.venue && !d.onlineUrl) return fail("venue", "Add a venue or an online link before publishing.");
  if (d.externalUrl && !d.organiser) return fail("organiser", "Name the organiser of this partner event.");
  if (d.memberOfferDetails && !d.memberOffer) return fail("memberOffer", "Add a short public headline for the member offer.");

  try {
    const image = await validateUpload(data.get("image"), "the cover image", false);
    if (image && !image.contentType.startsWith("image/")) throw new UploadError("The cover image must be a JPG, PNG or WEBP file.");
    const imageKey = image ? await saveFile("event-image", image) : undefined;
    const values = {
      title: d.title,
      category: d.category || null,
      summary: d.summary,
      body: d.body ?? "",
      startsAt,
      endsAt,
      registrationClosesAt: closesAt,
      venue: d.venue || null,
      onlineUrl: d.onlineUrl || null,
      audience: d.audience,
      capacity: d.capacity ? Number(d.capacity) : null,
      memberPrice,
      nonMemberPrice,
      materials: d.materials || null,
      organiser: d.organiser || null,
      externalUrl: d.externalUrl || null,
      memberOffer: d.memberOffer || null,
      memberOfferDetails: d.memberOfferDetails || null,
      status: d.status,
      updatedAt: new Date(),
      ...(imageKey ? { imageKey } : {}),
    };
    const db = await getDb();
    let id = eventId;
    if (id) {
      const [updated] = await db.update(schema.events).set(values).where(eq(schema.events.id, id)).returning();
      if (!updated) return { error: "Event not found." };
      await audit(admin.id, "event.updated", "event", id, { title: d.title, status: d.status });
    } else {
      const [created] = await db
        .insert(schema.events)
        .values({ ...values, slug: await uniqueSlug(d.title, startsAt), createdBy: admin.id })
        .returning();
      id = created.id;
      await audit(admin.id, "event.created", "event", id, { title: d.title, status: d.status });
    }
    revalidatePath("/events", "layout");
    revalidatePath("/admin", "layout");
    await setFlash(eventId ? "Event saved." : d.status === "published" ? "Event created and published." : "Event created as a draft.");
    redirect(`/admin/events/${id}?done=${flashStamp()}`);
  } catch (e) {
    return oops(e, data);
  }
}

export async function attendedAction(registrationId: string, attended: boolean, _: FormState): Promise<FormState> {
  const admin = await requireAdmin("events");
  await setAttended(registrationId, attended, admin.id);
  return done(attended ? "Marked as attended." : "Attendance removed.");
}

export async function cancelRegistrationAdminAction(registrationId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  try {
    await adminCancelRegistration(registrationId, admin.id, String(data.get("note") ?? "").trim().slice(0, 500));
    return done("Registration cancelled and the attendee has been emailed.");
  } catch (e) {
    return oops(e);
  }
}

export async function emailAttendeesAction(eventId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  const subject = String(data.get("subject") ?? "").trim().slice(0, 150);
  const message = String(data.get("message") ?? "").trim().slice(0, 5000);
  if (subject.length < 3 || message.length < 5) return { error: "Write a subject and a message.", values: keepValues(data) };
  if (data.get("confirm") !== "yes") return { error: "Tick the box to confirm sending.", values: keepValues(data) };
  const r = await emailAttendees(eventId, admin.id, subject, message, data.get("includePending") === "yes");
  return done(`Email sent to ${r.sent} of ${r.recipients} attendee${r.recipients === 1 ? "" : "s"}.`);
}

// ---------- event payments (Finance) ----------

export async function verifyEventPaymentAction(paymentId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const amount = parseRinggit(String(data.get("amount") ?? ""));
  if (!amount) return { error: "Enter the amount actually received." };
  try {
    const receiptNo = await verifyEventPayment(paymentId, admin.id, amount);
    return done(`Event payment verified. Receipt ${receiptNo} issued and the place is confirmed.`, "/admin/payments");
  } catch (e) {
    return oops(e);
  }
}

export async function rejectEventPaymentAction(paymentId: string, _: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("payments");
  const reason = String(data.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Please give the attendee a short reason." };
  try {
    await rejectEventPayment(paymentId, admin.id, reason);
    return done("Event payment rejected and the attendee has been emailed.", "/admin/payments");
  } catch (e) {
    return oops(e);
  }
}
