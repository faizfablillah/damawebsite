import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import type { PipelineStatus } from "@/db/schema";
import { ActionForm, Submit } from "@/components/form";
import { Empty, MembershipBadge, PIPELINE, PipelineBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { can, TIERS } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { seatCode } from "@/lib/membership";
import { seatRequestAction } from "../actions";

export default async function CorporatePage({ searchParams }: PageProps<"/admin/corporate">) {
  const admin = await requireAdmin("view");
  const sp = await searchParams;
  const filter = typeof sp.status === "string" && sp.status in PIPELINE ? (sp.status as PipelineStatus) : null;
  const db = await getDb();
  const pic = alias(schema.users, "pic");
  const rows = await db
    .select({ org: schema.organisations, m: schema.memberships, pic: pic.name })
    .from(schema.organisations)
    .innerJoin(schema.memberships, eq(schema.memberships.organisationId, schema.organisations.id))
    .leftJoin(pic, eq(schema.organisations.assignedPicId, pic.id))
    .where(filter ? eq(schema.organisations.pipelineStatus, filter) : undefined)
    .orderBy(desc(schema.organisations.createdAt));
  const requests = await db
    .select({ r: schema.seatRequests, seat: schema.seats, m: schema.memberships, org: schema.organisations })
    .from(schema.seatRequests)
    .innerJoin(schema.seats, eq(schema.seatRequests.seatId, schema.seats.id))
    .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
    .innerJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .where(eq(schema.seatRequests.status, "pending"));
  const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.org.pipelineStatus] = (acc[r.org.pipelineStatus] ?? 0) + 1), acc), {});

  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Corporate membership</h2>
      <nav className="tabs">
        <Link href="/admin/corporate" aria-current={!filter ? "page" : undefined}>
          All
        </Link>
        {Object.entries(PIPELINE).map(([k, [label]]) => (
          <Link key={k} href={`/admin/corporate?status=${k}`} aria-current={filter === k ? "page" : undefined}>
            {label}
            {!filter && counts[k] ? ` (${counts[k]})` : ""}
          </Link>
        ))}
      </nav>
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Tier</th>
                <th>Pipeline</th>
                <th>Membership</th>
                <th>PIC</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ org, m, pic }) => (
                <tr key={org.id}>
                  <td>
                    <Link href={`/admin/members/${m.id}`}>{org.name}</Link>
                    <div className="muted-sm">
                      {org.contactName} · {org.contactEmail} · {org.contactPhone}
                    </div>
                  </td>
                  <td>
                    {TIERS[m.tier].label}
                    <div className="muted-sm">{m.memberCode ?? ""}</div>
                  </td>
                  <td>
                    <PipelineBadge status={org.pipelineStatus} />
                    {org.wantsCall && <div className="muted-sm">Asked for a call</div>}
                  </td>
                  <td>
                    <MembershipBadge status={m.status} />
                    {m.endDate && <div className="muted-sm">to {fmtDate(m.endDate)}</div>}
                  </td>
                  <td>{pic ?? <span className="muted-sm">Unassigned</span>}</td>
                  <td>{fmtDate(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No organisations {filter ? "with this status" : "yet"}.</Empty>
        )}
      </div>

      <section className="panel" id="seat-requests" style={{ marginTop: 28 }}>
        <h2>Seat change requests</h2>
        {requests.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seat</th>
                  <th>Current</th>
                  <th>Replace with</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requests.map(({ r, seat, m, org }) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/members/${m.id}`}>{seatCode(m.memberCode, seat.seatNo)}</Link>
                      <div className="muted-sm">{org.name}</div>
                    </td>
                    <td>
                      {seat.name}
                      <div className="muted-sm">{seat.email}</div>
                    </td>
                    <td>
                      {r.name}
                      <div className="muted-sm">
                        {r.email} {r.jobTitle ? `· ${r.jobTitle}` : ""}
                      </div>
                    </td>
                    <td>{r.reason ?? "—"}</td>
                    <td>
                      {can(admin.role, "members") && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <ActionForm action={seatRequestAction.bind(null, r.id, true)} className="inline-form">
                            <Submit className="btn btn--primary btn--xs">Approve</Submit>
                          </ActionForm>
                          <ActionForm action={seatRequestAction.bind(null, r.id, false)} className="inline-form">
                            <Submit className="btn btn--light btn--xs">Reject</Submit>
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-sm">No pending requests.</p>
        )}
      </section>
    </>
  );
}
