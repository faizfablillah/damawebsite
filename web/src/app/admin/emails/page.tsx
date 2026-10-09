import { desc, ilike, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  // Each page checks access itself: the layout check alone does not protect the page payload
  await requireAdmin("view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.emailLog)
    .where(q ? or(ilike(schema.emailLog.toEmail, `%${q}%`), ilike(schema.emailLog.subject, `%${q}%`)) : undefined)
    .orderBy(desc(schema.emailLog.createdAt))
    .limit(300);
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Email log</h2>
      <form className="filters" method="get">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Email address or subject" style={{ minWidth: 280 }} />
        </div>
        <button className="btn btn--primary btn--sm" type="submit">
          Search
        </button>
      </form>
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{fmtDateTime(e.createdAt)}</td>
                  <td>{e.toEmail}</td>
                  <td>{e.subject}</td>
                  <td>
                    <span className={`badge ${e.status === "sent" ? "badge--green" : "badge--red"}`}>{e.status}</span>
                    {e.error && <div className="muted-sm">{e.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No emails yet.</Empty>
        )}
      </div>
    </>
  );
}
