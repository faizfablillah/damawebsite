import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit } from "./audit";
import { sendEmail, templates } from "./email";

export type Audience = "members" | "everyone";

// Everyone covered by an active (or in-grace) membership: individual and student members,
// corporate contacts and named corporate seat holders. "everyone" = all confirmed accounts that gave consent.
export async function recipients(audience: Audience): Promise<{ email: string; name: string; userId: string | null }[]> {
  const db = await getDb();
  const out = new Map<string, { email: string; name: string; userId: string | null }>();
  const add = (email: string | null, name: string | null, userId: string | null) => {
    if (email && !out.has(email.toLowerCase())) out.set(email.toLowerCase(), { email, name: name ?? "", userId });
  };
  if (audience === "everyone") {
    const users = await db
      .select()
      .from(schema.users)
      .where(and(isNotNull(schema.users.emailVerifiedAt), eq(schema.users.disabled, false), isNotNull(schema.users.consentAt)));
    users.forEach((u) => add(u.email, u.name, u.id));
    return [...out.values()];
  }
  const live = inArray(schema.memberships.status, ["active", "grace"]);
  const personal = await db
    .select({ u: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(live, eq(schema.users.disabled, false)));
  personal.forEach(({ u }) => add(u.email, u.name, u.id));
  const corporate = await db
    .select({ o: schema.organisations })
    .from(schema.memberships)
    .innerJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .where(live);
  corporate.forEach(({ o }) => add(o.contactEmail, o.contactName, o.contactUserId));
  const seats = await db
    .select({ s: schema.seats })
    .from(schema.seats)
    .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
    .where(and(live, isNotNull(schema.seats.email), sql`${schema.seats.email} <> ''`));
  seats.forEach(({ s }) => add(s.email, s.name, null));
  return [...out.values()];
}

export async function sendAnnouncement(adminId: string, audience: Audience, subject: string, message: string) {
  const list = await recipients(audience);
  const footer =
    audience === "members"
      ? "You're receiving this as a DAMA Kuala Lumpur & Selangor member."
      : "You're receiving this because you have an account with DAMA Kuala Lumpur & Selangor and agreed to receive updates. Reply to this email to stop receiving them.";
  let sent = 0;
  for (const r of list) {
    if (await sendEmail(r.email, "announcement", templates.announcement(subject, message, footer), { userId: r.userId })) sent++;
  }
  await audit(adminId, "announcement.sent", "announcement", null, { audience, subject, recipients: list.length, sent });
  return { recipients: list.length, sent };
}
