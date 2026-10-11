import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ADMIN_ROLES, APP_URL, can, type Permission } from "./config";
import { sendEmail, templates } from "./email";
import { later } from "./later";
import { fmtDateTime, rm } from "./format";

// Tells the back office when something needs them: one email as each item arrives, and a morning
// summary of everything still waiting. Payments go to roles with "payments" (Finance, super admins);
// student checks, corporate leads and seat requests to roles with "members" (Membership admins, super admins).
// Roles are managed in Admin → Admins, so new staff start receiving these as soon as they get a role.

type Area = Extract<Permission, "payments" | "members">;

async function admins() {
  const db = await getDb();
  return db
    .select({ email: schema.users.email, role: schema.users.role })
    .from(schema.users)
    .where(and(inArray(schema.users.role, ADMIN_ROLES), eq(schema.users.disabled, false)));
}

// Sent after the member's page has loaded, and never breaks their action (failures still show in Admin → Email log)
export async function notifyStaff(area: Area, title: string, details: [string, string | null | undefined][], path: string) {
  const mail = templates.staffNotice(title, details.filter((d): d is [string, string] => !!d[1]), `${APP_URL}${path}`);
  await later(async () => {
    for (const s of (await admins()).filter((a) => can(a.role, area))) await sendEmail(s.email, "staffNotice", mail);
  });
}

const waited = (since: Date) => {
  const hours = Math.floor((Date.now() - since.getTime()) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.floor(hours / 24)} days`;
};

type DigestSection = { area: Area; heading: string; lines: string[]; path: string };

async function pendingWork(): Promise<DigestSection[]> {
  const db = await getDb();
  const [payments, eventPayments, students, leads, seatRequests] = await Promise.all([
    db
      .select({ p: schema.payments, user: schema.users.name, org: schema.organisations.name })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .innerJoin(schema.memberships, eq(schema.orders.membershipId, schema.memberships.id))
      .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
      .where(eq(schema.payments.status, "submitted"))
      .orderBy(asc(schema.payments.createdAt)),
    db
      .select({ p: schema.eventPayments, name: schema.eventRegistrations.name, event: schema.events.title })
      .from(schema.eventPayments)
      .innerJoin(schema.eventRegistrations, eq(schema.eventPayments.registrationId, schema.eventRegistrations.id))
      .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
      .where(eq(schema.eventPayments.status, "submitted"))
      .orderBy(asc(schema.eventPayments.createdAt)),
    db
      .select({ m: schema.memberships, name: schema.users.name })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(and(eq(schema.memberships.category, "E"), eq(schema.memberships.eligibilityStatus, "pending"), eq(schema.memberships.status, "pending")))
      .orderBy(asc(schema.memberships.createdAt)),
    db.select().from(schema.organisations).where(eq(schema.organisations.pipelineStatus, "new_lead")).orderBy(asc(schema.organisations.createdAt)),
    db
      .select({ r: schema.seatRequests, org: schema.organisations.name })
      .from(schema.seatRequests)
      .innerJoin(schema.seats, eq(schema.seatRequests.seatId, schema.seats.id))
      .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
      .innerJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
      .where(eq(schema.seatRequests.status, "pending"))
      .orderBy(asc(schema.seatRequests.createdAt)),
  ]);
  const sections: DigestSection[] = [
    {
      area: "payments",
      heading: "Membership payments to verify",
      lines: payments.map((x) => `${x.org ?? x.user ?? "Member"}: ${rm(x.p.amount)}, ref ${x.p.reference} (waiting ${waited(x.p.createdAt)})`),
      path: "/admin/payments",
    },
    {
      area: "payments",
      heading: "Event payments to verify",
      lines: eventPayments.map((x) => `${x.name}, ${x.event}: ${rm(x.p.amount)}, ref ${x.p.reference} (waiting ${waited(x.p.createdAt)})`),
      path: "/admin/payments",
    },
    {
      area: "members",
      heading: "Student checks",
      lines: students.map((x) => `${x.name}${x.m.institution ? `, ${x.m.institution}` : ""} (waiting ${waited(x.m.createdAt)})`),
      path: "/admin/members?category=E&eligibility=pending",
    },
    {
      area: "members",
      heading: "Corporate leads not yet contacted",
      lines: leads.map((o) => `${o.name}: ${o.contactName}, ${o.contactEmail} (waiting ${waited(o.createdAt)})`),
      path: "/admin/corporate",
    },
    {
      area: "members",
      heading: "Seat change requests",
      lines: seatRequests.map((x) => `${x.org}: ${x.r.name} (${x.r.email}) (waiting ${waited(x.r.createdAt)})`),
      path: "/admin/corporate#seat-requests",
    },
  ];
  return sections.filter((s) => s.lines.length);
}

// Morning summary (daily job): each admin gets only the sections their role can act on, and nothing when nothing waits
export async function sendStaffDigest() {
  const sections = await pendingWork();
  if (!sections.length) return 0;
  let sent = 0;
  for (const person of await admins()) {
    const mine = sections.filter((s) => can(person.role, s.area));
    if (!mine.length) continue;
    const items = mine.reduce((n, s) => n + s.lines.length, 0);
    const blocks = mine.map((s) => ({ heading: `${s.heading} (${s.lines.length})`, lines: s.lines.slice(0, 15), more: Math.max(0, s.lines.length - 15), url: `${APP_URL}${s.path}` }));
    if (await sendEmail(person.email, "staffDigest", templates.staffDigest(items, blocks, fmtDateTime(new Date())))) sent++;
  }
  return sent;
}
