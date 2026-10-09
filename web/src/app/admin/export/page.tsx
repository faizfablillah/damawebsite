import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/config";
import { BACKUP_KEEP_DAYS, listBackups } from "@/lib/backup";

export default async function ExportPage() {
  const admin = await requireAdmin("export");
  const superAdmin = can(admin.role, "admins");
  const backups = superAdmin ? await listBackups() : [];
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Export</h2>
      <section className="panel">
        <p>Download records as CSV files that open in Excel. Use them for finance reconciliation, the annual statement and as a backup.</p>
        <div className="form-actions">
          <a className="btn btn--primary btn--sm" href="/admin/export/members">
            Members
          </a>
          <a className="btn btn--primary btn--sm" href="/admin/export/payments">
            Payments &amp; receipts
          </a>
          <a className="btn btn--primary btn--sm" href="/admin/export/seats">
            Corporate seats
          </a>
          <a className="btn btn--outline btn--sm" href="/admin/export/template">
            Import template
          </a>
        </div>
      </section>
      {superAdmin && (
        <section className="panel">
          <h2>Database backups</h2>
          <p className="muted-sm">
            A full copy of the database is saved every night (9 am) and kept for {BACKUP_KEEP_DAYS} days. Download one now and then and keep it
            somewhere safe (e.g. DAMA&apos;s OneDrive or Google Drive) — it contains personal data, so don&apos;t email it. Uploaded files
            (payment proofs, student cards) are not inside the backup; they stay in the storage bucket.
          </p>
          {backups.length ? (
            <ul>
              {backups.slice(0, 10).map((b) => (
                <li key={b.key}>
                  <a href={`/files/${b.key.split("/").map(encodeURIComponent).join("/")}`} download>
                    {b.key.replace("backups/", "")}
                  </a>{" "}
                  <span className="muted-sm">({Math.max(1, Math.round(b.size / 1024))} KB)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No backups yet. The first one is made by tonight&apos;s daily job.</p>
          )}
        </section>
      )}
    </>
  );
}
