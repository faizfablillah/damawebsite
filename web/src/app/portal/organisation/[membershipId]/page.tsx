import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { AppHero, MembershipBadge, Notice, PipelineBadge } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { getDb, schema } from "@/db";
import { requireVerifiedUser } from "@/lib/auth";
import { stateName, TIERS } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { loadMembership } from "@/lib/queries";
import { seatCode } from "@/lib/membership";
import { assignSeatAction } from "../../actions";
import { Flash } from "@/components/flash";

export const metadata = { title: "Organisation" };

export default async function OrganisationPage({ params }: PageProps<"/portal/organisation/[membershipId]">) {
  const { membershipId } = await params;
  const user = await requireVerifiedUser("/portal");
  const b = await loadMembership(membershipId);
  if (!b || !b.organisation || b.organisation.contactUserId !== user.id) notFound();
  const m = b.membership;
  const org = b.organisation;
  const db = await getDb();
  const requests = b.seats.length
    ? await db
        .select()
        .from(schema.seatRequests)
        .where(and(inArray(schema.seatRequests.seatId, b.seats.map((s) => s.id)), eq(schema.seatRequests.status, "pending")))
    : [];
  const canManage = !!m.memberCode && ["active", "grace"].includes(m.status);

  return (
    <>
      <AppHero eyebrow="Corporate membership" title={org.name}>
        {TIERS[m.tier].label} · {TIERS[m.tier].seats} seats
      </AppHero>
      <div className="app-main">
        <div className="container">
          <p>
            <Link href="/portal">← Back to member portal</Link>
          </p>
          <Flash />
          <div className="split-2">
            <section className="panel">
              <div className="panel-head">
                <h2>Seats</h2>
                {m.memberCode && <span className="badge badge--navy">{m.memberCode}</span>}
              </div>
              {!canManage ? (
                <Notice kind="info">You can add your team once the membership is active (after your payment is verified).</Notice>
              ) : (
                <>
                  <p className="muted-sm">
                    Add the people covered by your membership. Each person gets an email invitation and can create their own login with the same email address.
                    Replacing someone who already holds a seat needs approval from the DAMA team.
                  </p>
                  {b.seats.map((s) => {
                    const pending = requests.find((r) => r.seatId === s.id);
                    return (
                      <div key={s.id} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
                        <div className="panel-head" style={{ marginBottom: 6 }}>
                          <strong>{seatCode(m.memberCode, s.seatNo)}</strong>
                          {s.email ? <span className="badge badge--green">Assigned {fmtDate(s.assignedAt)}</span> : <span className="badge">Empty</span>}
                        </div>
                        {s.email && (
                          <p style={{ margin: "0 0 6px" }}>
                            {s.name} · {s.jobTitle || "—"} · {s.email}
                            {s.phone ? ` · ${s.phone}` : ""}
                          </p>
                        )}
                        {pending ? (
                          <Notice kind="info">
                            Change to {pending.name} ({pending.email}) is awaiting approval.
                          </Notice>
                        ) : (
                          <details className="action" open={!s.email && b.seats.findIndex((x) => !x.email) === b.seats.indexOf(s)}>
                            <summary>{s.email ? "Request to replace this person" : "Assign this seat"}</summary>
                            <ActionForm action={assignSeatAction.bind(null, m.id, s.id)}>
                              <div className="form-grid">
                                <Field name="name" label="Full name" required />
                                <Field name="jobTitle" label="Job title" />
                                <Field name="email" label="Email" type="email" required />
                                <Field name="phone" label="Phone" type="tel" />
                                {s.email && <Field name="reason" label="Reason for change" className="full" hint="e.g. the current seat holder has left the organisation." />}
                              </div>
                              <div>
                                <Submit className="btn btn--primary btn--sm">{s.email ? "Send request" : "Assign seat"}</Submit>
                              </div>
                            </ActionForm>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </section>
            <aside>
              <section className="panel">
                <div className="panel-head">
                  <h2>Membership</h2>
                  <MembershipBadge status={m.status} />
                </div>
                <dl className="kv">
                  <dt>Status</dt>
                  <dd>
                    <PipelineBadge status={org.pipelineStatus} />
                  </dd>
                  <dt>Valid</dt>
                  <dd>{m.startDate ? `${fmtDate(m.startDate)} – ${fmtDate(m.endDate)}` : "Starts when payment is verified"}</dd>
                </dl>
              </section>
              <section className="panel">
                <h2>Organisation details</h2>
                <dl className="kv">
                  <dt>Registration no.</dt>
                  <dd>{org.ssmNo}</dd>
                  <dt>Industry</dt>
                  <dd>{org.industry}</dd>
                  <dt>Size</dt>
                  <dd>{org.orgSize}</dd>
                  <dt>Address</dt>
                  <dd>
                    {org.address}, {stateName(org.stateCode)}
                  </dd>
                  <dt>Contact</dt>
                  <dd>
                    {org.contactName} ({org.contactJobTitle})<br />
                    {org.contactEmail} · {org.contactPhone}
                  </dd>
                </dl>
                <p className="muted-sm" style={{ marginTop: 12 }}>
                  To change organisation details, email info.damamalaysia@gmail.com.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
