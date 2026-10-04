import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm, Field, Select, Submit, TextArea } from "@/components/form";
import { EligibilityBadge, MembershipBadge, Notice, OrderBadge, PaymentBadge, PIPELINE, PipelineBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ROLES, can, CATEGORY_LABEL, isAcademicEmail, stateName, TIERS } from "@/lib/config";
import { fmtDate, fmtDateTime, money, rm, todayKL } from "@/lib/format";
import { loadMembership } from "@/lib/queries";
import { orderBalance, orderTotal, seatCode } from "@/lib/membership";
import {
  adminSeatAction,
  discountAction,
  eligibilityAction,
  membershipStatusAction,
  orgDocumentAction,
  orgNoteAction,
  pipelineAction,
  recordPaymentAction,
  rejectPaymentAction,
  resendEmailAction,
  seatRequestAction,
  verifyPaymentAction,
} from "../../actions";

const fileUrl = (key: string) => `/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export default async function MemberDetail({ params }: PageProps<"/admin/members/[id]">) {
  const { id } = await params;
  const admin = await requireAdmin("view");
  const b = await loadMembership(id);
  if (!b) notFound();
  const m = b.membership;
  const org = b.organisation;
  const person = b.user ?? b.contact!;
  const db = await getDb();
  const canMembers = can(admin.role, "members");
  const canPay = can(admin.role, "payments");

  const [admins, emails, auditRows, notes, docs, seatReqs] = await Promise.all([
    db.select().from(schema.users).where(inArray(schema.users.role, ADMIN_ROLES)),
    db
      .select()
      .from(schema.emailLog)
      .where(or(eq(schema.emailLog.membershipId, m.id), eq(schema.emailLog.userId, person.id)))
      .orderBy(desc(schema.emailLog.createdAt))
      .limit(30),
    db
      .select({ log: schema.auditLog, actor: schema.users.name })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .where(
        or(
          and(eq(schema.auditLog.entityType, "membership"), eq(schema.auditLog.entityId, m.id)),
          org ? and(eq(schema.auditLog.entityType, "organisation"), eq(schema.auditLog.entityId, org.id)) : undefined,
          b.orders.length ? inArray(schema.auditLog.entityId, b.orders.flatMap((o) => o.payments.map((p) => p.id))) : undefined,
        ),
      )
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(40),
    org ? db.select({ note: schema.orgNotes, author: schema.users.name }).from(schema.orgNotes).leftJoin(schema.users, eq(schema.orgNotes.authorId, schema.users.id)).where(eq(schema.orgNotes.organisationId, org.id)).orderBy(desc(schema.orgNotes.createdAt)) : [],
    org ? db.select().from(schema.orgDocuments).where(eq(schema.orgDocuments.organisationId, org.id)).orderBy(desc(schema.orgDocuments.createdAt)) : [],
    b.seats.length ? db.select().from(schema.seatRequests).where(and(inArray(schema.seatRequests.seatId, b.seats.map((s) => s.id)), eq(schema.seatRequests.status, "pending"))) : [],
  ]);

  return (
    <>
      <p>
        <Link href={`/admin/members?category=${m.category}`}>← {CATEGORY_LABEL[m.category]} members</Link>
      </p>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2 style={{ fontSize: "1.6rem", marginBottom: 4 }}>{org?.name ?? person.name}</h2>
            <span className="muted-sm">
              {CATEGORY_LABEL[m.category]} · {TIERS[m.tier].label}
              {m.imported ? " · imported" : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {m.memberCode && <span className="badge badge--navy">{m.memberCode}</span>}
            <MembershipBadge status={m.status} />
            <EligibilityBadge status={m.eligibilityStatus} />
            {org && <PipelineBadge status={org.pipelineStatus} prefix="Pipeline: " />}
          </div>
        </div>
        <dl className="kv">
          <dt>Membership period</dt>
          <dd>{m.startDate ? `${fmtDate(m.startDate)} – ${fmtDate(m.endDate)}` : "Not active yet"}</dd>
          <dt>State (Member ID)</dt>
          <dd>
            {m.stateCode} — {stateName(m.stateCode)}
          </dd>
          <dt>Applied</dt>
          <dd>{fmtDateTime(m.createdAt)}</dd>
          {m.topics.length > 0 && (
            <>
              <dt>Topics</dt>
              <dd>{m.topics.join(", ")}</dd>
            </>
          )}
          {m.preferences.length > 0 && (
            <>
              <dt>Wants to receive</dt>
              <dd>{m.preferences.join(", ")}</dd>
            </>
          )}
          {m.background && (
            <>
              <dt>Background</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{m.background}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="split-2">
        <div>
          {/* Person / organisation */}
          <section className="panel">
            <h2>{org ? "Organisation" : "Member details"}</h2>
            {org ? (
              <dl className="kv">
                <dt>Registered name</dt>
                <dd>{org.name}</dd>
                <dt>SSM no.</dt>
                <dd>{org.ssmNo}</dd>
                <dt>Industry / size</dt>
                <dd>
                  {org.industry || "—"} · {org.orgSize || "—"}
                </dd>
                <dt>Registered office</dt>
                <dd>
                  {org.address}, {stateName(org.stateCode)}
                </dd>
                <dt>Contact person</dt>
                <dd>
                  {org.contactName} ({org.contactJobTitle})<br />
                  <a href={`mailto:${org.contactEmail}`}>{org.contactEmail}</a> · {org.contactPhone}
                </dd>
                <dt>Account</dt>
                <dd>
                  {person.email} {person.emailVerifiedAt ? <span className="badge badge--green">verified</span> : <span className="badge badge--amber">email not verified</span>}
                </dd>
                <dt>Areas of interest</dt>
                <dd>{org.areasOfInterest.join(", ") || "—"}</dd>
                <dt>Wants a call first</dt>
                <dd>{org.wantsCall ? "Yes" : "No"}</dd>
                {org.remarks && (
                  <>
                    <dt>Message</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{org.remarks}</dd>
                  </>
                )}
              </dl>
            ) : (
              <dl className="kv">
                <dt>Name</dt>
                <dd>{person.name}</dd>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${person.email}`}>{person.email}</a>{" "}
                  {person.emailVerifiedAt ? <span className="badge badge--green">verified</span> : <span className="badge badge--amber">not verified</span>}
                </dd>
                <dt>Mobile</dt>
                <dd>{person.phone}</dd>
                <dt>{m.category === "E" ? "Course" : "Job title"}</dt>
                <dd>{person.jobTitle || "—"}</dd>
                <dt>Organisation</dt>
                <dd>{person.organisation || "—"}</dd>
                <dt>Address</dt>
                <dd>
                  {person.address || "—"}
                  {person.stateCode ? `, ${stateName(person.stateCode)}` : ""}
                </dd>
                <dt>PDPA consent</dt>
                <dd>{person.consentAt ? `${fmtDateTime(person.consentAt)} (v${person.consentVersion})` : "—"}</dd>
              </dl>
            )}
          </section>

          {/* Student eligibility */}
          {m.category === "E" && (
            <section className="panel panel--accent">
              <h2>Student eligibility</h2>
              <dl className="kv">
                <dt>Institution</dt>
                <dd>{m.institution}</dd>
                <dt>Graduation year</dt>
                <dd>{m.graduationYear ?? "—"}</dd>
                <dt>Email verified</dt>
                <dd>{person.emailVerifiedAt ? "Yes" : "No"}</dd>
                <dt>.edu / .edu.my email</dt>
                <dd>{isAcademicEmail(person.email) ? "Valid" : "Not an academic email"}</dd>
                <dt>Proof</dt>
                <dd>
                  {m.studentProofKey ? (
                    <a href={fileUrl(m.studentProofKey)} target="_blank">
                      {m.studentProofName ?? "View document"}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                {m.eligibilityNote && (
                  <>
                    <dt>Note</dt>
                    <dd>{m.eligibilityNote}</dd>
                  </>
                )}
              </dl>
              {canMembers && m.eligibilityStatus === "pending" && (
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  <ActionForm action={eligibilityAction.bind(null, m.id, true)} className="inline-form">
                    <Submit className="btn btn--primary btn--sm">Approve eligibility</Submit>
                  </ActionForm>
                  <details className="action">
                    <summary>Reject eligibility</summary>
                    <ActionForm action={eligibilityAction.bind(null, m.id, false)}>
                      <TextArea name="note" label="Reason (sent to the student)" required />
                      <div>
                        <Submit className="btn btn--danger btn--sm">Reject</Submit>
                      </div>
                    </ActionForm>
                  </details>
                </div>
              )}
            </section>
          )}

          {/* Orders and payments */}
          {b.orders.map(({ order, payments, receipts }) => {
            const open = ["awaiting_payment", "pending_verification", "part_paid"].includes(order.status);
            return (
              <section className="panel" key={order.id}>
                <div className="panel-head">
                  <h2>
                    {order.kind === "renewal" ? "Renewal" : "New membership"} · {order.itemCode}
                  </h2>
                  <OrderBadge status={order.status} />
                </div>
                <dl className="kv">
                  <dt>Description</dt>
                  <dd>{order.description}</dd>
                  <dt>Total</dt>
                  <dd>
                    {rm(orderTotal(order))}
                    {order.discount ? ` (after ${rm(order.discount)} discount)` : ""}
                  </dd>
                  <dt>Paid / balance</dt>
                  <dd>
                    {rm(order.amountPaid)} / {rm(orderBalance(order))}
                  </dd>
                  <dt>Expected reference</dt>
                  <dd>{order.paymentReference}</dd>
                  {order.periodStart && (
                    <>
                      <dt>Period</dt>
                      <dd>
                        {fmtDate(order.periodStart)} – {fmtDate(order.periodEnd)}
                      </dd>
                    </>
                  )}
                </dl>
                {payments.length > 0 && (
                  <div className="table-scroll" style={{ marginTop: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Paid on</th>
                          <th className="num">Amount</th>
                          <th>Reference</th>
                          <th>Proof</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => {
                          const r = receipts.find((x) => x.paymentId === p.id);
                          return (
                            <tr key={p.id}>
                              <td>
                                {fmtDate(p.paymentDate)}
                                <div className="muted-sm">{p.method.replace("_", " ")}</div>
                              </td>
                              <td className="num">{rm(p.amount)}</td>
                              <td>
                                {p.reference}
                                {p.note && <div className="muted-sm">{p.note}</div>}
                                {p.rejectReason && <div className="muted-sm">Rejected: {p.rejectReason}</div>}
                              </td>
                              <td>{p.proofKey ? <a href={fileUrl(p.proofKey)} target="_blank">View</a> : "—"}</td>
                              <td>
                                <PaymentBadge status={p.status} />
                                {r && (
                                  <div>
                                    <a href={`/receipts/${r.id}`} target="_blank">
                                      {r.receiptNo}
                                    </a>
                                  </div>
                                )}
                                {p.status === "submitted" && canPay && (
                                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                                    <ActionForm action={verifyPaymentAction.bind(null, p.id)} className="inline-form">
                                      <input className="input" name="amount" defaultValue={money(p.amount).replace(/,/g, "")} aria-label="Amount received (RM)" style={{ width: 100 }} />
                                      <Submit className="btn btn--primary btn--xs">Verify</Submit>
                                    </ActionForm>
                                    <ActionForm action={rejectPaymentAction.bind(null, p.id)} className="inline-form">
                                      <input className="input" name="reason" placeholder="Reason to reject" aria-label="Reason" style={{ width: 160 }} />
                                      <Submit className="btn btn--danger btn--xs">Reject</Submit>
                                    </ActionForm>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {open && canPay && (
                  <>
                    <details className="action">
                      <summary>Record a payment received outside the portal</summary>
                      <ActionForm action={recordPaymentAction.bind(null, order.id)}>
                        <div className="form-grid">
                          <Field name="amount" label="Amount (RM)" required defaultValue={money(orderBalance(order)).replace(/,/g, "")} />
                          <Select
                            name="method"
                            label="Method"
                            required
                            defaultValue="bank_transfer"
                            options={[
                              { value: "bank_transfer", label: "Bank transfer" },
                              { value: "duitnow", label: "DuitNow" },
                              { value: "cheque", label: "Cheque" },
                              { value: "cash", label: "Cash" },
                              { value: "other", label: "Other" },
                            ]}
                          />
                          <Field name="paymentDate" label="Payment date" type="date" required defaultValue={todayKL()} max={todayKL()} />
                          <Field name="reference" label="Reference" required />
                          <Field name="note" label="Note" className="full" />
                        </div>
                        <div>
                          <Submit className="btn btn--primary btn--sm">Record payment &amp; issue receipt</Submit>
                        </div>
                      </ActionForm>
                    </details>
                    <details className="action">
                      <summary>Discount</summary>
                      <ActionForm action={discountAction.bind(null, order.id)} className="inline-form">
                        <input className="input" name="discount" defaultValue={money(order.discount).replace(/,/g, "")} aria-label="Discount (RM)" style={{ width: 110 }} />
                        <Submit className="btn btn--outline btn--xs">Save discount</Submit>
                      </ActionForm>
                    </details>
                  </>
                )}
              </section>
            );
          })}

          {/* Corporate seats */}
          {org && b.seats.length > 0 && (
            <section className="panel">
              <h2>Seats ({b.seats.filter((s) => s.email).length} of {b.seats.length} assigned)</h2>
              {seatReqs.length > 0 && (
                <Notice kind="warn">
                  {seatReqs.map((r) => {
                    const seat = b.seats.find((s) => s.id === r.seatId)!;
                    return (
                      <div key={r.id} style={{ marginBottom: 8 }}>
                        <strong>{seatCode(m.memberCode, seat.seatNo)}</strong>: replace {seat.name} with {r.name} ({r.email}){r.reason ? ` — ${r.reason}` : ""}
                        {canMembers && (
                          <span style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                            <ActionForm action={seatRequestAction.bind(null, r.id, true)} className="inline-form">
                              <Submit className="btn btn--primary btn--xs">Approve</Submit>
                            </ActionForm>
                            <ActionForm action={seatRequestAction.bind(null, r.id, false)} className="inline-form">
                              <Submit className="btn btn--light btn--xs">Reject</Submit>
                            </ActionForm>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </Notice>
              )}
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Seat ID</th>
                      <th>Name</th>
                      <th>Job title</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.seats.map((s) => (
                      <tr key={s.id}>
                        <td className="nowrap">{seatCode(m.memberCode, s.seatNo)}</td>
                        <td>{s.name ?? <span className="muted-sm">Empty</span>}</td>
                        <td>{s.jobTitle ?? ""}</td>
                        <td>{s.email ?? ""}</td>
                        <td>{s.phone ?? ""}</td>
                        <td className="nowrap">{fmtDate(s.assignedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canMembers && (
                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  {b.seats.map((s) => (
                    <div key={s.id}>
                      <details className="action" style={{ marginTop: 0 }}>
                        <summary>
                          Edit {seatCode(m.memberCode, s.seatNo)}
                          {s.name ? ` · ${s.name}` : ""}
                        </summary>
                        <ActionForm action={adminSeatAction.bind(null, s.id)}>
                          <Field name="name" label="Name" defaultValue={s.name ?? ""} required />
                          <Field name="jobTitle" label="Job title" defaultValue={s.jobTitle ?? ""} />
                          <Field name="email" label="Email" type="email" defaultValue={s.email ?? ""} required />
                          <Field name="phone" label="Phone" defaultValue={s.phone ?? ""} />
                          <div className="form-actions">
                            <Submit className="btn btn--primary btn--xs">Save</Submit>
                          </div>
                        </ActionForm>
                        {s.email && (
                          <ActionForm action={adminSeatAction.bind(null, s.id)} className="inline-form">
                            <input type="hidden" name="clear" value="yes" />
                            <Submit className="btn btn--light btn--xs">Clear seat</Submit>
                          </ActionForm>
                        )}
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <aside>
          {canMembers && (
            <section className="panel">
              <h2>Actions</h2>
              <div className="action-stack" style={{ display: "grid", gap: 10 }}>
                {["active", "grace", "expired"].includes(m.status) && (
                  <ActionForm action={membershipStatusAction.bind(null, m.id, "suspended")} className="inline-form">
                    <Submit className="btn btn--danger btn--sm">Suspend membership</Submit>
                  </ActionForm>
                )}
                {m.status === "suspended" && (
                  <ActionForm action={membershipStatusAction.bind(null, m.id, "active")} className="inline-form">
                    <Submit className="btn btn--primary btn--sm">Reactivate</Submit>
                  </ActionForm>
                )}
                {m.status === "pending" && (
                  <ActionForm action={membershipStatusAction.bind(null, m.id, "cancelled")} className="inline-form">
                    <Submit className="btn btn--light btn--sm">Cancel application</Submit>
                  </ActionForm>
                )}
                {!person.emailVerifiedAt && (
                  <ActionForm action={resendEmailAction.bind(null, m.id, "verify")} className="inline-form">
                    <Submit className="btn btn--light btn--sm">Resend email verification</Submit>
                  </ActionForm>
                )}
                {m.memberCode && m.endDate && (
                  <ActionForm action={resendEmailAction.bind(null, m.id, "welcome")} className="inline-form">
                    <Submit className="btn btn--light btn--sm">Resend welcome email</Submit>
                  </ActionForm>
                )}
              </div>
            </section>
          )}

          {org && (
            <section className="panel">
              <h2>Corporate pipeline</h2>
              {canMembers ? (
                <ActionForm action={pipelineAction.bind(null, org.id)}>
                  <Select
                    name="pipelineStatus"
                    label="Status"
                    defaultValue={org.pipelineStatus}
                    options={Object.entries(PIPELINE).map(([value, [label]]) => ({ value, label }))}
                  />
                  <Select
                    name="assignedPicId"
                    label="Assigned PIC"
                    defaultValue={org.assignedPicId ?? ""}
                    placeholder="Not assigned"
                    options={admins.map((a) => ({ value: a.id, label: a.name }))}
                  />
                  <div>
                    <Submit className="btn btn--primary btn--sm">Save</Submit>
                  </div>
                </ActionForm>
              ) : (
                <PipelineBadge status={org.pipelineStatus} />
              )}
              <h3>Proposals &amp; invoices</h3>
              <ul className="timeline-log">
                {docs.map((d) => (
                  <li key={d.id}>
                    <time>{fmtDateTime(d.createdAt)}</time>
                    {d.kind}:{" "}
                    <a href={fileUrl(d.fileKey)} target="_blank">
                      {d.fileName}
                    </a>
                  </li>
                ))}
                {!docs.length && <li className="muted-sm">No documents yet.</li>}
              </ul>
              {canMembers && (
                <details className="action">
                  <summary>Upload a document</summary>
                  <ActionForm action={orgDocumentAction.bind(null, org.id)}>
                    <Select
                      name="kind"
                      label="Type"
                      defaultValue="proposal"
                      options={[
                        { value: "proposal", label: "Proposal" },
                        { value: "invoice", label: "Invoice" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                    <Field name="file" label="File" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" />
                    <div>
                      <Submit className="btn btn--primary btn--sm">Upload</Submit>
                    </div>
                  </ActionForm>
                </details>
              )}
              <h3>Notes from PIC</h3>
              <ul className="timeline-log">
                {notes.map(({ note, author }) => (
                  <li key={note.id}>
                    <time>
                      {fmtDateTime(note.createdAt)} · {author}
                    </time>
                    <span style={{ whiteSpace: "pre-wrap" }}>{note.body}</span>
                  </li>
                ))}
                {!notes.length && <li className="muted-sm">No notes yet.</li>}
              </ul>
              {canMembers && (
                <ActionForm action={orgNoteAction.bind(null, org.id)} resetOnSuccess>
                  <TextArea name="body" label="Add a note" />
                  <div>
                    <Submit className="btn btn--outline btn--sm">Add note</Submit>
                  </div>
                </ActionForm>
              )}
            </section>
          )}

          <section className="panel">
            <h2>Emails</h2>
            <ul className="timeline-log">
              {emails.map((e) => (
                <li key={e.id}>
                  <time>{fmtDateTime(e.createdAt)}</time>
                  {e.subject} <span className={`badge ${e.status === "sent" ? "badge--green" : "badge--red"}`}>{e.status}</span>
                  <div className="muted-sm">to {e.toEmail}</div>
                </li>
              ))}
              {!emails.length && <li className="muted-sm">No emails yet.</li>}
            </ul>
          </section>

          <section className="panel">
            <h2>History</h2>
            <ul className="timeline-log">
              {auditRows.map(({ log, actor }) => (
                <li key={log.id}>
                  <time>
                    {fmtDateTime(log.createdAt)} · {actor ?? "System"}
                  </time>
                  {log.action.replace(/[._]/g, " ")}
                </li>
              ))}
              {!auditRows.length && <li className="muted-sm">No history yet.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
