import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MembershipStatus } from "@/db/schema";
import { EligibilityBadge, Empty, MembershipBadge } from "@/components/ui";
import { CATEGORY_LABEL, TIERS, type Category } from "@/lib/config";
import { fmtDate } from "@/lib/format";

const STATUSES: MembershipStatus[] = ["pending", "active", "grace", "expired", "suspended", "rejected", "cancelled"];

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" && ["E", "I", "C"].includes(sp.category) ? (sp.category as Category) : null;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as MembershipStatus) ? (sp.status as MembershipStatus) : null;
  const eligibility = sp.eligibility === "pending" ? "pending" : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: SQL[] = [];
  if (category) where.push(eq(schema.memberships.category, category));
  if (status) where.push(eq(schema.memberships.status, status));
  if (eligibility) where.push(eq(schema.memberships.eligibilityStatus, "pending"));
  if (q) {
    const like = `%${q}%`;
    where.push(
      or(
        ilike(schema.users.name, like),
        ilike(schema.users.email, like),
        ilike(schema.memberships.memberCode, like),
        ilike(schema.organisations.name, like),
        ilike(schema.organisations.contactEmail, like),
        ilike(schema.organisations.contactName, like),
      )!,
    );
  }
  const db = await getDb();
  const rows = await db
    .select({ m: schema.memberships, user: schema.users, org: schema.organisations })
    .from(schema.memberships)
    .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.memberships.createdAt))
    .limit(300);

  const title = category ? `${CATEGORY_LABEL[category]} members` : "All members";
  return (
    <>
      <div className="panel-head">
        <h2 style={{ fontSize: "1.5rem", margin: 0 }}>{title}</h2>
        <span className="muted-sm">{rows.length} shown</span>
      </div>
      <form className="filters" method="get">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="field">
          <label htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Name, email, Member ID, organisation" style={{ minWidth: 280 }} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select className="input" id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {category === "E" && (
          <div className="field">
            <label htmlFor="eligibility">Eligibility</label>
            <select className="input" id="eligibility" name="eligibility" defaultValue={eligibility ?? ""}>
              <option value="">Any</option>
              <option value="pending">Pending check</option>
            </select>
          </div>
        )}
        <button className="btn btn--primary btn--sm" type="submit">
          Filter
        </button>
        <Link className="btn btn--light btn--sm" href={category ? `/admin/members?category=${category}` : "/admin/members"}>
          Reset
        </Link>
      </form>
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, user, org }) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/members/${m.id}`}>{m.memberCode ?? "Not assigned"}</Link>
                  </td>
                  <td>
                    <Link href={`/admin/members/${m.id}`}>{org?.name ?? user?.name}</Link>
                    <div className="muted-sm">{org ? `${org.contactName} · ${org.contactEmail}` : user?.email}</div>
                  </td>
                  <td>
                    {CATEGORY_LABEL[m.category]}
                    <div className="muted-sm">{TIERS[m.tier].label}</div>
                  </td>
                  <td>
                    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
                      <MembershipBadge status={m.status} />
                      <EligibilityBadge status={m.eligibilityStatus} />
                      {m.imported && <span className="badge">Imported</span>}
                    </div>
                  </td>
                  <td>{fmtDate(m.endDate)}</td>
                  <td>{fmtDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No members match these filters.</Empty>
        )}
      </div>
    </>
  );
}
