"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVerifiedUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { BusinessError } from "@/lib/membership";
import { cancelOwnRegistration, registerForEvent } from "@/lib/events";

export async function registerAction(eventId: string, slug: string, _: FormState): Promise<FormState> {
  const user = await requireVerifiedUser(`/events/${slug}`);
  let registration;
  try {
    registration = await registerForEvent(user, eventId);
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/events/${slug}`);
  redirect(registration.status === "confirmed" ? `/events/${slug}?registered=1` : `/portal/events/${registration.id}?new=1`);
}

export async function cancelRegistrationAction(registrationId: string, slug: string, _: FormState): Promise<FormState> {
  const user = await requireVerifiedUser(`/events/${slug}`);
  try {
    await cancelOwnRegistration(user, registrationId);
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/events/${slug}`);
  redirect(`/events/${slug}?cancelled=1`);
}
