import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Notice } from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
import { addDays, fmtDateTime, rm, todayKL } from "@/lib/format";
import { runDailyAction } from "./actions";

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const db = await getDb();
  const today = todayKL();
  const startOfDay = new Date(`${today}T00:00:00+08:00`);

  const [todayRows, activeRows, payQ, eligQ, leadsQ, renewQ, graceQ, seatQ, recent] = await Promise.all([
    db
      .select({ category: schema.memberships.category, n: count() })
      .from(schema.memberships)
      .where(gte(schema.memberships.createdAt, startOfDay))
      .groupBy(schema.memberships.category),
    db
      .select({ category: schema.memberships.category, n: count() })
      .from(schema.memberships)
      .where(inArray(schema.memberships.status, ["active", "grace"]))
      .groupBy(schema.memberships.category),
    db.select({ n: count(), total: sum(schema.payments.amount) }).from(schema.payments).where(eq(schema.payments.status, "submitted")),
    db.select({ n: count() }).from(schema.memberships).where(and(eq(schema.memberships.category, "E"), eq(schema.memberships.eligibilityStatus, "pending"), eq(schema.memberships.status, "pending"))),
    db.select({ n: count() }).from(schema.organisations).where(inArray(schema.organisations.pipelineStatus, ["new_lead", "pic_contacted", "invoice_sent", "pending_payment", "payment_review"])),
    db
      .select({ n: count() })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.status, "active"), gte(schema.memberships.endDate, today), lte(schema.memberships.endDate, addDays(today, 30)))),
    db.select({ n: count() }).from(schema.memberships).where(eq(schema.memberships.status, "grace")),
    db.select({ n: count() }).from(schema.seatRequests).where(eq(schema.seatRequests.status, "pending")),
    db
      .select({ log: schema.auditLog, actor: schema.users.name })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(12),
  ]);
  const byCat = (rows: { category: string; n: number }[], c: string) => rows.find((r) => r.category === c)?.n ?? 0;
  const [corpSeats] = await db
    .select({ n: count() })
    .from(schema.seats)
    .innerJoin(schema.memberships, eq(schema.seats.membershipId, schema.memberships.id))
    .where(and(inArray(schema.memberships.status, ["active", "grace"]), sql`${schema.seats.email} is not null`));

  return (
    <>
      {sp.denied && <Notice kind="warn">Your admin role doesn't include that page.</Notice>}
      <h2 style={{ fontSize: "1.4rem" }}>New sign-ups today</h2>
      <div className="stat-cards">
        <Link className="stat-card" href="/admin/members?category=E">
          <div className="n">{byCat(todayRows, "E")}</div>
          <div className="l">Student</div>
        </Link>
        <Link className="stat-card" href="/admin/members?category=I">
          <div className="n">{byCat(todayRows, "I")}</div>
          <div className="l">Individual</div>
        </Link>
        <Link className="stat-card" href="/admin/corporate">
          <div className="n">{byCat(todayRows, "C")}</div>
          <div className="l">Corporate</div>
        </Link>
      </div>

      <h2 style={{ fontSize: "1.4rem" }}>Needs attention</h2>
      <div className="stat-cards">
        <Link className={`stat-card${payQ[0].n ? " alert" : ""}`} href="/admin/payments">
          <div className="n">{payQ[0].n}</div>
          <div className="l">Payments to verify{payQ[0].n ? ` · ${rm(Number(payQ[0].total ?? 0))}` : ""}</div>
        </Link>
        <Link className={`stat-card${eligQ[0].n ? " alert" : ""}`} href="/admin/members?category=E&eligibility=pending">
          <div className="n">{eligQ[0].n}</div>
          <div className="l">Student checks (.edu + proof)</div>
        </Link>
        <Link className={`stat-card${leadsQ[0].n ? " alert" : ""}`} href="/admin/corporate">
          <div className="n">{leadsQ[0].n}</div>
          <div className="l">Corporate leads to follow up</div>
        </Link>
        <Link className={`stat-card${seatQ[0].n ? " alert" : ""}`} href="/admin/corporate#seat-requests">
          <div className="n">{seatQ[0].n}</div>
          <div className="l">Seat change requests</div>
        </Link>
        <Link className="stat-card" href="/admin/renewals">
          <div className="n">{renewQ[0].n}</div>
          <div className="l">Renewals due in 30 days</div>
        </Link>
        <Link className="stat-card" href="/admin/renewals">
          <div className="n">{graceQ[0].n}</div>
          <div className="l">In grace period</div>
        </Link>
      </div>

      <h2 style={{ fontSize: "1.4rem" }}>Active members</h2>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="n">{byCat(activeRows, "E")}</div>
          <div className="l">Students</div>
        </div>
        <div className="stat-card">
          <div className="n">{byCat(activeRows, "I")}</div>
          <div className="l">Individuals</div>
        </div>
        <div className="stat-card">
          <div className="n">{byCat(activeRows, "C")}</div>
          <div className="l">Corporate organisations</div>
        </div>
        <div className="stat-card">
          <div className="n">{corpSeats.n}</div>
          <div className="l">People on corporate seats</div>
        </div>
      </div>

      <div className="split-2">
        <section className="panel">
          <h2>Recent activity</h2>
          <ul className="timeline-log">
            {recent.map(({ log, actor }) => (
              <li key={log.id}>
                <time>{fmtDateTime(log.createdAt)}</time>
                <strong>{actor ?? "System"}</strong> — {log.action.replace(/[._]/g, " ")}
              </li>
            ))}
            {!recent.length && <li className="muted-sm">Nothing yet.</li>}
          </ul>
        </section>
        <section className="panel">
          <h2>Daily tasks</h2>
          <p className="muted-sm">
            Statuses are refreshed automatically, and renewal reminders are emailed once a day by the scheduler. You can also run it now.
          </p>
          <ActionForm action={runDailyAction}>
            <div>
              <Submit className="btn btn--outline btn--sm" pendingText="Running…">
                Run daily tasks now
              </Submit>
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
