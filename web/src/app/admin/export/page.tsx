import { requireAdmin } from "@/lib/auth";

export default async function ExportPage() {
  await requireAdmin("export");
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
    </>
  );
}
