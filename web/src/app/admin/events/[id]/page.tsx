import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm, Checkbox, ConfirmButton, Field, Submit, TextArea } from "@/components/form";
import { Empty } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/config";
import { fmtDateTime, fmtEventWhen, rm } from "@/lib/format";
import { eventAttendees } from "@/lib/events";
import { EventForm } from "../event-form";
import { attendedAction, cancelRegistrationAdminAction, emailAttendeesAction } from "../actions";

const STATUS = {
  confirmed: ["Confirmed", "badge--green"],
  awaiting_payment: ["Awaiting payment", "badge--amber"],
  payment_review: ["Payment to verify", "badge--blue"],
  cancelled: ["Cancelled", "badge--red"],
} as const;

export default async function AdminEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const admin = await requireAdmin("events");
  const { id } = await params;
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!e) notFound();
  const regs = await eventAttendees(e.id);
  const active = regs.filter((r) => r.status !== "cancelled");
  const confirmed = active.filter((r) => r.status === "confirmed");
  const income = confirmed.reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <p>
        <Link href="/admin/events">← Events</Link>
      </p>
      <div className="panel-head">
        <div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: 4 }}>{e.title}</h2>
          <p className="muted-sm">
            {fmtEventWhen(e.startsAt, e.endsAt)} · {e.audience === "members" ? "Members only" : "Everyone"} · {e.status}
          </p>
        </div>
        <Link className="btn btn--outline btn--sm" href={`/events/${e.slug}`} target="_blank">
          {e.status === "draft" ? "Preview page" : "View public page"}
        </Link>
      </div>

      <div className="stat-cards" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="n">{confirmed.length}</div>
          <div className="l">Confirmed{e.capacity ? ` of ${e.capacity}` : ""}</div>
        </div>
        <div className="stat-card">
          <div className="n">{active.length - confirmed.length}</div>
          <div className="l">Pending payment</div>
        </div>
        <div className="stat-card">
          <div className="n">{confirmed.filter((r) => r.attended).length}</div>
          <div className="l">Attended</div>
        </div>
        <div className="stat-card">
          <div className="n">{rm(income)}</div>
          <div className="l">Fees confirmed</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Attendees</h2>
          {regs.length > 0 && (
            <a className="btn btn--outline btn--sm" href={`/admin/events/${e.id}/attendees`}>
              Download CSV
            </a>
          )}
        </div>
        {regs.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Attended</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      <div className="muted-sm">{r.organisation ?? ""}</div>
                    </td>
                    <td>
                      {r.email}
                      <div className="muted-sm">{r.phone ?? ""}</div>
                    </td>
                    <td className="nowrap">
                      {r.rate === "member" ? `Member ${r.memberCode ?? ""}` : "Non-member"}
                      <div className="muted-sm">{r.amount ? rm(r.amount) : "Free"}</div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                      {r.status === "payment_review" && can(admin.role, "payments") && (
                        <div className="muted-sm">
                          <Link href="/admin/payments">Verify in Payments</Link>
                        </div>
                      )}
                    </td>
                    <td className="nowrap">{fmtDateTime(r.createdAt)}</td>
                    <td>
                      {r.status === "confirmed" && (
                        <ActionForm action={attendedAction.bind(null, r.id, !r.attended)} className="inline-form">
                          <Submit className={`btn btn--xs ${r.attended ? "btn--primary" : "btn--light"}`}>{r.attended ? "✓ Attended" : "Mark attended"}</Submit>
                        </ActionForm>
                      )}
                    </td>
                    <td>
                      {r.status !== "cancelled" && (
                        <ActionForm action={cancelRegistrationAdminAction.bind(null, r.id)} className="inline-form">
                          <input className="input" name="note" placeholder="Note to attendee (optional)" aria-label="Note" style={{ width: 160 }} />
                          <ConfirmButton className="btn btn--danger btn--xs" confirm={`Cancel ${r.name}'s registration and email them?`}>
                            Cancel
                          </ConfirmButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No registrations yet.</Empty>
        )}
      </section>

      {active.length > 0 && (
        <section className="panel">
          <h2>Email attendees</h2>
          <p className="muted-sm">Goes to everyone with a confirmed place (and optionally those still paying). Use it for joining instructions, changes or a thank-you.</p>
          <ActionForm action={emailAttendeesAction.bind(null, e.id)} resetOnSuccess>
            <Field name="subject" label="Subject" required />
            <TextArea name="message" label="Message" required hint="Plain text. Leave a blank line between paragraphs." />
            <Checkbox name="includePending">Also send to people who haven&apos;t completed payment</Checkbox>
            <Checkbox name="confirm" required>
              Send this email now
            </Checkbox>
            <div>
              <Submit pendingText="Sending…">Send email</Submit>
            </div>
          </ActionForm>
        </section>
      )}

      <section className="panel">
        <h2>Edit event</h2>
        <EventForm e={e} />
      </section>
    </>
  );
}
