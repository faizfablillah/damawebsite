import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm, Field, Select, Submit } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ROLES, ROLE_LABEL } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { setRoleAction } from "../actions";

export default async function AdminsPage() {
  await requireAdmin("admins");
  const db = await getDb();
  const admins = await db.select().from(schema.users).where(inArray(schema.users.role, ADMIN_ROLES));
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Admins &amp; roles</h2>
      <div className="split-2">
        <section className="panel">
          <h2>Current admins</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{a.name}</td>
                    <td>{a.email}</td>
                    <td className="nowrap">{ROLE_LABEL[a.role]}</td>
                    <td className="nowrap">{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>Give or change a role</h2>
          <p className="muted-sm">The person must sign up for an account first. Choose “Member” to remove admin access.</p>
          <ActionForm action={setRoleAction} resetOnSuccess>
            <Field name="email" label="Account email" type="email" required />
            <Select
              name="role"
              label="Role"
              required
              options={[
                { value: "membership_admin", label: "Membership admin — approvals, members, corporate, seats" },
                { value: "finance", label: "Finance — verify payments, receipts, exports" },
                { value: "super_admin", label: "Super admin — everything, including settings and admins" },
                { value: "member", label: "Member — no admin access" },
              ]}
            />
            <div>
              <Submit pendingText="Saving…">Save role</Submit>
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
