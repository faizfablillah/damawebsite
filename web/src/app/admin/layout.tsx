import { and, count, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/config";
import { refreshStatuses } from "@/lib/membership";
import { AdminNav } from "@/components/admin-nav";
import { Flash } from "@/components/flash";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("view");
  await refreshStatuses();
  const db = await getDb();
  const [[payments], [eligibility], [leads], [seatReqs]] = await Promise.all([
    db.select({ n: count() }).from(schema.payments).where(eq(schema.payments.status, "submitted")),
    db
      .select({ n: count() })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.category, "E"), eq(schema.memberships.eligibilityStatus, "pending"), inArray(schema.memberships.status, ["pending"]))),
    db.select({ n: count() }).from(schema.organisations).where(inArray(schema.organisations.pipelineStatus, ["new_lead"])),
    db.select({ n: count() }).from(schema.seatRequests).where(eq(schema.seatRequests.status, "pending")),
  ]);
  const r = admin.role;
  return (
    <>
      <section className="app-hero" style={{ paddingBottom: 26 }}>
        <div className="waves waves--right" aria-hidden="true" />
        <div className="container">
          <p className="eyebrow">Back office</p>
          <h1>DAMA Admin</h1>
          <p>
            Signed in as {admin.name} · {ROLE_LABEL[r]}
          </p>
        </div>
      </section>
      <div className="app-main">
        <div className="container admin-layout" style={{ maxWidth: 1360 }}>
          <AdminNav
            items={[
              { href: "/admin", label: "Dashboard", show: true },
              { href: "/admin/payments", label: "Payments", count: payments.n, show: true },
              { href: "/admin/members?category=E", label: "Students", count: eligibility.n, show: true },
              { href: "/admin/members?category=I", label: "Individuals", show: true },
              { href: "/admin/corporate", label: "Corporate", count: leads.n + seatReqs.n, show: true },
              { href: "/admin/renewals", label: "Renewals", show: true },
              "sep",
              { href: "/admin/members", label: "All members", show: true },
              { href: "/admin/emails", label: "Email log", show: true },
              { href: "/admin/export", label: "Export", show: can(r, "export") },
              { href: "/admin/import", label: "Import", show: can(r, "import") },
              { href: "/admin/settings", label: "Settings", show: can(r, "settings") },
              { href: "/admin/admins", label: "Admins", show: can(r, "admins") },
              { href: "/admin/audit", label: "Audit trail", show: true },
            ]}
          />
          <div>
            <Flash />
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
