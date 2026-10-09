"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { parseRinggit, todayKL } from "@/lib/format";
import { invalid, keepValues, type FormState } from "@/lib/form-state";
import { saveFile, UploadError, validateUpload } from "@/lib/storage";
import { BusinessError } from "@/lib/membership";
import { submitEventPayment } from "@/lib/events";

const paymentSchema = z.object({
  amount: z.string().trim().min(1, "Enter the amount you transferred."),
  paymentDate: z.iso.date({ message: "Enter the date of your transfer." }),
  reference: z.string().trim().min(3, "Enter the reference number from your bank receipt.").max(120),
});

export async function submitEventPaymentAction(registrationId: string, _: FormState, data: FormData): Promise<FormState> {
  const user = await requireVerifiedUser(`/portal/events/${registrationId}`);
  const parsed = paymentSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const amount = parseRinggit(parsed.data.amount);
  if (!amount) return { error: "Enter the amount you transferred.", fieldErrors: { amount: "Enter an amount in RM." }, values: keepValues(data) };
  if (parsed.data.paymentDate > todayKL()) return { error: "The payment date can't be in the future.", fieldErrors: { paymentDate: "Date is in the future." }, values: keepValues(data) };
  try {
    const upload = await validateUpload(data.get("proof"), "your bank transfer receipt");
    const key = await saveFile("event-payment", upload!);
    await submitEventPayment({ registrationId, userId: user.id, amount, paymentDate: parsed.data.paymentDate, reference: parsed.data.reference, proof: { key, name: upload!.name } });
  } catch (e) {
    if (e instanceof UploadError || e instanceof BusinessError) return { error: e.message, values: keepValues(data) };
    throw e;
  }
  redirect(`/portal/events/${registrationId}?submitted=1`);
}
