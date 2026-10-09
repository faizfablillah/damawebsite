import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createBackup } from "./backup";
import { sendEmail, templates } from "./email";
import { runDailyTasks } from "./membership";
import { sendEventReminders } from "./events";

// The scheduled daily run: statuses and renewal reminders, the nightly backup, then a health check.
// Any problem is emailed to ALERT_EMAILS (comma-separated) or, if unset, to every super admin.
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function runDailyJob(opts: { testAlert?: boolean } = {}) {
  const problems: string[] = [];
  let reminders: number | null = null;
  let eventReminders: number | null = null;
  let backup: Awaited<ReturnType<typeof createBackup>> | null = null;
  try {
    reminders = (await runDailyTasks()).sent;
  } catch (e) {
    problems.push(`Status updates and renewal reminders failed: ${errText(e)}`);
  }
  try {
    eventReminders = await sendEventReminders();
  } catch (e) {
    problems.push(`Event reminders failed: ${errText(e)}`);
  }
  try {
    backup = await createBackup();
  } catch (e) {
    problems.push(`The nightly database backup failed: ${errText(e)}`);
  }
  const db = await getDb();
  const failed = await db
    .select()
    .from(schema.emailLog)
    .where(and(eq(schema.emailLog.status, "failed"), gte(schema.emailLog.createdAt, new Date(Date.now() - 86_400_000))));
  if (failed.length) {
    problems.push(`${failed.length} email${failed.length === 1 ? "" : "s"} failed to send in the last 24 hours (Admin → Email log). Latest error: ${failed.at(-1)!.error ?? "unknown"}`);
  }
  if (opts.testAlert) problems.push("This is a test alert. Everything is fine.");
  let alerted = 0;
  if (problems.length) {
    console.error("Daily job problems", problems);
    for (const to of await alertRecipients()) {
      if (await sendEmail(to, "adminAlert", templates.adminAlert(problems))) alerted++;
    }
  }
  return { reminders, eventReminders, backup: backup && { key: backup.key, bytes: backup.bytes, removed: backup.removed }, problems, alerted };
}

async function alertRecipients() {
  const fromEnv = (process.env.ALERT_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const db = await getDb();
  const admins = await db.select().from(schema.users).where(and(eq(schema.users.role, "super_admin"), eq(schema.users.disabled, false)));
  return admins.map((a) => a.email);
}
