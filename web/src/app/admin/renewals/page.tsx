import Link from "next/link";
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm, Submit } from "@/components/form";
import { Empty, MembershipBadge } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/config";
import { addDays, daysBetween, fmtDate, todayKL } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { runDailyAction } from "../actions";

export default async function RenewalsPage() {
  const db = await getDb();
  const today = todayKL();
  const { graceDays } = await getSettings();
  const rows = await db
    .select({ m: schema.memberships, user: schema.users, org: schema.organisations })
    .from(schema.memberships)
    .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .where(
      or(
        and(eq(schema.memberships.status, "active"), gte(schema.memberships.endDate, today), lte(schema.memberships.endDate, addDays(today, 60))),
        inArray(schema.memberships.status, ["grace"]),
      ),
    )
    .orderBy(asc(schema.memberships.endDate));
  const ids = rows.map((r) => r.m.id);
  const openRenewals = ids.length
    ? await db
        .select()
        .from(schema.orders)
        .where(and(inArray(schema.orders.membershipId, ids), eq(schema.orders.kind, "renewal"), inArray(schema.orders.status, ["awaiting_payment", "pending_verification", "part_paid"])))
    : [];

  return (
    <>
      <div className="panel-head">
        <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Renewals</h2>
        <ActionForm action={runDailyAction} className="inline-form">
          <Submit className="btn btn--outline btn--sm" pendingText="Running…">
            Send due reminders now
          </Submit>
        </ActionForm>
      </div>
      <p className="muted-sm">
        Members expiring in the next 60 days, and those in the {graceDays}-day grace period. Reminders go out automatically 30, 14 and 7 days before expiry, at the start of the grace
        period and on expiry.
      </p>
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Type</th>
                <th>Ends</th>
                <th>Status</th>
                <th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, user, org }) => {
                const days = daysBetween(today, m.endDate!);
                const open = openRenewals.find((o) => o.membershipId === m.id);
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/members/${m.id}`}>{org?.name ?? user?.name}</Link>
                      <div className="muted-sm">
                        {m.memberCode} · {org?.contactEmail ?? user?.email}
                      </div>
                    </td>
                    <td>{CATEGORY_LABEL[m.category]}</td>
                    <td>
                      {fmtDate(m.endDate)}
                      <div className="muted-sm">{days >= 0 ? `in ${days} days` : `${-days} days ago`}</div>
                    </td>
                    <td>
                      <MembershipBadge status={m.status} />
                    </td>
                    <td>{open ? <span className="badge badge--blue">{open.status.replace("_", " ")}</span> : <span className="muted-sm">Not started</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>No renewals due in the next 60 days.</Empty>
        )}
      </div>
    </>
  );
}
