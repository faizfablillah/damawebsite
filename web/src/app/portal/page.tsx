import Link from "next/link";
import { AppHero, EligibilityBadge, MembershipBadge, Notice, PaymentBadge } from "@/components/ui";
import { requireVerifiedUser } from "@/lib/auth";
import { CATEGORY_LABEL, TIERS } from "@/lib/config";
import { daysBetween, fmtDate, rm, todayKL } from "@/lib/format";
import { membershipsForUser, openOrder, type MembershipBundle } from "@/lib/queries";
import { orderBalance, seatCode } from "@/lib/membership";
import { renewAction } from "./actions";

export const metadata = { title: "My membership" };

function Steps({ b }: { b: MembershipBundle }) {
  const m = b.membership;
  const paid = b.orders.some((x) => x.order.status === "paid");
  const steps = ["Account", "Application", "Payment", ...(m.category === "E" ? ["Eligibility check"] : []), "Active"];
  const current = m.status === "active" ? steps.length : !paid ? 2 : m.category === "E" && m.eligibilityStatus !== "approved" ? 3 : steps.length - 1;
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "current" : ""}>
          {s}
        </li>
      ))}
    </ol>
  );
}

function NextAction({ b }: { b: MembershipBundle }) {
  const m = b.membership;
  const open = openOrder(b);
  if (m.status === "rejected") return <Notice kind="error">This application was not approved{m.eligibilityNote ? `: ${m.eligibilityNote}` : "."} Please contact us if you have questions.</Notice>;
  if (m.status === "suspended") return <Notice kind="error">This membership is suspended. Please contact the DAMA team.</Notice>;
  if (open) {
    const { order, payments } = open;
    const waiting = payments.some((p) => p.status === "submitted");
    const rejected = payments.find((p) => p.status === "rejected");
    if (waiting)
      return (
        <Notice kind="info">
          <strong>Payment under review.</strong> We're checking your transfer against our bank records — usually within 3 business days. You'll get your receipt by email.
        </Notice>
      );
    return (
      <div className="notice notice--warn">
        {order.status === "part_paid" ? (
          <p>
            <strong>Part payment received.</strong> Balance due: <strong>{rm(orderBalance(order))}</strong>.
          </p>
        ) : (
          <p>
            <strong>{order.kind === "renewal" ? "Renewal payment due" : "Next step: make your payment"}.</strong> Amount: <strong>{rm(orderBalance(order))}</strong>.
          </p>
        )}
        {rejected && !waiting && <p>Your last payment proof couldn't be verified: {rejected.rejectReason}</p>}
        <p style={{ marginTop: 10 }}>
          <Link className="btn btn--primary btn--sm" href={`/portal/pay/${order.id}`}>
            {order.status === "part_paid" ? "Pay the balance" : "Pay and upload receipt"}
          </Link>
        </p>
      </div>
    );
  }
  if (m.category === "E" && m.eligibilityStatus === "pending")
    return (
      <Notice kind="info">
        <strong>Payment verified — eligibility check in progress.</strong> We'll activate your student membership once we've checked your proof of student status.
      </Notice>
    );
  return null;
}

function canRenew(b: MembershipBundle) {
  const m = b.membership;
  if (!m.memberCode || !m.endDate || openOrder(b)) return false;
  if (m.status === "grace" || m.status === "expired") return true;
  return m.status === "active" && daysBetween(todayKL(), m.endDate) <= 60;
}

function History({ b }: { b: MembershipBundle }) {
  const receipts = b.orders.flatMap((o) => o.receipts);
  const payments = b.orders.flatMap((o) => o.payments.map((p) => ({ p, o: o.order })));
  if (!payments.length) return null;
  return (
    <>
      <h3>Payments &amp; receipts</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th className="num">Amount</th>
              <th>Status</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(({ p, o }) => {
              const r = receipts.find((x) => x.paymentId === p.id);
              return (
                <tr key={p.id}>
                  <td>{fmtDate(p.paymentDate)}</td>
                  <td>{o.description}</td>
                  <td className="num">{rm(p.amount)}</td>
                  <td>
                    <PaymentBadge status={p.status} />
                  </td>
                  <td>{r ? <a href={`/receipts/${r.id}`}>{r.receiptNo}</a> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PersonalMembership({ b, name }: { b: MembershipBundle; name: string }) {
  const m = b.membership;
  const tier = TIERS[m.tier];
  const live = ["active", "grace", "expired"].includes(m.status) && m.memberCode;
  return (
    <section className="panel">
      {live ? (
        <div className="member-card">
          <div className="tier">
            {CATEGORY_LABEL[m.category]} member · {tier.label}
          </div>
          <div className="code">{m.memberCode}</div>
          <div className="name">{name}</div>
          <div className="meta">
            <div>
              Status
              <strong>{m.status === "active" ? "Active" : m.status === "grace" ? "Grace period" : "Expired"}</strong>
            </div>
            <div>
              Member since
              <strong>{m.joinYear}</strong>
            </div>
            <div>
              Valid until
              <strong>{fmtDate(m.endDate)}</strong>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="panel-head">
            <h2>{tier.label} membership</h2>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <MembershipBadge status={m.status} />
              <EligibilityBadge status={m.eligibilityStatus} />
            </span>
          </div>
          <Steps b={b} />
        </>
      )}
      <NextAction b={b} />
      {m.status === "grace" && <Notice kind="warn">Your membership ended on {fmtDate(m.endDate)}. Renew now to keep it continuous.</Notice>}
      {canRenew(b) && (
        <form action={renewAction.bind(null, m.id)}>
          <button className="btn btn--primary btn--sm" type="submit">
            Renew membership
          </button>
        </form>
      )}
      <History b={b} />
    </section>
  );
}

function CorporateMembership({ b }: { b: MembershipBundle }) {
  const m = b.membership;
  const org = b.organisation!;
  const filled = b.seats.filter((s) => s.email).length;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{org.name}</h2>
        <MembershipBadge status={m.status} />
      </div>
      <dl className="kv">
        <dt>Tier</dt>
        <dd>
          Corporate — {TIERS[m.tier].label} ({TIERS[m.tier].seats} seats)
        </dd>
        <dt>Member ID</dt>
        <dd>{m.memberCode ?? "Assigned when payment is verified"}</dd>
        {m.endDate && (
          <>
            <dt>Valid until</dt>
            <dd>{fmtDate(m.endDate)}</dd>
          </>
        )}
        {m.memberCode && (
          <>
            <dt>Seats assigned</dt>
            <dd>
              {filled} of {TIERS[m.tier].seats}
            </dd>
          </>
        )}
      </dl>
      <div style={{ marginTop: 16 }}>
        {org.wantsCall && !b.orders.some((o) => o.payments.length) && m.status === "pending" && (
          <Notice kind="info">Thank you! Our Corporate Membership PIC will reach out within 3–5 business days. You can also pay now if you're ready.</Notice>
        )}
        <NextAction b={b} />
        {canRenew(b) && (
          <form action={renewAction.bind(null, m.id)} style={{ marginBottom: 12 }}>
            <button className="btn btn--primary btn--sm" type="submit">
              Renew corporate membership
            </button>
          </form>
        )}
        <Link className="btn btn--outline btn--sm" href={`/portal/organisation/${m.id}`}>
          {m.memberCode && ["active", "grace"].includes(m.status) ? "Manage seats & details" : "View organisation details"}
        </Link>
      </div>
      <History b={b} />
    </section>
  );
}

export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const user = await requireVerifiedUser("/portal");
  const sp = await searchParams;
  const { bundles, heldSeats } = await membershipsForUser(user);
  const personal = bundles.filter((b) => b.membership.category !== "C" && !["cancelled"].includes(b.membership.status));
  const corporate = bundles.filter((b) => b.membership.category === "C" && b.membership.status !== "cancelled");
  const hasPersonal = personal.some((b) => b.membership.status !== "rejected");
  return (
    <>
      <AppHero eyebrow="Member portal" title={`Welcome, ${user.name.split(" ")[0]}`}>
        Manage your DAMA membership, payments and receipts.
      </AppHero>
      <div className="app-main">
        <div className="container">
          {sp.submitted && <Notice kind="success">Thank you — your payment details have been submitted. We'll email you once they're verified.</Notice>}
          {sp.lead && <Notice kind="success">Thank you! Our Corporate Membership PIC will reach out within 3–5 business days.</Notice>}
          {sp.passwordReset && <Notice kind="success">Your password has been updated.</Notice>}

          <div className="split-2">
            <div>
              {personal.map((b) => (
                <PersonalMembership key={b.membership.id} b={b} name={user.name} />
              ))}
              {corporate.map((b) => (
                <CorporateMembership key={b.membership.id} b={b} />
              ))}
              {heldSeats.map(({ seat, membership, organisation }) => (
                <section className="panel panel--accent" key={seat.id}>
                  <div className="panel-head">
                    <h2>Corporate seat</h2>
                    <MembershipBadge status={membership.status} />
                  </div>
                  <p style={{ marginBottom: 6 }}>
                    You're covered by <strong>{organisation.name}</strong>'s corporate membership.
                  </p>
                  <dl className="kv">
                    <dt>Seat ID</dt>
                    <dd>{seatCode(membership.memberCode, seat.seatNo)}</dd>
                    <dt>Valid until</dt>
                    <dd>{fmtDate(membership.endDate)}</dd>
                  </dl>
                </section>
              ))}
              {!hasPersonal && !corporate.length && !heldSeats.length && (
                <section className="panel">
                  <h2>Choose your membership</h2>
                  <p>You don't have a membership yet. Pick the one that fits you:</p>
                  <div className="form-actions">
                    <Link className="btn btn--primary btn--sm" href="/portal/apply?tier=individual">
                      Individual
                    </Link>
                    <Link className="btn btn--outline btn--sm" href="/portal/apply?tier=student">
                      Student
                    </Link>
                    <Link className="btn btn--outline btn--sm" href="/portal/apply?tier=corporate">
                      Corporate
                    </Link>
                  </div>
                </section>
              )}
            </div>
            <aside>
              <section className="panel">
                <h2>Your details</h2>
                <dl className="kv">
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                  <dt>Phone</dt>
                  <dd>{user.phone}</dd>
                </dl>
                <p style={{ marginTop: 14 }}>
                  <Link href="/portal/profile">Edit details or change password</Link>
                </p>
              </section>
              {hasPersonal && (
                <section className="panel">
                  <h2>Representing a company?</h2>
                  <p className="muted-sm">Register your organisation for Corporate Membership with 5–20 seats for your team.</p>
                  <Link className="btn btn--outline btn--sm" href="/portal/apply?tier=corporate">
                    Register an organisation
                  </Link>
                </section>
              )}
              <section className="panel">
                <h2>Need help?</h2>
                <p className="muted-sm">
                  Email <a href="mailto:info.damamalaysia@gmail.com">info.damamalaysia@gmail.com</a> and include your Member ID if you have one.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
