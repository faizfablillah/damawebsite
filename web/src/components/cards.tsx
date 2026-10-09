import Link from "next/link";
import type { Event } from "@/db/schema";
import { fmtEventWhen, rmShort } from "@/lib/format";
import type { NewsPost } from "@/lib/news";

// Inline icons: 1em by default so they sit in a line of text (cards size them via CSS)
const iconStyle = { width: "1em", height: "1em", verticalAlign: "-0.125em", flex: "none" } as const;

export const CalendarIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
export const PinIcon = () => (
  <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 22s7-7.6 7-13a7 7 0 1 0-14 0c0 5.4 7 13 7 13z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

// Uploaded covers live in storage; a key starting with "/" is a file in public/ (e.g. a partner's banner)
export const eventImage = (e: Pick<Event, "imageKey">) =>
  !e.imageKey
    ? "/assets/img/events/launch-panel.jpg"
    : e.imageKey.startsWith("/")
      ? e.imageKey
      : `/event-images/${e.imageKey.split("/").map(encodeURIComponent).join("/")}`;

export const eventTag = (e: Event) =>
  e.status === "cancelled" ? "Cancelled" : e.externalUrl ? "Partner event" : e.audience === "members" ? "Members only" : (e.category ?? "Event");

export function priceLabel(e: Event) {
  if (e.externalUrl) return e.memberOffer ? `Partner event · ${e.memberOffer}` : "Partner event · register with the organiser";
  const member = e.memberPrice ? rmShort(e.memberPrice) : "Free";
  if (e.audience === "members" || e.nonMemberPrice === null) return `Members only · ${member}`;
  if (!e.memberPrice && !e.nonMemberPrice) return "Free · open to all";
  return `Members ${member} · Non-members ${e.nonMemberPrice ? rmShort(e.nonMemberPrice) : "Free"}`;
}

export function EventCard({ e }: { e: Event }) {
  return (
    <Link className="event-card" href={`/events/${e.slug}`}>
      <div className="event-card__img">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded and static images, already sized */}
        <img src={eventImage(e)} alt="" loading="lazy" />
        <span className="tag">{eventTag(e)}</span>
      </div>
      <div className="event-card__body">
        <div className="event-card__date">
          <CalendarIcon />
          {fmtEventWhen(e.startsAt, e.endsAt)}
        </div>
        <h3>{e.title}</h3>
        <p>{e.summary}</p>
        <p className="muted-sm" style={{ marginTop: 6 }}>
          {priceLabel(e)}
        </p>
        <span className="link-arrow">
          Details <Arrow />
        </span>
      </div>
    </Link>
  );
}

export function NewsCard({ p }: { p: NewsPost }) {
  return (
    <Link className="event-card" href={`/news/${p.slug}`}>
      <div className="event-card__img">
        {/* eslint-disable-next-line @next/next/no-img-element -- static images, already sized */}
        <img src={p.images[0]?.src ?? "/assets/img/events/launch-group.jpg"} alt={p.images[0]?.alt ?? ""} loading="lazy" />
        <span className="tag">{p.tag}</span>
      </div>
      <div className="event-card__body">
        <div className="event-card__date">
          <CalendarIcon />
          {p.dateLabel}
        </div>
        <h3>{p.title}</h3>
        <p>{p.summary}</p>
        <span className="link-arrow">
          Read more <Arrow />
        </span>
      </div>
    </Link>
  );
}
