import Link from "next/link";
import Script from "next/script";
import { connection } from "next/server";
import { AppHero } from "@/components/ui";
import { EventCard, NewsCard } from "@/components/cards";
import { publishedEvents } from "@/lib/events";
import { allNews, OLD_EVENT_ANCHORS } from "@/lib/news";
import { ORG } from "@/lib/config";

export const metadata = {
  title: "Events",
  description: "Upcoming talks, workshops and networking from DAMA Kuala Lumpur & Selangor. Members get member prices and members-only events.",
};

export default async function EventsPage() {
  await connection();
  const [upcoming, past] = await Promise.all([publishedEvents("upcoming"), publishedEvents("past", 12)]);
  const news = allNews().slice(0, 3);
  return (
    <>
      <AppHero eyebrow="What's on" title="Events">
        Talks, workshops and networking for Malaysia&apos;s data community. Members pay member prices and get access to members-only events.
      </AppHero>
      <div className="app-main">
        <div className="container">
          <section aria-labelledby="upcoming">
            <h2 id="upcoming">Upcoming events</h2>
            {upcoming.length ? (
              <div className="grid grid--3" style={{ marginTop: 18 }}>
                {upcoming.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            ) : (
              <div className="panel" style={{ marginTop: 18 }}>
                <p>No upcoming events are open right now. New events are announced here and on our{" "}
                  <a href={ORG.linkedin} target="_blank" rel="noopener">LinkedIn page</a>.
                </p>
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past" style={{ marginTop: 48 }}>
              <h2 id="past">Past events</h2>
              <p className="muted-sm">Members can find slides and recordings on each event&apos;s page.</p>
              <div className="grid grid--3" style={{ marginTop: 18 }}>
                {past.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            </section>
          )}

          {news.length > 0 && (
            <section aria-labelledby="highlights" style={{ marginTop: 48 }}>
              <h2 id="highlights">News &amp; highlights</h2>
              <div className="grid grid--3" style={{ marginTop: 18 }}>
                {news.map((p) => (
                  <NewsCard key={p.slug} p={p} />
                ))}
              </div>
              <p style={{ marginTop: 18 }}>
                <Link href="/news">All news →</Link>
              </p>
            </section>
          )}
        </div>
      </div>
      {/* Links to the old Events page (/events#mmu-mou) now open the matching news post */}
      <Script id="old-event-anchors" strategy="afterInteractive">
        {`(function(){var m=${JSON.stringify(OLD_EVENT_ANCHORS)};var h=location.hash.slice(1);if(m[h])location.replace("/news/"+m[h]);})();`}
      </Script>
    </>
  );
}
