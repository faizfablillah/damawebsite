import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { audit } from "@/lib/audit";
import { csvResponse, toCsv } from "@/lib/csv";
import { fmtDateTime, money, todayKL } from "@/lib/format";
import { eventAttendees } from "@/lib/events";

export async function GET(_req: Request, ctx: RouteContext<"/admin/events/[id]/attendees">) {
  const user = await getCurrentUser();
  if (!user || !user.emailVerifiedAt || !can(user.role, "events")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!e) return new Response("Not found", { status: 404 });
  const rows = await eventAttendees(e.id);
  await audit(user.id, "export.event_attendees", "event", e.id, { rows: rows.length });
  return csvResponse(
    `dama-event-${e.slug}-${todayKL()}.csv`,
    toCsv(
      rows.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone ?? "",
        organisation: r.organisation ?? "",
        member_id: r.memberCode ?? "",
        rate: r.rate === "member" ? "Member" : "Non-member",
        fee_rm: money(r.amount),
        status: r.status,
        attended: r.attended ? "yes" : "",
        registered: fmtDateTime(r.createdAt),
      })),
    ),
  );
}
