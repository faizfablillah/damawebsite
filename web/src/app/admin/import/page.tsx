import { ActionForm, Checkbox, Field, Submit } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { IMPORT_COLUMNS } from "@/lib/import";
import { importAction } from "../actions";

export default async function ImportPage() {
  await requireAdmin("import");
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Import existing members</h2>
      <div className="split-2">
        <section className="panel">
          <h2>Upload a CSV</h2>
          <p>
            Use this once to bring in members who joined through the earlier Google / Microsoft forms. Existing Member IDs are kept and new IDs continue after the highest imported
            number. No receipts or emails are sent — imported members sign in for the first time using <strong>Forgot password</strong>.
          </p>
          <ActionForm action={importAction}>
            <Field name="file" label="CSV file" type="file" required accept=".csv,text/csv" />
            <Checkbox name="dryRun">Check the file only (don&apos;t import yet)</Checkbox>
            <div>
              <Submit pendingText="Working…">Upload</Submit>
            </div>
          </ActionForm>
        </section>
        <section className="panel">
          <h2>File format</h2>
          <p className="muted-sm">One row per membership, with these columns (header row required):</p>
          <ul className="check-list" style={{ fontSize: ".9rem" }}>
            {IMPORT_COLUMNS.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <p className="muted-sm">
            tier: EDU, IND, COR_S, COR_M, COR_L or COR_P · state: two-letter code (KL, SL…) · dates: YYYY-MM-DD · end_date defaults to 12 months after start_date.
          </p>
          <a className="btn btn--outline btn--sm" href="/admin/export/template">
            Download template
          </a>
        </section>
      </div>
    </>
  );
}
