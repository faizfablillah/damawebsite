import type { ZodError, ZodString } from "zod";

export type FormState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

// Keep what the user typed (except secrets and files) so the form can be re-filled after an error
export function keepValues(data: FormData, omit: string[] = ["password", "confirmPassword", "currentPassword"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(data.keys())) {
    if (omit.includes(key)) continue;
    const all = data.getAll(key).filter((v): v is string => typeof v === "string");
    if (all.length) out[key] = all.join("\n");
  }
  return out;
}

export function zodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export function invalid(data: FormData, err: ZodError, message = "Please check the highlighted fields."): FormState {
  return { error: message, fieldErrors: zodErrors(err), values: keepValues(data) };
}

// Names and organisation names appear in emails we send, so they can't carry links or line breaks
export const plain = (field: ZodString) => field.refine((v) => !/:\/\/|www\.|[\r\n]/i.test(v), "Links and line breaks aren't allowed here.");
