import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Notice } from "@/components/ui";
import { ActionForm, ConfirmButton, Submit } from "@/components/form";
import { CalendarIcon, PinIcon, eventImage, priceLabel } from "@/components/cards";
import { getDb, schema } from "@/db";
import type { Event } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { fmtEventWhen, rm } from "@/lib/format";
import { hasEnded, memberStatus, placesTaken, priceFor, registrationClosed, registrationFor } from "@/lib/events";
import { cancelRegistrationAction, registerAction } from "../actions";

async function load(slug: string): Promise<Event | null> {
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.slug, slug));
  return e ?? null;
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">) {
  const e = await load((await params).slug);
  if (!e || e.status === "draft") return { title: "Event" };
  return { title: e.title, description: e.summary, openGraph: { title: e.title, description: e.summary, images: [eventImage(e)] } };
}

// Paragraphs typed in the admin form (blank line = new paragraph)
const Paras = ({ text }: { text: string }) => (
  <>
    {text
      .trim()
      .split(/\r?\n\s*\r?\n/)
      .filter(Boolean)
      .map((p, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {p}
        </p>
      ))}
  </>
);

// Bare links in materials become clickable
const Linkified = ({ text }: { text: string }) => (
  <p style={{ whiteSpace: "pre-line" }}>
    {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener">
          {part}
        </a>
      ) : (
        part
      ),
    )}
  </p>
);

export default async function EventPage({ params, searchParams }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const e = await load(slug);
  const user = await getCurrentUser();
  // Drafts are visible only to event admins (preview)
  if (!e || (e.status === "draft" && !can(user?.role, "events"))) notFound();

  const [taken, status, registration] = await Promise.all([
    placesTaken(e.id),
    user ? memberStatus(user) : Promise.resolve({ member: false, memberCode: null }),
    user ? registrationFor(e.id, user.id) : Promise.resolve(null),
  ]);
  const active = registration && registration.status !== "cancelled" ? registration : null;
  const full = e.capacity !== null && taken >= e.capacity;
  const closed = registrationClosed(e);
  const ended = hasEnded(e);
  const myPrice = priceFor(e, status.member);
  const showMaterials = !!e.materials && (status.member || active?.status === "confirmed" || can(user?.role, "events"));
  const next = `/events/${e.slug}`;

  let panel: React.ReactNode;
  if (active) {
    panel =
      active.status === "confirmed" ? (
        <>
          <Notice kind="success">You&apos;re registered. We&apos;ve emailed you a confirmation and calendar invitation.</Notice>
          {e.onlineUrl && !ended && (
            <p>
              <strong>Join online:</strong>{" "}
              <a href={e.onlineUrl} target="_blank" rel="noopener">
                {e.onlineUrl}
              </a>
            </p>
          )}
          {active.amount === 0 && !ended && (
            <ActionForm action={cancelRegistrationAction.bind(null, active.id, e.slug)}>
              <ConfirmButton className="btn btn--outline btn--sm" confirm="Cancel your registration?">
                Cancel my registration
              </ConfirmButton>
            </ActionForm>
          )}
        </>
      ) : (
        <>
          <Notice kind={active.status === "payment_review" ? "info" : "warn"}>
            {active.status === "payment_review"
              ? "We've received your payment details and will confirm your place once they're verified."
              : `Your place is reserved. Please pay ${rm(active.amount)} to confirm it.`}
          </Notice>
          <p>
            <Link className="btn btn--primary btn--sm" href={`/portal/events/${active.id}`}>
              {active.status === "payment_review" ? "View payment status" : "Pay and upload receipt"}
            </Link>
          </p>
        </>
      );
  } else if (e.status === "cancelled") {
    panel = <Notice kind="warn">This event has been cancelled.</Notice>;
  } else if (ended) {
    panel = <p className="muted">This event has ended.</p>;
  } else if (closed) {
    panel = <p className="muted">{closed}</p>;
  } else if (user?.emailVerifiedAt && myPrice === null) {
    panel = (
      <>
        <p>This event is for DAMA members.</p>
        <Link className="btn btn--primary btn--sm" href="/join">
          Join DAMA to attend
        </Link>
      </>
    );
  } else if (full) {
    panel = <Notice kind="warn">Sorry, this event is fully booked.</Notice>;
  } else if (!user) {
    panel = (
      <>
        <p>Log in to register. DAMA members pay the member price.</p>
        <div className="form-actions">
          <Link className="btn btn--primary btn--sm" href={`/login?next=${encodeURIComponent(next)}`}>
            Log in to register
          </Link>
          {e.audience === "public" && <Link href={`/signup?next=${encodeURIComponent(next)}`}>No account? Create a free account</Link>}
        </div>
        {e.audience === "members" && (
          <p className="muted-sm" style={{ marginTop: 10 }}>
            Not a member yet? <Link href="/join">Join DAMA</Link> to attend members-only events.
          </p>
        )}
      </>
    );
  } else if (!user.emailVerifiedAt) {
    panel = (
      <p>
        Please <Link href="/check-email">confirm your email address</Link> first, then come back to register.
      </p>
    );
  } else if (myPrice === null) {
    panel = null; // handled above
  } else {
    panel = (
      <>
        <p>
          Your price: <strong>{myPrice ? rm(myPrice) : "Free"}</strong>
          {status.member ? " (member price)" : ""}
        </p>
        {myPrice > 0 && <p className="muted-sm">After registering you&apos;ll get the bank details. Your place is confirmed once we&apos;ve verified your payment.</p>}
        <ActionForm action={registerAction.bind(null, e.id, e.slug)}>
          <div>
            <Submit pendingText="Registering…">{myPrice ? "Register and pay" : "Register"}</Submit>
          </div>
        </ActionForm>
      </>
    );
  }

  return (
    <>
      <section className="app-hero">
        <div className="waves waves--right" aria-hidden="true" />
        <div className="container">
          <p className="eyebrow">{e.audience === "members" ? "Members-only event" : (e.category ?? "Event")}</p>
          <h1>{e.title}</h1>
          <p>{e.summary}</p>
        </div>
      </section>
      <div className="app-main">
        <div className="container">
          {e.status === "draft" && <Notice kind="info">Draft preview: this event isn&apos;t published yet, so only event admins can see it.</Notice>}
          {sp.cancelled && <Notice kind="success">Your registration has been cancelled.</Notice>}
          <div className="split-2">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded or static image */}
              <img src={eventImage(e)} alt="" style={{ width: "100%", borderRadius: 16, marginBottom: 20, aspectRatio: "16 / 9", objectFit: "cover" }} />
              {e.body ? <Paras text={e.body} /> : <p>{e.summary}</p>}
              {showMaterials && (
                <section className="panel panel--accent" style={{ marginTop: 24 }}>
                  <h2>Slides &amp; materials</h2>
                  <p className="muted-sm">For DAMA members and attendees.</p>
                  <Linkified text={e.materials!} />
                </section>
              )}
              {e.materials && !showMaterials && (
                <p className="muted-sm" style={{ marginTop: 24 }}>
                  Slides and materials from this event are available to DAMA members. <Link href="/join">Join DAMA</Link>
                </p>
              )}
            </div>
            <aside>
              <section className="panel">
                <h2>Details</h2>
                <dl className="kv">
                  <dt>When</dt>
                  <dd>
                    <CalendarIcon /> {fmtEventWhen(e.startsAt, e.endsAt)}
                  </dd>
                  <dt>Where</dt>
                  <dd>
                    <PinIcon /> {e.venue || (e.onlineUrl ? "Online" : "To be announced")}
                  </dd>
                  <dt>Price</dt>
                  <dd>{priceLabel(e)}</dd>
                  {e.capacity !== null && !ended && (
                    <>
                      <dt>Places</dt>
                      <dd>{full ? "Fully booked" : `${e.capacity - taken} of ${e.capacity} left`}</dd>
                    </>
                  )}
                </dl>
              </section>
              <section className="panel" id="register">
                <h2>Registration</h2>
                {panel}
              </section>
            </aside>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link href="/events">← All events</Link>
          </p>
        </div>
      </div>
    </>
  );
}
