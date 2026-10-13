"use server";

import { requireAdmin } from "@/lib/auth";
import { keepValues, type FormState } from "@/lib/form-state";
import { sendAnnouncement } from "@/lib/announce";
import { UploadError, validateUpload } from "@/lib/storage";

// Every recipient receives the image, so keep it light
const IMAGE_MAX_BYTES = 1024 * 1024;

export async function announceAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin("announce");
  const audience = data.get("audience") === "everyone" ? "everyone" : "members";
  const subject = String(data.get("subject") ?? "").trim().slice(0, 150);
  const message = String(data.get("message") ?? "").trim().slice(0, 8000);
  if (subject.length < 3 || message.length < 10) return { error: "Write a subject and a message.", values: keepValues(data) };
  if (data.get("confirm") !== "yes") return { error: "Tick the box to confirm sending.", values: keepValues(data) };
  let image = null;
  try {
    const upload = await validateUpload(data.get("image"), "The image", false);
    if (upload && upload.contentType === "application/pdf") throw new UploadError("The image must be a JPG, PNG or WEBP file.");
    if (upload && upload.buf.length > IMAGE_MAX_BYTES) throw new UploadError("The image must be 1 MB or smaller (every member receives a copy).");
    if (upload) image = { content: upload.buf, contentType: upload.contentType, ext: upload.ext };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message, values: keepValues(data) };
    throw e;
  }
  const r = await sendAnnouncement(admin.id, audience, subject, message, image);
  const failures = r.sent < r.recipients ? " Check Admin → Email log for the failures." : "";
  return { ok: `Sent to ${r.sent} of ${r.recipients} recipient${r.recipients === 1 ? "" : "s"}.${failures}` };
}
