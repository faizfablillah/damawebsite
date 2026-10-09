import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Empty, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtEventWhen } from "@/lib/format";
import { hasEnded } from "@/lib/events";

const STATUS_BADGE = { draft: "badge--blue", published: "badge--green", cancelled: "badge--red" } as const;

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin("events");
  const sp = await searchParams;
  const db = await getDb();
  const counts = db
    .select({
      eventId: schema.eventRegistrations.eventId,
      confirmed: sql<number>`count(*) filter (where ${schema.eventRegistrations.status} = 'confirmed')::int`.as("confirmed"),
      pending: sql<number>`count(*) filter (where ${schema.eventRegistrations.status} in ('awaiting_payment', 'payment_review'))::int`.as("pending"),
    })
    .from(schema.eventRegistrations)
    .groupBy(schema.eventRegistrations.eventId)
    .as("c");
  const rows = await db
    .select({ e: schema.events, confirmed: counts.confirmed, pending: counts.pending })
    .from(schema.events)
    .leftJoin(counts, eq(counts.eventId, schema.events.id))
    .orderBy(desc(schema.events.startsAt));
  const upcoming = rows.filter((r) => !hasEnded(r.e));
  const past = rows.filter((r) => hasEnded(r.e));

  const table = (list: typeof rows) => (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>When</th>
            <th>Audience</th>
            <th className="num">Confirmed</th>
            <th className="num">Pending payment</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ e, confirmed, pending }) => (
            <tr key={e.id}>
              <td>
                <Link href={`/admin/events/${e.id}`}>{e.title}</Link>
              </td>
              <td className="nowrap">{fmtEventWhen(e.startsAt, e.endsAt)}</td>
              <td>{e.audience === "members" ? "Members only" : "Everyone"}</td>
              <td className="num">
                {confirmed ?? 0}
                {e.capacity ? ` / ${e.capacity}` : ""}
              </td>
              <td className="num">{pending ?? 0}</td>
              <td>
                <span className={`badge ${STATUS_BADGE[e.status]}`}>{e.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {sp.denied && <Notice kind="warn">Your admin role doesn&apos;t include that page.</Notice>}
      <div className="panel-head">
        <h2 style={{ fontSize: "1.5rem" }}>Events</h2>
        <Link className="btn btn--primary btn--sm" href="/admin/events/new">
          New event
        </Link>
      </div>
      <h3>Upcoming</h3>
      {upcoming.length ? table(upcoming) : <Empty>No upcoming events. Create one with “New event”.</Empty>}
      {past.length > 0 && (
        <>
          <h3 style={{ marginTop: 28 }}>Past</h3>
          {table(past)}
        </>
      )}
    </>
  );
}
