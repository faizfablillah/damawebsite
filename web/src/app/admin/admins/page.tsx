import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm, Field, Select, Submit } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ROLES, ROLE_LABEL } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { setDisabledAction, setRoleAction } from "../actions";

export default async function AdminsPage() {
  await requireAdmin("admins");
  const db = await getDb();
  const [admins, disabled] = await Promise.all([
    db.select().from(schema.users).where(inArray(schema.users.role, ADMIN_ROLES)),
    db.select().from(schema.users).where(eq(schema.users.disabled, true)),
  ]);
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
                    <td className="nowrap">
                      {a.name}
                      {a.disabled && " (disabled)"}
                    </td>
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
                { value: "events_admin", label: "Events admin — create events, manage attendees" },
                { value: "super_admin", label: "Super admin — everything, including settings and admins" },
                { value: "member", label: "Member — no admin access" },
              ]}
            />
            <div>
              <Submit pendingText="Saving…">Save role</Submit>
            </div>
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Disable an account</h2>
          <p className="muted-sm">
            A disabled account is signed out everywhere and can't log in or reset its password. Use this if an account may be compromised or
            someone leaves. Their membership records stay as they are.
          </p>
          <ActionForm action={setDisabledAction} resetOnSuccess>
            <Field name="accountEmail" label="Email of the account" type="email" required />
            <Select
              name="mode"
              label="Action"
              required
              options={[
                { value: "disable", label: "Disable and sign out" },
                { value: "enable", label: "Enable again" },
              ]}
            />
            <div>
              <Submit pendingText="Saving…">Save</Submit>
            </div>
          </ActionForm>
          {disabled.length > 0 && (
            <p className="muted-sm">Disabled now: {disabled.map((u) => u.email).join(", ")}</p>
          )}
        </section>
      </div>
    </>
  );
}
