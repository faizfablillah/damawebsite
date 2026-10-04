import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function AuditPage() {
  const db = await getDb();
  const rows = await db
    .select({ log: schema.auditLog, actor: schema.users.name })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(500);
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Audit trail</h2>
      <p className="muted-sm">Every sign-up, payment, approval, seat change and admin action is recorded here.</p>
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ log, actor }) => (
                <tr key={log.id}>
                  <td className="nowrap">{fmtDateTime(log.createdAt)}</td>
                  <td>{actor ?? "System"}</td>
                  <td className="nowrap">{log.action}</td>
                  <td className="muted-sm">
                    {log.details && (
                      <details className="audit-details">
                        <summary>{JSON.stringify(log.details)}</summary>
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nothing recorded yet.</Empty>
        )}
      </div>
    </>
  );
}
