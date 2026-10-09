import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHero, Notice, PaymentBadge } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { requireVerifiedUser } from "@/lib/auth";
import { fmtDate, fmtEventWhen, money, rm, todayKL } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { ACCEPT_ATTR } from "@/lib/storage";
import { loadRegistration } from "@/lib/events";
import { submitEventPaymentAction } from "./actions";

export const metadata = { title: "Event registration" };

const STATUS_TEXT = {
  awaiting_payment: "Awaiting payment",
  payment_review: "Payment under review",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
} as const;

export default async function EventRegistrationPage({ params, searchParams }: PageProps<"/portal/events/[registrationId]">) {
  const { registrationId } = await params;
  const sp = await searchParams;
  const user = await requireVerifiedUser(`/portal/events/${registrationId}`);
  const data = await loadRegistration(registrationId);
  if (!data || data.registration.userId !== user.id) notFound();
  const { registration: r, event: e, payments } = data;
  const settings = await getSettings();
  const canPay = r.status === "awaiting_payment" || r.status === "payment_review";
  const pending = payments.some((p) => p.status === "submitted");

  return (
    <>
      <AppHero eyebrow="Event registration" title={e.title}>
        {fmtEventWhen(e.startsAt, e.endsAt)}
        {e.venue ? ` · ${e.venue}` : ""}
      </AppHero>
      <div className="app-main">
        <div className="container narrow">
          {sp.new && <Notice kind="success">You&apos;re registered and your place is reserved. Please pay by bank transfer, then upload the receipt below.</Notice>}
          {sp.submitted && <Notice kind="success">Thank you — your payment details have been submitted. We&apos;ll email you once they&apos;re verified.</Notice>}
          <section className="panel">
            <div className="panel-head">
              <h2>Your registration</h2>
              <span className={`badge ${r.status === "confirmed" ? "badge--green" : r.status === "cancelled" ? "badge--red" : "badge--amber"}`}>{STATUS_TEXT[r.status]}</span>
            </div>
            <dl className="kv">
              <dt>Fee</dt>
              <dd>
                {r.amount ? rm(r.amount) : "Free"} ({r.rate === "member" ? "member price" : "non-member price"})
              </dd>
              {r.memberCode && (
                <>
                  <dt>Member ID</dt>
                  <dd>{r.memberCode}</dd>
                </>
              )}
            </dl>
            {r.status === "confirmed" && e.onlineUrl && (
              <p style={{ marginTop: 12 }}>
                <strong>Join online:</strong>{" "}
                <a href={e.onlineUrl} target="_blank" rel="noopener">
                  {e.onlineUrl}
                </a>
              </p>
            )}
            <p style={{ marginTop: 12 }}>
              <Link href={`/events/${e.slug}`}>View event page</Link>
            </p>
          </section>

          {canPay && r.amount > 0 && (
            <>
              <section className="panel">
                <h2>1. Transfer the fee</h2>
                {pending && <Notice kind="info">We already have a payment waiting for verification. Only submit another one if you&apos;ve made an additional transfer.</Notice>}
                <div className="bank">
                  <div className="row amount">
                    <span>Amount</span>
                    <strong>{rm(r.amount)}</strong>
                  </div>
                  <div className="row">
                    <span>Bank</span>
                    <strong>{settings.bank.bankName}</strong>
                  </div>
                  <div className="row">
                    <span>Account name</span>
                    <strong>{settings.bank.accountName}</strong>
                  </div>
                  <div className="row">
                    <span>Account number</span>
                    <strong>{settings.bank.accountNumber || "Please contact info@dama.org.my"}</strong>
                  </div>
                  <div className="row">
                    <span>Payment reference</span>
                    <strong>{r.paymentReference}</strong>
                  </div>
                </div>
                <p className="muted-sm" style={{ marginTop: 12 }}>
                  Please use the payment reference exactly as shown so we can match your transfer. Event fees are non-refundable. SST does not apply.
                </p>
              </section>
              <section className="panel">
                <h2>2. Upload your payment receipt</h2>
                <ActionForm action={submitEventPaymentAction.bind(null, r.id)}>
                  <div className="form-grid">
                    <Field name="amount" label="Amount transferred (RM)" required defaultValue={money(r.amount).replace(/,/g, "")} />
                    <Field name="paymentDate" label="Payment date" type="date" required max={todayKL()} defaultValue={todayKL()} />
                    <Field name="reference" label="Bank reference / transaction no." required className="full" hint="The transaction or reference number shown on your bank receipt." />
                    <Field name="proof" label="Bank transfer receipt" type="file" required accept={ACCEPT_ATTR} className="full" hint="Screenshot or PDF of your transfer confirmation (PDF, JPG or PNG, up to 4 MB)." />
                  </div>
                  <div className="form-actions">
                    <Submit pendingText="Uploading…">Submit payment</Submit>
                    <Link href="/portal">I&apos;ll do this later</Link>
                  </div>
                </ActionForm>
              </section>
            </>
          )}

          {payments.length > 0 && (
            <section className="panel">
              <h2>Payments</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Submitted</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="nowrap">{fmtDate(p.createdAt)}</td>
                        <td className="nowrap">{rm(p.amount)}</td>
                        <td>
                          <PaymentBadge status={p.status} />
                          {p.rejectReason && <div className="muted-sm">{p.rejectReason}</div>}
                        </td>
                        <td>{p.receiptNo ? <a href={`/receipts/event/${p.id}`}>{p.receiptNo}</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
