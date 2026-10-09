"use server";

import { requireAdmin } from "@/lib/auth";
import { keepValues, type FormState } from "@/lib/form-state";
import { sendAnnouncement } from "@/lib/announce";

export async function announceAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("announce");
  const audience = data.get("audience") === "everyone" ? "everyone" : "members";
  const subject = String(data.get("subject") ?? "").trim().slice(0, 150);
  const message = String(data.get("message") ?? "").trim().slice(0, 8000);
  if (subject.length < 3 || message.length < 10) return { error: "Write a subject and a message.", values: keepValues(data) };
  if (data.get("confirm") !== "yes") return { error: "Tick the box to confirm sending.", values: keepValues(data) };
  const r = await sendAnnouncement(admin.id, audience, subject, message);
  const failures = r.sent < r.recipients ? " Check Admin → Email log for the failures." : "";
  return { ok: `Sent to ${r.sent} of ${r.recipients} recipient${r.recipients === 1 ? "" : "s"}.${failures}` };
}
