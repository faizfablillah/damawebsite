import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AppHero, Notice, OrderBadge } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { getDb, schema } from "@/db";
import { requireVerifiedUser } from "@/lib/auth";
import { TIERS } from "@/lib/config";
import { money, rm, todayKL } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { ACCEPT_ATTR } from "@/lib/storage";
import { loadMembership, ownsBundle } from "@/lib/queries";
import { orderBalance } from "@/lib/membership";
import { submitPaymentAction } from "../../actions";

export const metadata = { title: "Payment" };

export default async function PayPage({ params, searchParams }: PageProps<"/portal/pay/[orderId]">) {
  const { orderId } = await params;
  const sp = await searchParams;
  const user = await requireVerifiedUser(`/portal/pay/${orderId}`);
  const db = await getDb();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) notFound();
  const bundle = await loadMembership(order.membershipId);
  if (!bundle || !ownsBundle(bundle, user)) notFound();
  if (order.status === "paid" || order.status === "cancelled") redirect("/portal");
  const settings = await getSettings();
  const balance = orderBalance(order);
  const pendingProof = bundle.orders.find((o) => o.order.id === order.id)?.payments.some((p) => p.status === "submitted");
  const tier = TIERS[bundle.membership.tier];
  const title = bundle.organisation ? `${bundle.organisation.name} — ${tier.label}` : `${tier.label} membership`;

  return (
    <>
      <AppHero eyebrow="Step 3 of 3 · Payment" title={order.kind === "renewal" ? "Renew your membership" : "Complete your payment"}>
        {title}
      </AppHero>
      <div className="app-main">
        <div className="container narrow">
          {sp.new && <Notice kind="success">Application received. Please make your payment by bank transfer, then upload the receipt below.</Notice>}
          {pendingProof && (
            <Notice kind="info">
              We already have a payment proof waiting for verification for this order. Only submit another one if you've made an additional transfer.
            </Notice>
          )}
          <div className="panel">
            <div className="panel-head">
              <h2>1. Transfer the fee</h2>
              <OrderBadge status={order.status} />
            </div>
            <div className="bank">
              <div className="row amount">
                <span>Amount {order.status === "part_paid" ? "(balance)" : ""}</span>
                <strong>{rm(balance)}</strong>
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
                <strong>{settings.bank.accountNumber || "Please contact info.damamalaysia@gmail.com"}</strong>
              </div>
              <div className="row">
                <span>Payment reference</span>
                <strong>{order.paymentReference}</strong>
              </div>
            </div>
            {settings.bank.duitNowNote && <p className="muted-sm" style={{ marginTop: 10 }}>{settings.bank.duitNowNote}</p>}
            <p className="muted-sm" style={{ marginTop: 12 }}>
              Please use the payment reference exactly as shown so we can match your transfer. Membership fees are non-refundable. SST does not apply.
            </p>
          </div>
          <div className="panel">
            <h2>2. Upload your payment receipt</h2>
            <ActionForm action={submitPaymentAction.bind(null, order.id)}>
              <div className="form-grid">
                <Field name="amount" label="Amount transferred (RM)" required defaultValue={money(balance).replace(/,/g, "")} />
                <Field name="paymentDate" label="Payment date" type="date" required max={todayKL()} defaultValue={todayKL()} />
                <Field name="reference" label="Bank reference / transaction no." required className="full" hint="The transaction or reference number shown on your bank receipt." />
                <Field name="proof" label="Bank transfer receipt" type="file" required accept={ACCEPT_ATTR} className="full" hint="Screenshot or PDF of your transfer confirmation (PDF, JPG or PNG, up to 4 MB)." />
              </div>
              <div className="form-actions">
                <Submit pendingText="Uploading…">Submit payment</Submit>
                <Link href="/portal">I'll do this later</Link>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
