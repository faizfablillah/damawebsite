import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PaymentStatus } from "@/db/schema";
import { ActionForm, Submit } from "@/components/form";
import { Empty, PaymentBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { can, CATEGORY_LABEL } from "@/lib/config";
import { fmtDate, fmtDateTime, money, rm } from "@/lib/format";
import { rejectPaymentAction, verifyPaymentAction } from "../actions";

const TABS: { key: PaymentStatus; label: string }[] = [
  { key: "submitted", label: "To verify" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const admin = await requireAdmin("view");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "submitted") as PaymentStatus;
  const db = await getDb();
  const rows = await db
    .select({ p: schema.payments, o: schema.orders, m: schema.memberships, user: schema.users, org: schema.organisations, receipt: schema.receipts })
    .from(schema.payments)
    .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
    .innerJoin(schema.memberships, eq(schema.orders.membershipId, schema.memberships.id))
    .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .leftJoin(schema.organisations, eq(schema.memberships.organisationId, schema.organisations.id))
    .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
    .where(eq(schema.payments.status, status))
    .orderBy(status === "submitted" ? schema.payments.createdAt : desc(schema.payments.createdAt))
    .limit(300);
  const canPay = can(admin.role, "payments");

  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Payments</h2>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/payments?status=${t.key}`} aria-current={t.key === status ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {status === "submitted" && (
        <p className="muted-sm">
          Check each transfer against the AmBank statement (amount, date and reference) before verifying. Verifying issues the official receipt and activates the membership when fully
          paid. If less was received, change the amount — the remainder stays as a balance.
        </p>
      )}
      <div className="table-scroll">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Item</th>
                <th className="num">Amount</th>
                <th>Bank ref. / date</th>
                <th>Proof</th>
                <th>{status === "submitted" ? "Action" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, o, m, user, org, receipt }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/members/${m.id}`}>{org?.name ?? user?.name}</Link>
                    <div className="muted-sm">
                      {CATEGORY_LABEL[m.category]} · {m.memberCode ?? "new"}
                    </div>
                  </td>
                  <td>
                    {o.itemCode} {o.kind === "renewal" ? "(renewal)" : ""}
                    <div className="muted-sm">Due {rm(o.unitPrice - o.discount - (status === "submitted" ? o.amountPaid : 0))}</div>
                    <div className="muted-sm">Expected ref: {o.paymentReference}</div>
                  </td>
                  <td className="num">{rm(p.amount)}</td>
                  <td>
                    {p.reference}
                    <div className="muted-sm">
                      Paid {fmtDate(p.paymentDate)} · sent {fmtDateTime(p.createdAt)}
                    </div>
                  </td>
                  <td className="nowrap">
                    {p.proofKey ? (
                      <a href={`/files/${p.proofKey.split("/").map(encodeURIComponent).join("/")}`} target="_blank">
                        View proof
                      </a>
                    ) : (
                      p.method.replace("_", " ")
                    )}
                  </td>
                  <td>
                    {status === "submitted" && canPay ? (
                      <div style={{ display: "grid", gap: 8, minWidth: 250 }}>
                        <ActionForm action={verifyPaymentAction.bind(null, p.id)} className="inline-form">
                          <input className="input" name="amount" defaultValue={money(p.amount).replace(/,/g, "")} aria-label="Amount received (RM)" style={{ width: 100 }} />
                          <Submit className="btn btn--primary btn--xs">Verify</Submit>
                        </ActionForm>
                        <ActionForm action={rejectPaymentAction.bind(null, p.id)} className="inline-form">
                          <input className="input" name="reason" placeholder="Reason to reject" aria-label="Reason" style={{ width: 150 }} />
                          <Submit className="btn btn--danger btn--xs">Reject</Submit>
                        </ActionForm>
                      </div>
                    ) : (
                      <>
                        <PaymentBadge status={p.status} />
                        {receipt && (
                          <div>
                            <a href={`/receipts/${receipt.id}`} target="_blank">
                              {receipt.receiptNo}
                            </a>
                          </div>
                        )}
                        {p.rejectReason && <div className="muted-sm">{p.rejectReason}</div>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{status === "submitted" ? "No payments waiting for verification." : "Nothing here yet."}</Empty>
        )}
      </div>
    </>
  );
}
